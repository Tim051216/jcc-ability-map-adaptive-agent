from fastapi import APIRouter

from app.schemas.plan import LearningPlanRequest, LearningPlanResponse
from app.services.plan_service import PlanService

router = APIRouter()


@router.post("/generate", response_model=LearningPlanResponse)
async def generate_plan(request: LearningPlanRequest) -> LearningPlanResponse:
    service = PlanService()
    return await service.generate_plan(request)
