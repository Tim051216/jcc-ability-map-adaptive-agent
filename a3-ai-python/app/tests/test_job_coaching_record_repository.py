import asyncio

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.db.models.job_coaching_record import JobCoachingRecord
from app.db.repositories.job_coaching_record_repository import (
    JobCoachingRecordRepository,
)


def test_job_coaching_record_repository_round_trip() -> None:
    async def run() -> None:
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        session_factory = async_sessionmaker(
            engine,
            class_=AsyncSession,
            expire_on_commit=False,
        )
        async with engine.begin() as connection:
            await connection.run_sync(JobCoachingRecord.__table__.create)

        async with session_factory() as session:
            repository = JobCoachingRecordRepository()
            record = await repository.create(
                session,
                user_id=1001,
                course_id=401,
                source="xfyun_workflow",
                user_question="如何提升系统设计能力？",
                advice_summary="先完成模块划分练习。",
                recommended_actions=["完成模块划分练习"],
                created_at="2026-08-05T16:20:00+08:00",
                updated_at="2026-08-05T16:20:00+08:00",
            )
            await session.commit()

            records, total = await repository.list_by_user_course(
                session,
                user_id=1001,
                course_id=401,
                limit=20,
            )
            hidden = await repository.get_by_id_user(
                session,
                record_id=record.id,
                user_id=2002,
            )
            updated = await repository.update_feedback(
                session,
                record=record,
                status="completed",
                helpful=True,
                rating=5,
                feedback_note="已经完成。",
                updated_at="2026-08-05T17:00:00+08:00",
            )
            await session.commit()

        await engine.dispose()

        assert total == 1
        assert records[0].recommended_actions == ["完成模块划分练习"]
        assert hidden is None
        assert updated.status == "completed"
        assert updated.rating == 5

    asyncio.run(run())
