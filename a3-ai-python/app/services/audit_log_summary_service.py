from collections import Counter

from app.db.repositories.admin_repository import AuditLogRepository
from app.db.session import async_session_factory
from app.schemas.admin import AuditLogSummaryResponse


class AuditLogSummaryService:
    async def get_summary(
        self,
        *,
        scene: str | None = None,
        action: str | None = None,
    ) -> AuditLogSummaryResponse:
        async with async_session_factory() as session:
            items, total = await AuditLogRepository().list_logs(session, scene=scene, action=action)

        by_scene = Counter(item.scene for item in items)
        by_action = Counter(item.action for item in items)
        latest_log_at = max((item.created_at for item in items if item.created_at), default=None)

        return AuditLogSummaryResponse(
            total=total,
            by_scene=dict(by_scene),
            by_action=dict(by_action),
            latest_log_at=latest_log_at,
        )
