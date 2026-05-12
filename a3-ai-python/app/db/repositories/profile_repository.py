from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.user_profile import UserProfileSnapshot


class ProfileRepository:
    async def list_by_user(
        self,
        session: AsyncSession,
        user_id: int,
        *,
        limit: int = 10,
    ) -> list[UserProfileSnapshot]:
        stmt = (
            select(UserProfileSnapshot)
            .where(UserProfileSnapshot.user_id == user_id)
            .order_by(UserProfileSnapshot.id.desc())
            .limit(limit)
        )
        result = await session.execute(stmt)
        return list(result.scalars().all())

    async def latest_by_user(self, session: AsyncSession, user_id: int) -> UserProfileSnapshot | None:
        stmt = (
            select(UserProfileSnapshot)
            .where(UserProfileSnapshot.user_id == user_id)
            .order_by(UserProfileSnapshot.id.desc())
            .limit(1)
        )
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    async def create_snapshot(
        self,
        session: AsyncSession,
        *,
        user_id: int,
        version: int,
        profile_data: dict,
        source_summary: str | None,
        created_at: str,
        updated_at: str,
    ) -> UserProfileSnapshot:
        snapshot = UserProfileSnapshot(
            user_id=user_id,
            version=version,
            profile_data=profile_data,
            source_summary=source_summary,
            created_at=created_at,
            updated_at=updated_at,
        )
        session.add(snapshot)
        await session.flush()
        return snapshot
