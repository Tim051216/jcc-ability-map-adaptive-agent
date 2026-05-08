from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.learning_plan import LearningPlan


class PlanRepository:
    async def latest_by_user_course(
        self,
        session: AsyncSession,
        user_id: int,
        course_code: str,
    ) -> LearningPlan | None:
        stmt = (
            select(LearningPlan)
            .where(LearningPlan.user_id == user_id, LearningPlan.course_code == course_code)
            .order_by(LearningPlan.id.desc())
            .limit(1)
        )
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    async def create_plan(
        self,
        session: AsyncSession,
        *,
        user_id: int,
        course_code: str,
        status: str,
        summary: str,
        plan_data: dict,
        created_at: str,
        updated_at: str,
    ) -> LearningPlan:
        plan = LearningPlan(
            user_id=user_id,
            course_code=course_code,
            status=status,
            summary=summary,
            plan_data=plan_data,
            created_at=created_at,
            updated_at=updated_at,
        )
        session.add(plan)
        await session.flush()
        return plan
