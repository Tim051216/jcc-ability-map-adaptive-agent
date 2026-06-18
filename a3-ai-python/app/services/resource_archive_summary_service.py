from collections import Counter

from app.db.repositories.resource_repository import ResourceRepository
from app.db.session import ai_data_session_factory
from app.schemas.resource import ResourceArchiveSummaryResponse


class ResourceArchiveSummaryService:
    async def get_summary(self, *, user_id: int) -> ResourceArchiveSummaryResponse:
        async with ai_data_session_factory() as session:
            archived_resources, _ = await ResourceRepository().list_resources(
                session,
                user_id=user_id,
                archived_only=True,
            )

        by_type = Counter(item.resource_type for item in archived_resources)
        by_archived_by = Counter((item.archived_by or "unknown") for item in archived_resources)
        latest_archived_at = max((item.archived_at for item in archived_resources if item.archived_at), default=None)
        return ResourceArchiveSummaryResponse(
            user_id=user_id,
            total=len(archived_resources),
            by_type=dict(by_type),
            by_archived_by=dict(by_archived_by),
            latest_archived_at=latest_archived_at,
        )
