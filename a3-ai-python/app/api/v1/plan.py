from fastapi import APIRouter, HTTPException

from app.schemas.plan import (
    LearningPlanRequest,
    LearningPlanResponse,
    LearningPlanSummaryResponse,
    PlanProgressResponse,
    PlanStepActionRequest,
)
from app.services.course_context_service import CourseContextService
from app.services.plan_summary_service import PlanSummaryService
from app.services.plan_service import PlanService

router = APIRouter()


@router.post("/generate", response_model=LearningPlanResponse)
async def generate_plan(request: LearningPlanRequest) -> LearningPlanResponse:
    service = PlanService()
    return await service.generate_plan(request)


@router.get("/latest", response_model=LearningPlanResponse)
async def get_latest_plan(
    user_id: int,
    course_id: int | None = None,
    course_code: str | None = None,
) -> LearningPlanResponse:
    service = PlanService()
    course_context = await CourseContextService().resolve(course_id=course_id, course_code=course_code)
    plan = await service.get_latest_plan(user_id=user_id, course_code=course_context.course_code)
    if plan is None:
        return await service.generate_plan(
            LearningPlanRequest(
                user_id=user_id,
                course_id=course_context.course_id,
                course_code=course_context.course_code,
                target=f"完成 {course_context.course_name} 学习任务",
            )
        )
    return plan


@router.get("/summary", response_model=LearningPlanSummaryResponse)
async def get_plan_summary(user_id: int) -> LearningPlanSummaryResponse:
    service = PlanSummaryService()
    return await service.get_summary(user_id=user_id)


@router.get("/{plan_id}", response_model=LearningPlanResponse)
async def get_plan(plan_id: int) -> LearningPlanResponse:
    service = PlanService()
    plan = await service.get_plan(plan_id)
    if plan is None:
        raise HTTPException(status_code=404, detail="learning plan not found")
    return plan


@router.post("/{plan_id}/steps/{step_id}/complete", response_model=PlanProgressResponse)
async def complete_plan_step(
    plan_id: int,
    step_id: str,
    request: PlanStepActionRequest,
) -> PlanProgressResponse:
    service = PlanService()
    return await service.update_step_status(plan_id=plan_id, user_id=request.user_id, step_id=step_id, action="complete")


@router.post("/{plan_id}/steps/{step_id}/pause", response_model=PlanProgressResponse)
async def pause_plan_step(
    plan_id: int,
    step_id: str,
    request: PlanStepActionRequest,
) -> PlanProgressResponse:
    service = PlanService()
    return await service.update_step_status(plan_id=plan_id, user_id=request.user_id, step_id=step_id, action="pause")


@router.post("/{plan_id}/steps/{step_id}/resume", response_model=PlanProgressResponse)
async def resume_plan_step(
    plan_id: int,
    step_id: str,
    request: PlanStepActionRequest,
) -> PlanProgressResponse:
    service = PlanService()
    return await service.update_step_status(plan_id=plan_id, user_id=request.user_id, step_id=step_id, action="resume")


@router.get("/{plan_id}/progress", response_model=PlanProgressResponse)
async def get_plan_progress(plan_id: int, user_id: int) -> PlanProgressResponse:
    service = PlanService()
    return await service.get_plan_progress(plan_id=plan_id, user_id=user_id)
