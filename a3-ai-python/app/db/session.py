from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path
import time
from urllib.parse import urlparse

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings
from app.core.logging import logger
from app.db.base import Base
import app.db.models  # noqa: F401


def _build_engine(dsn: str) -> AsyncEngine:
    parsed = urlparse(dsn)
    if parsed.scheme.startswith("sqlite"):
        return create_async_engine(
            dsn,
            future=True,
            echo=False,
        )

    host = (parsed.hostname or "").strip().lower()
    is_local = host in {"127.0.0.1", "localhost"}
    connect_args: dict[str, object] = {
        "timeout": 4 if is_local else 3,
        "command_timeout": 12,
    }
    if is_local:
        # Docker-mapped local PG should not waste time on SSL negotiation.
        connect_args["ssl"] = False
    return create_async_engine(
        dsn,
        future=True,
        echo=False,
        pool_pre_ping=True,
        pool_recycle=30,
        pool_timeout=5,
        connect_args=connect_args,
    )


primary_engine = _build_engine(settings.postgres_dsn)
local_engine = _build_engine(settings.local_postgres_dsn or settings.postgres_dsn)
sqlite_dsn = f"sqlite+aiosqlite:///{(Path(__file__).resolve().parents[2] / 'local_data' / 'a3_ai_local.db').as_posix()}"
sqlite_engine = _build_engine(sqlite_dsn)
ai_data_engine = sqlite_engine
engine = local_engine

primary_session_factory = async_sessionmaker(primary_engine, class_=AsyncSession, expire_on_commit=False)
local_session_factory = async_sessionmaker(local_engine, class_=AsyncSession, expire_on_commit=False)
sqlite_session_factory = async_sessionmaker(sqlite_engine, class_=AsyncSession, expire_on_commit=False)
ai_data_session_factory = sqlite_session_factory

_PROBE_CACHE_TTL_SECONDS = 8.0
_probe_cache: dict[str, tuple[float, bool]] = {}
_sqlite_schema_ready = False


async def _ensure_sqlite_chat_session_columns() -> None:
    async with sqlite_engine.begin() as connection:
        table_info = await connection.execute(text("PRAGMA table_info(chat_session)"))
        columns = {str(row[1]) for row in table_info.fetchall()}
        if "peer_user_id" not in columns:
            await connection.execute(text("ALTER TABLE chat_session ADD COLUMN peer_user_id BIGINT"))
        if "peer_name" not in columns:
            await connection.execute(text("ALTER TABLE chat_session ADD COLUMN peer_name VARCHAR(255)"))


async def _probe_engine(engine: AsyncEngine, dsn: str, backend: str) -> bool:
    now = time.monotonic()
    cached = _probe_cache.get(backend)
    if cached and now - cached[0] < _PROBE_CACHE_TTL_SECONDS:
        return cached[1]
    try:
        async with engine.connect() as connection:
            await connection.execute(text("SELECT 1"))
        logger.info("db.session.probe_ok", backend=backend, dsn=dsn)
        _probe_cache[backend] = (now, True)
        return True
    except Exception as exc:
        logger.warning("db.session.probe_failed", backend=backend, dsn=dsn, error=repr(exc))
        _probe_cache[backend] = (now, False)
        return False


async def probe_primary_db() -> bool:
    return await _probe_engine(primary_engine, settings.postgres_dsn, "postgresql_primary")


async def probe_local_db() -> bool:
    if not settings.local_postgres_dsn:
        return False
    return await _probe_engine(local_engine, settings.local_postgres_dsn, "postgresql_local")


async def ensure_sqlite_schema() -> None:
    global _sqlite_schema_ready
    if _sqlite_schema_ready:
        return
    async with sqlite_engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    await _ensure_sqlite_chat_session_columns()
    _sqlite_schema_ready = True
    logger.warning("db.session.sqlite_schema_ready", dsn=sqlite_dsn)


@asynccontextmanager
async def get_db() -> AsyncIterator[AsyncSession]:
    """Provide a reusable async DB session context for service-layer code."""
    if settings.local_demo_sqlite_only:
        await ensure_sqlite_schema()
        logger.warning(
            "db.session.using_sqlite_forced",
            backend="sqlite_local",
            dsn=sqlite_dsn,
        )
        async with sqlite_session_factory() as session:
            yield session
        return

    if await probe_local_db():
        logger.warning("db.session.using_local_fallback", backend="postgresql_local", dsn=settings.local_postgres_dsn)
        async with local_session_factory() as session:
            yield session
        return

    if await probe_primary_db():
        logger.info("db.session.using_primary", backend="postgresql_primary", dsn=settings.postgres_dsn)
        async with primary_session_factory() as session:
            yield session
        return

    await ensure_sqlite_schema()
    logger.warning(
        "db.session.using_sqlite_fallback",
        backend="sqlite_local",
        dsn=sqlite_dsn,
        primary=settings.postgres_dsn,
        local=settings.local_postgres_dsn or "unset",
    )
    async with sqlite_session_factory() as session:
        yield session


@asynccontextmanager
async def get_ai_data_db() -> AsyncIterator[AsyncSession]:
    await ensure_sqlite_schema()
    async with ai_data_session_factory() as session:
        yield session


# For the local demo app, keep service-layer reads/writes aligned with the
# seeded SQLite knowledge/profile/resource store instead of drifting to a
# separate local PostgreSQL instance with different data.
async_session_factory = sqlite_session_factory
