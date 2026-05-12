from collections import Counter

from app.db.repositories.admin_repository import SystemConfigRepository
from app.db.session import async_session_factory
from app.schemas.admin import SystemConfigSummaryResponse
from app.services.admin_service import AdminService


class SystemConfigSummaryService:
    async def get_summary(self) -> SystemConfigSummaryResponse:
        async with async_session_factory() as session:
            items = await SystemConfigRepository().list_configs(session)

        by_prefix = Counter(self._extract_prefix(item.config_key) for item in items)
        sensitive_count = sum(1 for item in items if AdminService._is_sensitive_config_key(item.config_key))
        latest_updated_at = max((item.updated_at for item in items if item.updated_at), default=None)

        return SystemConfigSummaryResponse(
            total=len(items),
            sensitive_count=sensitive_count,
            by_prefix=dict(by_prefix),
            latest_updated_at=latest_updated_at,
        )

    @staticmethod
    def _extract_prefix(config_key: str | None) -> str:
        if not config_key:
            return "unknown"
        return config_key.split(".", 1)[0]
