import asyncio
import time

import pytest

from app.schemas.rag import RagSearchRequest
from app.services.rag_service import RagService


def _hit(source: str, score: float, route: str, chunk_id: int = 1) -> dict:
    return {
        "chunk_id": chunk_id,
        "document_id": chunk_id,
        "title": source.replace("_", " "),
        "content": f"content for {source}",
        "score": score,
        "source_name": source,
        "tags": [source],
        "chunk_kind": "local_markdown",
        "priority": 1,
        "_route": route,
    }


@pytest.mark.parametrize(
    ("query", "expected"),
    [
        ("如何启动系统并解决端口冲突", "system_usage"),
        ("课程采用什么教学方法", "course_structure"),
        ("课程如何考核评分", "assessment"),
        ("有哪些实验和建模工具", "practice"),
        ("视频扩展资源在哪里", "resource"),
    ],
)
def test_intent_routing(query: str, expected: str) -> None:
    intent, _, sections = RagService._build_intent_query(query)

    assert intent == expected
    assert sections


def test_dedupe_fuses_route_agreement_once() -> None:
    intent_hit = _hit("section_20_bililearn_local_startup", 4.2, "intent_directed")
    vector_hit = _hit("section_20_bililearn_local_startup", 0.86, "global_vector_local")

    fused = RagService._dedupe_and_fuse([[intent_hit], [vector_hit]])

    assert len(fused) == 1
    assert set(fused[0]["_routes"]) == {"intent_directed", "global_vector_local"}
    assert fused[0]["score"] > 1.0


def test_pruning_removes_low_confidence_candidates() -> None:
    hits = [
        _hit("best", 1.0, "intent_directed", 1),
        _hit("close", 0.78, "global_vector_local", 2),
        _hit("noise", 0.35, "global_vector_local", 3),
    ]

    selected = RagService._prune_hits(hits, top_k=5)

    assert [hit["source_name"] for hit in selected] == ["best"]


def test_local_markdown_can_gate_bililearn_sections(tmp_path) -> None:
    knowledge_root = tmp_path / "knowledge_base"
    course_dir = knowledge_root / "software_engineering_4th"
    course_dir.mkdir(parents=True)
    (course_dir / "section_20_bililearn_local_startup.md").write_text(
        "# BiliLearn 本地启动\n\n启动本地服务需要先启动网关。",
        encoding="utf-8",
    )

    service = RagService()
    service._knowledge_root = knowledge_root

    blocked = service._search_local_markdown(
        "software_engineering_4th", "启动 BiliLearn 本地服务", 3
    )
    allowed = service._search_local_markdown(
        "software_engineering_4th",
        "启动 BiliLearn 本地服务",
        3,
        ("section_20",),
        allow_bililearn=True,
    )

    assert blocked == []
    assert [hit["source_name"] for hit in allowed] == ["section_20_bililearn_local_startup"]


@pytest.mark.asyncio
async def test_search_executes_routes_concurrently_and_populates_diagnostics(monkeypatch) -> None:
    service = RagService()

    def fake_intent(*args, **kwargs):
        time.sleep(0.08)
        return [_hit("section_20_bililearn_local_startup", 4.0, "intent_directed")]

    async def fake_vector(*args, **kwargs):
        await asyncio.sleep(0.08)
        return [_hit("section_20_bililearn_local_startup", 0.9, "global_vector_local")]

    monkeypatch.setattr(service, "_search_local_markdown", fake_intent)
    monkeypatch.setattr(service, "_search_global_vector", fake_vector)

    started = time.perf_counter()
    response = await service.search(
        RagSearchRequest(course_code="software_engineering_4th", query="如何启动系统", top_k=3)
    )
    elapsed = time.perf_counter() - started

    assert elapsed < 0.14
    assert len(response.hits) == 1
    assert response.retrieval_mode == "intent+global_vector"
    assert response.intent == "system_usage"
    assert response.candidate_count == 1
    assert response.latency_ms > 0


@pytest.mark.asyncio
async def test_global_vector_falls_back_to_local_tfidf(monkeypatch) -> None:
    service = RagService()
    monkeypatch.setattr(RagService, "_embedding_unavailable_until", 0.0)

    async def unavailable(_text: str):
        raise RuntimeError("remote embedding unavailable")

    monkeypatch.setattr(service.embedding_service, "embed_text_strict", unavailable)
    hits = await service._search_global_vector(
        "software_engineering_4th", "BiliLearn local startup", 3
    )

    assert hits
    assert all(hit["_route"] == "global_vector_tfidf" for hit in hits)


