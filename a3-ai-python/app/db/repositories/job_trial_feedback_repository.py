from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.job_trial_feedback import JobTrialFeedback


class JobTrialFeedbackRepository:
    async def create(
        self,
        session: AsyncSession,
        **values,
    ) -> JobTrialFeedback:
        feedback = JobTrialFeedback(**values)
        session.add(feedback)
        await session.flush()
        return feedback

    async def list_by_user_course(
        self,
        session: AsyncSession,
        *,
        user_id: int,
        course_id: int,
        limit: int,
    ) -> tuple[list[JobTrialFeedback], int]:
        filters = (
            JobTrialFeedback.user_id == user_id,
            JobTrialFeedback.course_id == course_id,
        )
        total = await session.scalar(
            select(func.count(JobTrialFeedback.id)).where(*filters)
        )
        result = await session.execute(
            select(JobTrialFeedback)
            .where(*filters)
            .order_by(JobTrialFeedback.id.desc())
            .limit(limit)
        )
        return list(result.scalars().all()), int(total or 0)
