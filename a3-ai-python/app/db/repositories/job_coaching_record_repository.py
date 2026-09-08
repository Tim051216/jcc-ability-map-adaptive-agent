from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.job_coaching_record import JobCoachingRecord


class JobCoachingRecordRepository:
    async def create(
        self,
        session: AsyncSession,
        *,
        user_id: int,
        course_id: int,
        source: str,
        user_question: str,
        advice_summary: str,
        recommended_actions: list[str],
        created_at: str,
        updated_at: str,
    ) -> JobCoachingRecord:
        record = JobCoachingRecord(
            user_id=user_id,
            course_id=course_id,
            source=source,
            user_question=user_question,
            advice_summary=advice_summary,
            recommended_actions=recommended_actions,
            created_at=created_at,
            updated_at=updated_at,
        )
        session.add(record)
        await session.flush()
        return record

    async def list_by_user_course(
        self,
        session: AsyncSession,
        *,
        user_id: int,
        course_id: int,
        limit: int,
    ) -> tuple[list[JobCoachingRecord], int]:
        filters = (
            JobCoachingRecord.user_id == user_id,
            JobCoachingRecord.course_id == course_id,
        )
        total = await session.scalar(
            select(func.count(JobCoachingRecord.id)).where(*filters)
        )
        result = await session.execute(
            select(JobCoachingRecord)
            .where(*filters)
            .order_by(JobCoachingRecord.id.desc())
            .limit(limit)
        )
        return list(result.scalars().all()), int(total or 0)

    async def get_by_id_user(
        self,
        session: AsyncSession,
        *,
        record_id: int,
        user_id: int,
    ) -> JobCoachingRecord | None:
        result = await session.execute(
            select(JobCoachingRecord).where(
                JobCoachingRecord.id == record_id,
                JobCoachingRecord.user_id == user_id,
            )
        )
        return result.scalar_one_or_none()

    async def summarize_by_user_course(
        self,
        session: AsyncSession,
        *,
        user_id: int,
        course_id: int,
    ) -> dict[str, int | float | None]:
        result = await session.execute(
            select(
                JobCoachingRecord.status,
                JobCoachingRecord.helpful,
                JobCoachingRecord.rating,
            ).where(
                JobCoachingRecord.user_id == user_id,
                JobCoachingRecord.course_id == course_id,
            )
        )
        rows = result.all()
        status_counts = {
            "planned": 0,
            "in_progress": 0,
            "completed": 0,
            "abandoned": 0,
        }
        ratings: list[int] = []
        helpful_count = 0
        for status, helpful, rating in rows:
            if status in status_counts:
                status_counts[status] += 1
            if helpful is True:
                helpful_count += 1
            if rating is not None:
                ratings.append(int(rating))
        total = len(rows)
        return {
            "total": total,
            **status_counts,
            "completion_rate": round(status_counts["completed"] * 100 / total, 1)
            if total
            else 0.0,
            "helpful_count": helpful_count,
            "rated_count": len(ratings),
            "average_rating": round(sum(ratings) / len(ratings), 2)
            if ratings
            else None,
        }

    async def update_feedback(
        self,
        session: AsyncSession,
        *,
        record: JobCoachingRecord,
        status: str,
        helpful: bool | None,
        rating: int | None,
        feedback_note: str | None,
        updated_at: str,
    ) -> JobCoachingRecord:
        record.status = status
        record.helpful = helpful
        record.rating = rating
        record.feedback_note = feedback_note
        record.updated_at = updated_at
        await session.flush()
        return record
