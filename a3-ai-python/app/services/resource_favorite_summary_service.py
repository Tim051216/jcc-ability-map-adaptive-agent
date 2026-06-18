from collections import Counter

from app.db.repositories.resource_repository import ResourceRepository
from app.db.session import ai_data_session_factory
from app.schemas.resource import ResourceFavoriteSummaryResponse


class ResourceFavoriteSummaryService:
    async def get_summary(self, *, user_id: int) -> ResourceFavoriteSummaryResponse:
        async with ai_data_session_factory() as session:
            favorites = await ResourceRepository().list_favorites(session, user_id=user_id)
            history = await ResourceRepository().list_favorite_history(session, user_id=user_id)

        by_type = Counter(item.resource_type for item in favorites)
        latest_favorite_at = next(
            (item.created_at for item in history if item.action == "favorite" and item.created_at),
            None,
        )
        return ResourceFavoriteSummaryResponse(
            user_id=user_id,
            total=len(favorites),
            by_type=dict(by_type),
            latest_favorite_at=latest_favorite_at,
        )