@pytest.mark.asyncio
async def test_global_vector_filters_bililearn_hits_for_general_queries(monkeypatch) -> None:
    service = RagService()
    monkeypatch.setattr(RagService, "_embedding_unavailable_until", 0.0)
    monkeypatch.setattr(service, "_milvus_reachable", lambda: True)

    async def embed_once(_text: str):
        return [0.25] * 1024

    monkeypatch.setattr(service.embedding_service, "embed_text_strict", embed_once)

    def fake_vector_store(course_code: str, vector: list[float], top_k: int) -> list[dict]:
        return [
            _hit("section_23_bililearn_troubleshooting", 0.96, "global_vector_milvus", 1),
            _hit("section_05", 0.55, "global_vector_milvus", 2),
        ]

    async def fake_local_vector(*args, **kwargs):
        return []

    def fake_local_tfidf(*args, **kwargs):
        return [_hit("section_05", 0.88, "global_vector_tfidf", 2)]

    monkeypatch.setattr(RagService, "_search_vector_store", staticmethod(fake_vector_store))
    monkeypatch.setattr(service, "_search_local_vector", fake_local_vector)
    monkeypatch.setattr(service, "_search_local_tfidf", fake_local_tfidf)

    hits = await service._search_global_vector(
        "software_engineering_4th",
        "general query",
        3,
        allow_bililearn=False,
    )

    assert hits
    assert all("section_23_bililearn_troubleshooting" not in hit["source_name"] for hit in hits)
    assert hits[0]["source_name"] == "section_05"
    assert hits[0]["_route"] == "global_vector_milvus"


@pytest.mark.asyncio
async def test_global_vector_keeps_bililearn_hits_for_system_usage_queries(monkeypatch) -> None:
    service = RagService()
    monkeypatch.setattr(RagService, "_embedding_unavailable_until", 0.0)
    monkeypatch.setattr(service, "_milvus_reachable", lambda: True)

    async def embed_once(_text: str):
        return [0.25] * 1024

    monkeypatch.setattr(service.embedding_service, "embed_text_strict", embed_once)

    def fake_vector_store(course_code: str, vector: list[float], top_k: int) -> list[dict]:
        return [
            _hit("section_20_bililearn_local_startup", 0.97, "global_vector_milvus", 1),
            _hit("section_05", 0.48, "global_vector_milvus", 2),
        ]

    monkeypatch.setattr(RagService, "_search_vector_store", staticmethod(fake_vector_store))

    hits = await service._search_global_vector(
        "software_engineering_4th",
        "system usage query",
        3,
        allow_bililearn=True,
    )

    assert hits
    assert hits[0]["source_name"] == "section_20_bililearn_local_startup"
    assert hits[0]["_route"] == "global_vector_milvus"


@pytest.mark.asyncio
async def test_semantic_document_vectors_are_persisted(tmp_path, monkeypatch) -> None:
    knowledge_root = tmp_path / "knowledge_base"
    course_dir = knowledge_root / "test_course"
    course_dir.mkdir(parents=True)
    (course_dir / "section_01.md").write_text("alpha content", encoding="utf-8")

    service = RagService()
    service._knowledge_root = knowledge_root
    monkeypatch.setattr(RagService, "_local_vector_indexes", {})

    async def embed_once(_text: str):
        return [0.25] * 1024

    monkeypatch.setattr(service.embedding_service, "embed_text_strict", embed_once)
    first = await service._get_local_vector_index("test_course")

    second_service = RagService()
    second_service._knowledge_root = knowledge_root
    monkeypatch.setattr(RagService, "_local_vector_indexes", {})

    async def should_not_embed(_text: str):
        raise AssertionError("persisted vectors should be reused")

    monkeypatch.setattr(second_service.embedding_service, "embed_text_strict", should_not_embed)
    second = await second_service._get_local_vector_index("test_course")

    assert second == first


@pytest.mark.asyncio
async def test_cold_semantic_index_build_falls_back_without_blocking(tmp_path, monkeypatch) -> None:
    knowledge_root = tmp_path / "knowledge_base"
    course_dir = knowledge_root / "test_course"
    course_dir.mkdir(parents=True)
    (course_dir / "section_01.md").write_text("alpha content", encoding="utf-8")

    service = RagService()
    service._knowledge_root = knowledge_root
    monkeypatch.setattr(RagService, "_local_vector_indexes", {})
    monkeypatch.setattr(RagService, "_local_vector_build_tasks", {})
    monkeypatch.setattr(RagService, "_query_vector_cache", {})
    monkeypatch.setattr(RagService, "_embedding_unavailable_until", 0.0)
    monkeypatch.setattr(service, "_milvus_reachable", lambda: False)

    async def slow_document_embedding(text: str):
        if text == "alpha query":
            return [0.25] * 1024
        await asyncio.sleep(1.0)
        return [0.25] * 1024

    monkeypatch.setattr(service.embedding_service, "embed_text_strict", slow_document_embedding)
    started = time.perf_counter()
    hits = await service._search_global_vector("test_course", "alpha query", 3)
    elapsed = time.perf_counter() - started

    assert elapsed < 0.95
    assert hits[0]["_route"] == "global_vector_tfidf"
    await asyncio.sleep(0.3)
