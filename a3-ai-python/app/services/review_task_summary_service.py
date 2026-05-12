from collections import Counter

from app.db.repositories.admin_repository import ReviewTaskRepository
from app.db.session import async_session_factory
from app.schemas.admin import ReviewTaskSummaryResponse


class ReviewTaskSummaryService:
    async def get_summary(self) -> ReviewTaskSummaryResponse:
        async with async_session_factory() as session:
            items, total = await ReviewTaskRepository().list_tasks(session)

        by_status = Counter(item.status for item in items)
        by_priority = Counter(item.priority for item in items)
        by_source_scene = Counter(item.source_scene for item in items)
        pending_count = by_status.get("pending", 0)
        latest_review_at = max((item.updated_at for item in items if item.updated_at), default=None)

        return ReviewTaskSummaryResponse(
            total=total,
            pending_count=pending_count,
            by_status=dict(by_status),
            by_priority=dict(by_priority),
            by_source_scene=dict(by_source_scene),
            latest_review_at=latest_review_at,
        )
