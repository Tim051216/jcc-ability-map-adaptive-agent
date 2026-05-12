from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.evaluation_record import EvaluationRecord


class EvaluationRepository:
    async def get_by_id(self, session: AsyncSession, record_id: int) -> EvaluationRecord | None:
        return await session.get(EvaluationRecord, record_id)

    async def list_by_user_course(
        self,
        session: AsyncSession,
        *,
        user_id: int,
        course_code: str,
        evaluation_type: str | None = None,
        limit: int = 10,
    ) -> list[EvaluationRecord]:
        stmt = select(EvaluationRecord).where(
            EvaluationRecord.user_id == user_id,
            EvaluationRecord.course_code == course_code,
        )
        if evaluation_type:
            stmt = stmt.where(EvaluationRecord.evaluation_type == evaluation_type)
        stmt = stmt.order_by(EvaluationRecord.id.desc()).limit(limit)
        result = await session.execute(stmt)
        return list(result.scalars().all())

    async def latest_by_user_course(
        self,
        session: AsyncSession,
        user_id: int,
        course_code: str,
    ) -> EvaluationRecord | None:
        stmt = (
            select(EvaluationRecord)
            .where(EvaluationRecord.user_id == user_id, EvaluationRecord.course_code == course_code)
            .order_by(EvaluationRecord.id.desc())
            .limit(1)
        )
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    async def create_record(
        self,
        session: AsyncSession,
        *,
        user_id: int,
        course_code: str,
        evaluation_type: str,
        result_data: dict,
        created_at: str,
        updated_at: str,
    ) -> EvaluationRecord:
        record = EvaluationRecord(
            user_id=user_id,
            course_code=course_code,
            evaluation_type=evaluation_type,
            result_data=result_data,
            created_at=created_at,
            updated_at=updated_at,
        )
        session.add(record)
        await session.flush()
        return record
