from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.responses import ORJSONResponse

from app.api.router import api_router
from app.core.config import settings
from app.core.logging import configure_logging, get_logger

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
app.include_router(api_router, prefix="/api")


@app.get("/health", tags=["health"])
async def health() -> dict[str, str]:
    return {"status": "ok", "service": settings.app_name}
