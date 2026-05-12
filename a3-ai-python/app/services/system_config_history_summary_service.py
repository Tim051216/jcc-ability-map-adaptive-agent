from collections import Counter

from app.db.repositories.admin_repository import AuditLogRepository
from app.db.session import async_session_factory
from app.schemas.admin import SystemConfigHistorySummaryResponse


class SystemConfigHistorySummaryService:
    async def get_summary(
        self,
        *,
        config_key: str | None = None,
        updated_by: str | None = None,
    ) -> SystemConfigHistorySummaryResponse:
        async with async_session_factory() as session:
            logs, _ = await AuditLogRepository().list_logs(
                session,
                scene="system_config",
                action="system_config_updated",
            )

        by_config_key: Counter[str] = Counter()
        by_updated_by_counter: Counter[str] = Counter()
        latest_created_at = None
        total = 0
        for log in logs:
            payload = log.payload or {}
            log_config_key = payload.get("config_key") or ""
            log_updated_by = payload.get("updated_by") or "unknown"
            if config_key and log_config_key != config_key:
                continue
            if updated_by and log_updated_by != updated_by:
                continue
            total += 1
            by_config_key[log_config_key] += 1
            by_updated_by_counter[log_updated_by] += 1
            if log.created_at and (latest_created_at is None or log.created_at > latest_created_at):
                latest_created_at = log.created_at

        return SystemConfigHistorySummaryResponse(
            total=total,
            by_config_key=dict(by_config_key),
            by_updated_by=dict(by_updated_by_counter),
            latest_created_at=latest_created_at,
        )
