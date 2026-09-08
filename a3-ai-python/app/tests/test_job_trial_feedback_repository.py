import asyncio

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.db.models.job_trial_feedback import JobTrialFeedback
from app.db.repositories.job_trial_feedback_repository import (
    JobTrialFeedbackRepository,
)


def test_job_trial_feedback_is_scoped_to_user_and_course() -> None:
    async def run() -> None:
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        session_factory = async_sessionmaker(
            engine,
            class_=AsyncSession,
            expire_on_commit=False,
        )
        async with engine.begin() as connection:
            await connection.run_sync(JobTrialFeedback.__table__.create)

        async with session_factory() as session:
            repository = JobTrialFeedbackRepository()
            feedback = await repository.create(
                session,
                user_id=1001,
                course_id=401,
                participant_role="student",
                identity_description="软件技术专业二年级学生",
                trial_task="完成岗位诊断并执行一条学习建议",
                strengths="步骤清晰，能看到薄弱项。",
                problems="首次进入时不清楚从哪里开始。",
                improvement_suggestions="突出显示开始诊断按钮。",
                overall_rating=4,
                consent_to_quote=True,
                created_at="2026-08-08T16:00:00+08:00",
                updated_at="2026-08-08T16:00:00+08:00",
            )
            await session.commit()
            own_records, own_total = await repository.list_by_user_course(
                session,
                user_id=1001,
                course_id=401,
                limit=20,
            )
            other_records, other_total = await repository.list_by_user_course(
                session,
                user_id=2002,
                course_id=401,
                limit=20,
            )

        await engine.dispose()

        assert feedback.id is not None
        assert own_total == 1
        assert own_records[0].overall_rating == 4
        assert other_total == 0
        assert other_records == []

    asyncio.run(run())
