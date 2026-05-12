from collections import Counter

from app.db.repositories.plan_repository import PlanRepository
from app.db.session import async_session_factory
from app.schemas.plan import LearningPlanSummaryResponse


class PlanSummaryService:
    async def get_summary(self, *, user_id: int) -> LearningPlanSummaryResponse:
        async with async_session_factory() as session:
            plans = await PlanRepository().list_by_user(session, user_id=user_id)

        by_status = Counter(item.status for item in plans)
        by_course = Counter(item.course_code for item in plans)
        completion_values = [
            float((item.plan_data or {}).get("completion_rate", 0.0) or 0.0)
            for item in plans
        ]
        average_completion_rate = round(sum(completion_values) / len(completion_values), 2) if completion_values else 0.0
        latest_updated_at = plans[0].updated_at if plans else None

        return LearningPlanSummaryResponse(
            user_id=user_id,
            total=len(plans),
            average_completion_rate=average_completion_rate,
            by_status=dict(by_status),
            by_course=dict(by_course),
            latest_updated_at=latest_updated_at,
        )
