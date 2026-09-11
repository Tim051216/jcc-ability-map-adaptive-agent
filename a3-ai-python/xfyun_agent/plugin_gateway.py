"""Narrow public gateway used by the Xfyun job-learning plugin demo."""

from __future__ import annotations

import asyncio
import os
from time import monotonic
from typing import Any

import httpx
from fastapi import Body, FastAPI, HTTPException, Query
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
    cache_key = (user_id, course_id)
    cached = _response_cache.get(cache_key)
    if cached and monotonic() - cached[0] < CACHE_TTL_SECONDS:
        return JSONResponse(content=cached[1], headers={"X-Plugin-Cache": "hit"})

    async with _cache_lock:
        cached = _response_cache.get(cache_key)
        if cached and monotonic() - cached[0] < CACHE_TTL_SECONDS:
            return JSONResponse(content=cached[1], headers={"X-Plugin-Cache": "hit"})

        try:
            async with httpx.AsyncClient(timeout=40.0) as client:
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
                return JSONResponse(
                    content=cached[1],
                    headers={"X-Plugin-Cache": "stale"},
                )
            status_code = 504 if isinstance(exc, httpx.TimeoutException) else 502
            detail = (
                "job-learning backend timed out"
                if status_code == 504
                else "job-learning backend unavailable"
            )
            raise HTTPException(status_code=status_code, detail=detail) from exc

        _response_cache[cache_key] = (monotonic(), payload)
        return JSONResponse(content=payload, headers={"X-Plugin-Cache": "miss"})


async def _proxy_xa(path: str, *, params: dict[str, Any] | None = None, json_body: dict[str, Any] | None = None) -> JSONResponse:
    """Proxy the four XA-202603 capabilities without exposing backend internals."""
    try:
        async with httpx.AsyncClient(timeout=40.0) as client:
            upstream = await client.request("POST" if json_body is not None else "GET", f"{BACKEND_BASE_URL}{path}", params=params, json=json_body)
        if upstream.status_code != 200:
            raise HTTPException(status_code=502, detail="XA capability backend returned an error")
        return JSONResponse(content=upstream.json(), headers={"X-Plugin-Cache": "bypass"})
    except (httpx.TimeoutException, httpx.HTTPError) as exc:
        raise HTTPException(status_code=504 if isinstance(exc, httpx.TimeoutException) else 502, detail="XA capability backend unavailable") from exc


@app.get("/api/v1/xa-competition/industry/jobs-analysis")
async def xa_industry_jobs_analysis(
    refresh: bool = Query(default=False),
    professional_group: str = Query(default="软件技术专业群", min_length=2, max_length=80),
    core_job: str | None = Query(default=None, max_length=80),
    source_urls: str | None = Query(default=None, max_length=2000),
) -> JSONResponse:
    params: dict[str, Any] = {"refresh": refresh, "professional_group": professional_group}
    if core_job:
        params["core_job"] = core_job
    if source_urls:
        params["source_urls"] = source_urls
    return await _proxy_xa("/api/v1/xa-competition/industry/jobs-analysis", params=params)


@app.get("/api/v1/xa-competition/industry/professional-groups")
async def xa_professional_groups(refresh: bool = Query(default=False), source_urls: str | None = Query(default=None, max_length=2000)) -> JSONResponse:
    params: dict[str, Any] = {"refresh": refresh}
    if source_urls:
        params["source_urls"] = source_urls
    return await _proxy_xa("/api/v1/xa-competition/industry/professional-groups", params=params)


@app.post("/api/v1/xa-competition/job-ability/generate")
async def xa_job_ability_generate(payload: dict[str, Any] = Body(...)) -> JSONResponse:
    return await _proxy_xa("/api/v1/xa-competition/job-ability/generate", json_body=payload)


@app.post("/api/v1/xa-competition/learning-task/generate")
async def xa_learning_task_generate(payload: dict[str, Any] = Body(...)) -> JSONResponse:
    return await _proxy_xa("/api/v1/xa-competition/learning-task/generate", json_body=payload)


@app.post("/api/v1/xa-competition/adaptive-learning/recommend")
async def xa_adaptive_learning_recommend(payload: dict[str, Any] = Body(...)) -> JSONResponse:
    return await _proxy_xa("/api/v1/xa-competition/adaptive-learning/recommend", json_body=payload)
