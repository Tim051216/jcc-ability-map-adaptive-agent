"""Narrow public gateway used by the Xfyun job-learning plugin demo."""

from __future__ import annotations

import asyncio
import os
from datetime import datetime, timezone
from time import monotonic
from typing import Any

import httpx
from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import JSONResponse

BACKEND_BASE_URL = os.getenv("PLUGIN_BACKEND_BASE_URL", "http://127.0.0.1:18080").rstrip("/")
CACHE_TTL_SECONDS = float(os.getenv("PLUGIN_CACHE_TTL_SECONDS", "300"))

_response_cache: dict[tuple[int, int], tuple[float, dict[str, Any]]] = {}
_cache_lock = asyncio.Lock()

app = FastAPI(
    title="Xfyun Job Learning Plugin Gateway",
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)


@app.middleware("http")
async def add_public_response_headers(request, call_next):
    response = await call_next(request)
    response.headers["Cache-Control"] = "no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Robots-Tag"] = "noindex, nofollow"
    return response


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "xfyun-job-learning-plugin"}


@app.get("/api/v1/student-portal/job-learning")
async def get_job_learning_overview(
    user_id: int = Query(default=1001, ge=1),
    course_id: int = Query(default=401, ge=1),
) -> JSONResponse:
    payload, cache_status = await _load_job_learning_overview(user_id, course_id)
    return JSONResponse(content=payload, headers={"X-Plugin-Cache": cache_status})


@app.get("/api/v1/xa/industry-analysis")
async def get_xa_industry_analysis(
    user_id: int = Query(default=1001, ge=1),
    course_id: int = Query(default=401, ge=1),
) -> JSONResponse:
    payload, cache_status = await _load_job_learning_overview(user_id, course_id)
    result = {
        "route": "industry_analysis",
        "professional_group": payload.get("professional_group"),
        "target_job": payload.get("job_name"),
        "course_code": payload.get("course_code"),
        "course_name": payload.get("course_name"),
        "student_goal": payload.get("student_goal"),
        "goal_scene": payload.get("goal_scene"),
        "assessment_id": payload.get("assessment_id"),
        "competency_benchmarks": [
            {
                "code": item.get("code"),
                "label": item.get("label"),
                "benchmark": item.get("benchmark"),
            }
            for item in payload.get("ability_dimensions", [])
        ],
        "gap_summary": payload.get("weak_abilities", []),
        "citations": payload.get("citations", []),
        "safety_notices": payload.get("safety_notices", []),
    }
    return JSONResponse(content=result, headers={"X-Plugin-Cache": cache_status})


@app.get("/api/v1/xa-competition/industry/jobs-analysis")
async def get_xa_competition_industry_analysis(
    refresh: bool = Query(default=False),
    professional_group: str = Query(default="软件技术专业群"),
    core_job: str = Query(default="软件开发工程师"),
    source_urls: str | None = Query(default=None),
) -> JSONResponse:
    """Keep the published V3 plugin contract alive on the current gateway."""
    if refresh:
        _response_cache.pop((1001, 401), None)
    payload, cache_status = await _load_job_learning_overview(1001, 401)
    dimensions = payload.get("ability_dimensions", [])
    assessed = [item for item in dimensions if item.get("assessment_status") != "not_assessed"]

    skills = [
        {
            "name": item.get("label") or item.get("code"),
            "current": int(item.get("score") or 0),
            "previous": int(item.get("score") or 0),
            "match": int(item.get("benchmark") or 0),
            "growth": 0,
        }
        for item in dimensions
    ]
    alerts = [
        {
            "title": f"{item.get('label') or item.get('code')}低于岗位基准",
            "detail": (
                f"当前得分 {int(item.get('score') or 0)}，岗位基准 "
                f"{int(item.get('benchmark') or 0)}，建议优先补齐。"
            ),
        }
        for item in assessed
        if int(item.get("score") or 0) < int(item.get("benchmark") or 0)
    ]
    if not assessed:
        alerts = [
            {
                "title": "尚未完成岗位能力诊断",
                "detail": "当前无真实测评分数，请先完成诊断后再生成个性化差距分析。",
            }
        ]

    recommendations = [
        item.get("title") or item.get("reason")
        for item in payload.get("recommended_path", [])
        if item.get("title") or item.get("reason")
    ]
    if not recommendations:
        recommendations = ["先完成岗位能力诊断，取得真实测评数据后生成学习路径。"]

    safety_notices = payload.get("safety_notices", [])
    safety_notice = "；".join(
        item.get("content", "") if isinstance(item, dict) else str(item)
        for item in safety_notices
        if item
    )
    result = {
        "professional_group": professional_group or payload.get("professional_group"),
        "core_job": core_job or payload.get("job_name"),
        "collected_at": datetime.now(timezone.utc).isoformat(),
        "collection_mode": "student-assessment-projection",
        "source_urls": [value.strip() for value in (source_urls or "").split(",") if value.strip()],
        "sample_count": len(assessed),
        "fetched_count": len(dimensions),
        "skills": skills,
        "alerts": alerts,
        "recommendations": recommendations,
        "optimization_plan": [
            {
                "priority": "高" if index == 0 else "中",
                "target": "岗位能力诊断" if not assessed else "岗位能力提升",
                "action": recommendation,
                "evidence": "真实岗位学习数据投影；未测评时不生成虚假分数",
            }
            for index, recommendation in enumerate(recommendations)
        ],
        "ai_generated": False,
        "safety_notice": safety_notice
        or "岗位能力结果仅用于学习建议，正式教学决策前应由专业教师复核。",
    }
    return JSONResponse(content=result, headers={"X-Plugin-Cache": cache_status})


