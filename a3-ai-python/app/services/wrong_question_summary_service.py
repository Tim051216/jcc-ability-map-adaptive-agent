from collections import Counter

from fastapi import HTTPException

from app.db.repositories.evaluation_paper_repository import EvaluationPaperRepository
from app.db.repositories.evaluation_repository import EvaluationRepository
from app.db.session import async_session_factory
from app.schemas.evaluation import WrongQuestionSummaryResponse


class WrongQuestionSummaryService:
    async def get_summary(self, record_id: int) -> WrongQuestionSummaryResponse:
        async with async_session_factory() as session:
            record = await EvaluationRepository().get_by_id(session, record_id)
            if record is None:
                raise HTTPException(status_code=404, detail="evaluation result not found")

            payload = record.result_data or {}
            paper_id = payload.get("paper_id")
            if not paper_id:
                return WrongQuestionSummaryResponse(record_id=record.id, paper_id=None, total=0)

            wrong_answers = await EvaluationPaperRepository().list_wrong_answers_by_paper(
                session,
                paper_id=paper_id,
                user_id=record.user_id,
            )

        by_knowledge_point = Counter(item.knowledge_point for item in wrong_answers)
        by_question_type = Counter(item.question_type for item in wrong_answers)
        return WrongQuestionSummaryResponse(
            record_id=record.id,
            paper_id=paper_id,
            total=len(wrong_answers),
            by_knowledge_point=dict(by_knowledge_point),
            by_question_type=dict(by_question_type),
        )
