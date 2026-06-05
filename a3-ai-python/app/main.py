import asyncio
from pathlib import Path
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import ORJSONResponse
from fastapi.staticfiles import StaticFiles

from app.api.router import api_router
from app.core.config import settings
from app.core.logging import configure_logging, get_logger
from app.services.resource_service import ResourceService

configure_logging()
logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI):
    logger.info("ai_service.starting", env=settings.app_env)
    prebuild_task = None
    try:
        prebuild_task = asyncio.create_task(ResourceService().ensure_default_resource_index())
        logger.info("ai_service.resource_index_scheduled")
    except Exception as exc:
        logger.warning("ai_service.resource_index_failed", error=repr(exc))
    yield
    if prebuild_task is not None:
        try:
            await prebuild_task
            logger.info("ai_service.resource_index_ready")
        except Exception as exc:
            logger.warning("ai_service.resource_index_failed", error=repr(exc))
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

repo_root = Path.cwd().resolve().parent
frontend_videos_dir = repo_root / "a3-student-react-web" / "public" / "videos"
if frontend_videos_dir.exists():
    app.mount("/videos", StaticFiles(directory=str(frontend_videos_dir)), name="course-videos")


@app.get("/health", tags=["health"])
async def health() -> dict[str, str]:
    return {"status": "ok", "service": settings.app_name}