@app.get("/api/v1/xa/ability-map")
async def get_xa_ability_map(
    user_id: int = Query(default=1001, ge=1),
    course_id: int = Query(default=401, ge=1),
) -> JSONResponse:
    payload, cache_status = await _load_job_learning_overview(user_id, course_id)
    result = {
        "route": "ability_map",
        "user_id": payload.get("user_id"),
        "course_id": payload.get("course_id"),
        "target_job": payload.get("job_name"),
        "assessment_id": payload.get("assessment_id"),
        "assessment_updated_at": payload.get("assessment_updated_at"),
        "ability_dimensions": payload.get("ability_dimensions", []),
        "weak_abilities": payload.get("weak_abilities", []),
        "next_action": payload.get("next_action"),
    }
    return JSONResponse(content=result, headers={"X-Plugin-Cache": cache_status})


@app.get("/api/v1/xa/task-cards")
async def get_xa_task_cards(
    user_id: int = Query(default=1001, ge=1),
    course_id: int = Query(default=401, ge=1),
) -> JSONResponse:
    payload, cache_status = await _load_job_learning_overview(user_id, course_id)
    result = {
        "route": "task_cards",
        "user_id": payload.get("user_id"),
        "course_id": payload.get("course_id"),
        "student_goal": payload.get("student_goal"),
        "task_cards": payload.get("recommended_path", []),
        "recommended_resources": payload.get("recommended_resources", []),
        "safety_notices": payload.get("safety_notices", []),
    }
    return JSONResponse(content=result, headers={"X-Plugin-Cache": cache_status})


@app.get("/api/v1/xa/adaptive-recommendations")
async def get_xa_adaptive_recommendations(
    user_id: int = Query(default=1001, ge=1),
    course_id: int = Query(default=401, ge=1),
) -> JSONResponse:
    payload, cache_status = await _load_job_learning_overview(user_id, course_id)
    result = {
        "route": "adaptive_recommendations",
        "user_id": payload.get("user_id"),
        "course_id": payload.get("course_id"),
        "assessment_id": payload.get("assessment_id"),
        "weak_abilities": payload.get("weak_abilities", []),
        "recommended_path": payload.get("recommended_path", []),
        "recommended_resources": payload.get("recommended_resources", []),
        "citations": payload.get("citations", []),
        "safety_notices": payload.get("safety_notices", []),
        "ai_generated": payload.get("ai_generated", False),
        "next_action": payload.get("next_action"),
    }
    return JSONResponse(content=result, headers={"X-Plugin-Cache": cache_status})


async def _load_job_learning_overview(
    user_id: int,
    course_id: int,
) -> tuple[dict[str, Any], str]:
    cache_key = (user_id, course_id)
    cached = _response_cache.get(cache_key)
    if cached and monotonic() - cached[0] < CACHE_TTL_SECONDS:
        return cached[1], "hit"

    async with _cache_lock:
        cached = _response_cache.get(cache_key)
        if cached and monotonic() - cached[0] < CACHE_TTL_SECONDS:
            return cached[1], "hit"

        try:
            async with httpx.AsyncClient(timeout=40.0, trust_env=False) as client:
                upstream = await client.get(
                    f"{BACKEND_BASE_URL}/api/v1/student-portal/job-learning",
                    params={"user_id": user_id, "course_id": course_id},
                )
            if upstream.status_code != 200:
                raise HTTPException(
                    status_code=502,
                    detail="job-learning backend returned an error",
                )
            payload = upstream.json()
        except (httpx.TimeoutException, httpx.HTTPError) as exc:
            if cached:
                return cached[1], "stale"
            status_code = 504 if isinstance(exc, httpx.TimeoutException) else 502
            detail = (
                "job-learning backend timed out"
                if status_code == 504
                else "job-learning backend unavailable"
            )
            raise HTTPException(status_code=status_code, detail=detail) from exc

        _response_cache[cache_key] = (monotonic(), payload)
        return payload, "miss"
