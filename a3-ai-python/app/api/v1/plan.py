from fastapi import APIRouter, HTTPException

from app.schemas.plan import LearningPlanRequest, LearningPlanResponse
from app.services.plan_service import PlanService

router = APIRouter()


@router.post("/generate", response_model=LearningPlanResponse)
async def generate_plan(request: LearningPlanRequest) -> LearningPlanResponse:
    service = PlanService()
    return await service.generate_plan(request)


@router.get("/latest", response_model=LearningPlanResponse)
async def get_latest_plan(user_id: int, course_code: str) -> LearningPlanResponse:
    service = PlanService()
    plan = await service.get_latest_plan(user_id=user_id, course_code=course_code)
    if plan is None:
        raise HTTPException(status_code=404, detail="learning plan not found")
    return plan
