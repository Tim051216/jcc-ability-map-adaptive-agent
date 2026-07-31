from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import ORJSONResponse

from app.api.router import api_router
from app.core.config import settings
from app.core.logging import configure_logging, get_logger
from app.harness.runtime import emit as harness_emit
from app.harness.runtime import run_scope

configure_logging()
logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI):
    logger.info("ai_service.starting", env=settings.app_env)
    yield
    logger.info("ai_service.stopping")


app = FastAPI(
    title=settings.app_name,
    debug=settings.app_debug,
    default_response_class=ORJSONResponse,
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:3000",
        "http://localhost:3000",
        "http://127.0.0.1:3002",
        "http://localhost:3002",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(api_router, prefix="/api")


@app.middleware("http")
async def harness_request_context(request, call_next):
    if request.url.path in {"/health", "/docs", "/openapi.json", "/redoc"}:
        return await call_next(request)
    async with run_scope(
        kind="http_request",
        input_data={
            "method": request.method,
            "path": request.url.path,
        },
        metadata={"query_keys": sorted(request.query_params.keys())},
    ) as recorder:
        response = await call_next(request)
        response.headers["X-Agent-Run-Id"] = recorder.run_id
        harness_emit("http_response", status_code=response.status_code)
        return response


@app.get("/health", tags=["health"])
async def health() -> dict[str, str]:
    return {"status": "ok", "service": settings.app_name}
