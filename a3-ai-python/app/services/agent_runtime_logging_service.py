from __future__ import annotations

from collections.abc import Callable
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Any

from app.core.logging import logger
from app.db.repositories.admin_repository import AgentRuntimeRepository
from app.db.session import async_session_factory


class AgentRuntimeLoggingService:
    @staticmethod
    def _now_iso() -> str:
        return datetime.now(timezone.utc).isoformat()

    @staticmethod
    def _compact_payload(payload: dict[str, Any] | None) -> dict[str, Any] | None:
        if not payload:
            return None
        compact: dict[str, Any] = {}
        for key, value in payload.items():
            if value is None:
                continue
            if isinstance(value, str) and len(value) > 300:
                compact[key] = f"{value[:297]}..."
                continue
            if isinstance(value, list):
                compact[key] = value[:10]
                continue
            compact[key] = value
        return compact or None

    async def log(
        self,
        *,
        agent_name: str,
        status: str,
        message: str,
        level: str = "info",
        payload: dict[str, Any] | None = None,
    ) -> None:
        now_iso = self._now_iso()
        try:
            async with async_session_factory() as session:
                await AgentRuntimeRepository().create_log(
                    session,
                    agent_name=agent_name,
                    level=level,
                    status=status,
                    message=message,
                    payload=self._compact_payload(payload),
                    created_at=now_iso,
                    updated_at=now_iso,
                )
                await session.commit()
        except Exception as exc:
            logger.warning(
                "agent_runtime_logging.failed",
                agent_name=agent_name,
                status=status,
                error=str(exc),
            )

    @asynccontextmanager
    async def track(
        self,
        *,
        agent_name: str,
        start_message: str,
        success_message: str,
        start_payload: dict[str, Any] | None = None,
        success_payload_factory: Callable[[], dict[str, Any] | None] | None = None,
        error_message: str | None = None,
    ):
        await self.log(
            agent_name=agent_name,
            status="in_progress",
            level="info",
            message=start_message,
            payload=start_payload,
        )
        try:
            yield
        except Exception as exc:
            await self.log(
                agent_name=agent_name,
                status="error",
                level="error",
                message=error_message or f"{agent_name} execution failed",
                payload={"error": str(exc), **(start_payload or {})},
            )
            raise
        else:
            success_payload = success_payload_factory() if success_payload_factory else start_payload
            await self.log(
                agent_name=agent_name,
                status="ok",
                level="info",
                message=success_message,
                payload=success_payload,
            )
