from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.evaluation_paper import EvaluationAnswer, EvaluationPaper


class EvaluationPaperRepository:
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

    async def create_answer(
        self,
        session: AsyncSession,
        *,
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
