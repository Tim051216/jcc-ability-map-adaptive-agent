"""Narrow public gateway used by the Xfyun job-learning plugin demo."""

from __future__ import annotations

import asyncio
import os
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
