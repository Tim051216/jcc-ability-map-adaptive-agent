"""Benchmark the legacy lexical retriever against multi-route RAG.

Run from a3-ai-python with: python scripts/benchmark_multi_route_rag.py
"""

from __future__ import annotations

import asyncio
import json
import statistics
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.core.config import settings
from app.integrations.llm.client import get_llm_client
from app.schemas.rag import RagSearchRequest
from app.services.rag_service import RagService

COURSE = "software_engineering_4th"
CASES = [
    ("如何启动 BiliLearn 本地服务", {"section_20_bililearn_local_startup"}),
    ("学生端课堂页面怎么用", {"section_21_bililearn_student_pages"}),
    ("管理端知识库如何入库", {"section_22_bililearn_admin_and_rag"}),
    ("两个学生端端口冲突怎么办", {"section_23_bililearn_troubleshooting"}),
    ("系统使用文档索引", {"section_24_bililearn_usage_index"}),
    ("课程有哪些章节", {"section_15_chapter_map"}),
    ("教学进度如何安排", {"section_14_teaching_schedule"}),
    ("课程采用什么教学方法", {"section_16_teaching_method"}),
    ("有哪些实验和建模工具", {"section_17_labs_projects_and_tools"}),
    ("课程如何考核", {"section_18_assessment_and_outcomes"}),
    ("课程面向哪些专业学生", {"section_13_course_profile"}),
    ("手机应用开发资料", {"section_02"}),
    ("视频扩展资源", {"section_03"}),
    ("实验报告样例", {"section_07"}),
    ("复习题答案", {"section_09"}),
]
TTFT_CASES = [
    "BiliLearn 本地开发需要启动哪些服务",
    "课堂学习页面包含哪些功能",
    "后台怎样导入课程知识库",
]


def source_from_title(title: str) -> str:
    return title.replace(" ", "_")


def summarize(rows: list[dict[str, Any]]) -> dict[str, float]:
    returned = sum(len(row["sources"]) for row in rows)
    relevant = sum(sum(source in row["relevant"] for source in row["sources"]) for row in rows)
    top1 = sum(bool(row["sources"]) and row["sources"][0] in row["relevant"] for row in rows)
    precision = relevant / returned if returned else 0.0
    return {
        "top1_hit_rate_pct": round(top1 / len(rows) * 100, 2),
        "over_retrieval_rate_pct": round((1 - precision) * 100, 2),
        "context_precision_pct": round(precision * 100, 2),
        "mean_retrieval_latency_ms": round(statistics.mean(row["latency_ms"] for row in rows), 2),
    }


def run_legacy(
    service: RagService, top_k: int = 3
) -> tuple[list[dict[str, Any]], dict[str, float]]:
    rows = []
    for query, relevant in CASES:
        started = time.perf_counter()
        hits = service._rerank_hits(
            query,
            service._search_local_markdown(COURSE, query, top_k, use_section_hints=False),
        )[:top_k]
        rows.append(
            {
                "query": query,
                "relevant": sorted(relevant),
                "sources": [str(hit["source_name"]) for hit in hits],
                "latency_ms": round((time.perf_counter() - started) * 1000, 2),
            }
        )
    return rows, summarize(rows)


async def run_multi_route(
    service: RagService, top_k: int = 3
) -> tuple[list[dict[str, Any]], dict[str, float]]:
    rows = []
    for query, relevant in CASES:
        response = await service.search(
            RagSearchRequest(course_code=COURSE, query=query, top_k=top_k)
        )
        rows.append(
            {
                "query": query,
                "relevant": sorted(relevant),
                "sources": [source_from_title(hit.title) for hit in response.hits],
                "latency_ms": response.latency_ms,
                "intent": response.intent,
                "candidate_count": response.candidate_count,
            }
        )
    return rows, summarize(rows)


async def measure_ttft(service: RagService) -> dict[str, Any]:
    samples = []
    client = get_llm_client()
    for query in TTFT_CASES:
        started = time.perf_counter()
        response = await service.search(RagSearchRequest(course_code=COURSE, query=query, top_k=3))
        context = "\n\n".join(hit.content for hit in response.hits)
        try:
            async for chunk in client.chat_completion_stream(
                [
                    {"role": "system", "content": "仅根据给定课程知识库简洁回答。"},
                    {"role": "user", "content": f"知识库：\n{context}\n\n问题：{query}"},
                ],
                temperature=0.1,
                max_tokens=160,
                model=settings.llm_fast_model,
            ):
                if chunk:
                    samples.append(round((time.perf_counter() - started) * 1000, 2))
                    break
        except Exception as exc:
            return {
                "status": "unavailable",
                "error": type(exc).__name__,
                "message": str(exc),
                "queries": TTFT_CASES,
                "samples_ms": samples,
            }
    return {
        "status": "measured" if samples else "unavailable",
        "queries": TTFT_CASES,
        "samples_ms": samples,
        "mean_ms": round(statistics.mean(samples), 2) if samples else None,
    }


async def main() -> None:
    service = RagService()
    legacy_rows, legacy = run_legacy(service)

    RagService._local_vector_indexes.pop(COURSE, None)
    cold_started = time.perf_counter()
    cold_response = await service.search(
        RagSearchRequest(course_code=COURSE, query=CASES[0][0], top_k=3)
    )
    cold_ms = round((time.perf_counter() - cold_started) * 1000, 2)

    multi_rows, multi = await run_multi_route(service)
    ttft = await measure_ttft(service)
    report = {
        "generated_at": datetime.now().astimezone().isoformat(),
        "course_code": COURSE,
        "case_count": len(CASES),
        "top_k": 3,
        "vector_backend": cold_response.vector_backend,
        "embedding_provider": settings.embedding_provider,
        "embedding_model": settings.embedding_model,
        "ttft_model": settings.llm_fast_model,
        "cold_start_ms": cold_ms,
        "legacy": legacy,
        "multi_route": multi,
        "delta": {
            "top1_hit_rate_points": round(
                multi["top1_hit_rate_pct"] - legacy["top1_hit_rate_pct"], 2
            ),
            "over_retrieval_rate_points": round(
                multi["over_retrieval_rate_pct"] - legacy["over_retrieval_rate_pct"], 2
            ),
            "context_precision_points": round(
                multi["context_precision_pct"] - legacy["context_precision_pct"], 2
            ),
        },
        "ttft": ttft,
        "legacy_cases": legacy_rows,
        "multi_route_cases": multi_rows,
    }
    output_dir = ROOT / "benchmark_results"
    output_dir.mkdir(exist_ok=True)
    output_path = output_dir / f"multi_route_rag_{datetime.now():%Y%m%d_%H%M%S}.json"
    output_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({**report, "report_path": str(output_path)}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
