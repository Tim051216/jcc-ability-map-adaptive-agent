from collections import Counter

from app.db.repositories.evaluation_repository import EvaluationRepository
from app.db.session import async_session_factory
from app.schemas.evaluation import (
    EvaluationHistoryItem,
    EvaluationHistoryResponse,
    EvaluationTrendResponse,
)
from app.services.course_context_service import CourseContextService


class EvaluationHistoryService:
    async def list_history(
        self,
        *,
        user_id: int,
        course_id: int | None = None,
        course_code: str | None = None,
        evaluation_type: str | None = None,
        limit: int = 10,
    ) -> EvaluationHistoryResponse:
        course_context = await CourseContextService().resolve(course_id=course_id, course_code=course_code)
        async with async_session_factory() as session:
            records = await EvaluationRepository().list_by_user_course(
                session,
                user_id=user_id,
                course_code=course_context.course_code,
                evaluation_type=evaluation_type,
                limit=limit,
            )
        items = [self._to_history_item(record) for record in records]
        return EvaluationHistoryResponse(items=items, total=len(items))

    async def get_trend(
        self,
        *,
        user_id: int,
        course_id: int | None = None,
        course_code: str | None = None,
        evaluation_type: str | None = None,
        limit: int = 10,
    ) -> EvaluationTrendResponse:
        course_context = await CourseContextService().resolve(course_id=course_id, course_code=course_code)
        async with async_session_factory() as session:
            records = await EvaluationRepository().list_by_user_course(
                session,
                user_id=user_id,
                course_code=course_context.course_code,
                evaluation_type=evaluation_type,
                limit=limit,
            )

        if not records:
            return EvaluationTrendResponse(user_id=user_id, course_code=course_context.course_code, total=0)

        chronological_scores = [
            float((record.result_data or {}).get("overall_score", 0.0))
            for record in reversed(records)
        ]
        latest_payload = records[0].result_data or {}
        average_score = round(sum(chronological_scores) / len(chronological_scores), 2)
        best_score = round(max(chronological_scores), 2)
        improvement = None
        # 使用首尾分差表示阶段变化，避免单次波动把趋势放大。
        if len(chronological_scores) >= 2:
            improvement = round(chronological_scores[-1] - chronological_scores[0], 2)

        knowledge_counter: Counter[str] = Counter()
        for record in records:
            for item in (record.result_data or {}).get("weak_points", []):
                knowledge_counter[item] += 1

        return EvaluationTrendResponse(
            user_id=user_id,
            course_code=course_context.course_code,
            total=len(records),
            latest_score=round(float(latest_payload.get("overall_score", 0.0)), 2),
            average_score=average_score,
            best_score=best_score,
            improvement=improvement,
            latest_mastery_level=latest_payload.get("mastery_level"),
            focus_knowledge_points=[item for item, _ in knowledge_counter.most_common(3)],
        )

    @staticmethod
    def _to_history_item(record) -> EvaluationHistoryItem:
        payload = record.result_data or {}
        return EvaluationHistoryItem(
            record_id=record.id,
            paper_id=payload.get("paper_id"),
            course_code=record.course_code,
            evaluation_type=payload.get("evaluation_type", record.evaluation_type),
            overall_score=float(payload.get("overall_score", 0.0)),
            mastery_level=payload.get("mastery_level", "developing"),
            report_summary=payload.get("report_summary", ""),
            weak_points=payload.get("weak_points", []),
            knowledge_points=payload.get("knowledge_points", []),
            created_at=record.created_at,
        )
