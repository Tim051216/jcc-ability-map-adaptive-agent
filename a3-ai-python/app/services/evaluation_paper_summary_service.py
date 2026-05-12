from collections import Counter

from app.db.repositories.evaluation_paper_repository import EvaluationPaperRepository
from app.db.session import async_session_factory
from app.schemas.evaluation import EvaluationPaperSummaryResponse


class EvaluationPaperSummaryService:
    async def get_summary(
        self,
        *,
        user_id: int,
        course_code: str | None = None,
        limit: int = 10,
    ) -> EvaluationPaperSummaryResponse:
        async with async_session_factory() as session:
            papers = await EvaluationPaperRepository().list_papers_by_user(
                session,
                user_id=user_id,
                course_code=course_code,
                limit=limit,
            )

        by_paper_type = Counter(item.paper_type for item in papers)
        by_question_type: Counter[str] = Counter()
        by_knowledge_point: Counter[str] = Counter()
        total_questions = 0
        for paper in papers:
            questions = list(paper.questions_data or [])
            total_questions += len(questions)
            for question in questions:
                by_question_type[question.get("question_type", "single_choice")] += 1
                knowledge_point = question.get("knowledge_point")
                if knowledge_point:
                    by_knowledge_point[knowledge_point] += 1

        return EvaluationPaperSummaryResponse(
            user_id=user_id,
            course_code=course_code,
            total=len(papers),
            total_questions=total_questions,
            by_paper_type=dict(by_paper_type),
            by_question_type=dict(by_question_type),
            by_knowledge_point=dict(by_knowledge_point),
            latest_paper_at=papers[0].updated_at if papers else None,
        )
