from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.personalized_learning_state import PersonalizedLearningState


class PersonalizedLearningStateRepository:
    async def get_by_user_course(
        self,
        session: AsyncSession,
        *,
        user_id: int,
        course_id: int,
    ) -> PersonalizedLearningState | None:
        stmt = select(PersonalizedLearningState).where(
            PersonalizedLearningState.user_id == user_id,
            PersonalizedLearningState.course_id == course_id,
        )
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    async def upsert_state(
        self,
        session: AsyncSession,
        *,
        user_id: int,
        course_id: int,
        total_watched_seconds: int,
        completed_sections: list[int],
        last_event_type: str,
        created_at: str,
        updated_at: str,
    ) -> PersonalizedLearningState:
        current = await self.get_by_user_course(session, user_id=user_id, course_id=course_id)
        if current is None:
            current = PersonalizedLearningState(
                user_id=user_id,
                course_id=course_id,
                total_watched_seconds=total_watched_seconds,
                completed_sections=completed_sections,
                last_event_type=last_event_type,
                created_at=created_at,
                updated_at=updated_at,
            )
            session.add(current)
            await session.flush()
            return current
        current.total_watched_seconds = total_watched_seconds
        current.completed_sections = completed_sections
        current.last_event_type = last_event_type
        current.updated_at = updated_at
        await session.flush()
        return current
