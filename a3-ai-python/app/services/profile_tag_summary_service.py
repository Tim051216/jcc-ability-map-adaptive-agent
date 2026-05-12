from collections import Counter

from app.db.repositories.profile_repository import ProfileRepository
from app.db.session import async_session_factory
from app.schemas.profile import ProfileTagSummaryResponse


class ProfileTagSummaryService:
    async def get_summary(self, *, user_id: int, limit: int = 10) -> ProfileTagSummaryResponse:
        async with async_session_factory() as session:
            snapshots = await ProfileRepository().list_by_user(session, user_id, limit=limit)

        tag_counter: Counter[str] = Counter()
        resource_counter: Counter[str] = Counter()
        for snapshot in snapshots:
            profile_data = snapshot.profile_data or {}
            tag_counter.update(profile_data.get("profile_tags", []))
            resource_counter.update(profile_data.get("recommended_resource_types", []))

        return ProfileTagSummaryResponse(
            user_id=user_id,
            total_snapshots=len(snapshots),
            by_tag=dict(tag_counter),
            by_resource_type=dict(resource_counter),
            latest_updated_at=snapshots[0].updated_at if snapshots else None,
        )
