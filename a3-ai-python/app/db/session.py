from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings

engine = create_async_engine(settings.postgres_dsn, future=True, echo=settings.app_debug)
async_session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


@asynccontextmanager
async def get_db() -> AsyncIterator[AsyncSession]:
    """Provide a reusable async DB session context for service-layer code."""
    async with async_session_factory() as session:
        yield session
