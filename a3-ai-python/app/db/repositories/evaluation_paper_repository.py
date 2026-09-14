from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.evaluation_paper import EvaluationAnswer, EvaluationPaper


class EvaluationPaperRepository:
    @staticmethod
    async def _realign_answer_sequence(session: AsyncSession) -> None:
        bind = session.get_bind()
        if bind is None or bind.dialect.name != "postgresql":
            # SQLite/MySQL do not expose PostgreSQL's sequence helpers.  The
            # caller already assigns a collision-free id from MAX(id), so no
            # realignment is necessary for those local/demo backends.
            return
        await session.execute(
            text(
                """
                SELECT setval(
                    pg_get_serial_sequence('evaluation_answer', 'id'),
                    COALESCE((SELECT MAX(id) FROM evaluation_answer), 0) + 1,
                    false
                )
                """
            )
        )

    async def list_papers_by_user(
        self,
        session: AsyncSession,
        *,
        user_id: int,
        course_code: str | None = None,
        limit: int = 10,
    ) -> list[EvaluationPaper]:
        stmt = select(EvaluationPaper).where(EvaluationPaper.user_id == user_id)
        if course_code:
            stmt = stmt.where(EvaluationPaper.course_code == course_code)
        stmt = stmt.order_by(EvaluationPaper.id.desc()).limit(limit)
        result = await session.execute(stmt)
        return list(result.scalars().all())

    async def create_paper(
        self,
        session: AsyncSession,
        *,
        user_id: int,
        course_code: str,
        paper_type: str,
        status: str,
        questions_data: list[dict],
        created_at: str,
        updated_at: str,
    ) -> EvaluationPaper:
        paper = EvaluationPaper(
            user_id=user_id,
            course_code=course_code,
            paper_type=paper_type,
            status=status,
            questions_data=questions_data,
            created_at=created_at,
            updated_at=updated_at,
        )
        session.add(paper)
        await session.flush()
        return paper

    async def get_paper(self, session: AsyncSession, paper_id: int) -> EvaluationPaper | None:
        return await session.get(EvaluationPaper, paper_id)

    async def get_next_answer_id(self, session: AsyncSession) -> int:
        result = await session.execute(select(func.coalesce(func.max(EvaluationAnswer.id), 0) + 1))
        return int(result.scalar_one())

    async def create_answer(
        self,
        session: AsyncSession,
        *,
        answer_id: int | None = None,
        paper_id: int,
        user_id: int,
        question_id: str,
        question_type: str,
        prompt: str,
        knowledge_point: str,
        user_answer: str,
        correct_answer: str,
        is_correct: bool,
        explanation: str,
        created_at: str,
        updated_at: str,
    ) -> EvaluationAnswer:
        answer = EvaluationAnswer(
            id=answer_id,
            paper_id=paper_id,
            user_id=user_id,
            question_id=question_id,
            question_type=question_type,
            prompt=prompt,
            knowledge_point=knowledge_point,
            user_answer=user_answer,
            correct_answer=correct_answer,
            is_correct=is_correct,
            explanation=explanation,
            created_at=created_at,
            updated_at=updated_at,
        )
        session.add(answer)
        await session.flush()
        return answer

    async def list_wrong_answers_by_paper(
        self,
        session: AsyncSession,
        *,
        paper_id: int,
        user_id: int,
    ) -> list[EvaluationAnswer]:
        stmt = (
            select(EvaluationAnswer)
            .where(
                EvaluationAnswer.paper_id == paper_id,
                EvaluationAnswer.user_id == user_id,
                EvaluationAnswer.is_correct.is_(False),
            )
            .order_by(EvaluationAnswer.id.asc())
        )
        result = await session.execute(stmt)
        return list(result.scalars().all())
