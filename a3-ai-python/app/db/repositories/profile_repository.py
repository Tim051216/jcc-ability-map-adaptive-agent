from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.user_profile import UserProfileSnapshot


class ProfileRepository:
    async def latest_by_user(self, session: AsyncSession, user_id: int) -> UserProfileSnapshot | None:
        stmt = (
            select(UserProfileSnapshot)
            .where(UserProfileSnapshot.user_id == user_id)
            .order_by(UserProfileSnapshot.id.desc())
            .limit(1)
        )
        result = await session.execute(stmt)
        return result.scalar_one_or_none()
