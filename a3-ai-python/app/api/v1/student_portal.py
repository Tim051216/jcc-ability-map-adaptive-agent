from fastapi import APIRouter, Query

from app.schemas.student_portal import (
    CapabilityProfileResponse,
    JobLearningGoalResponse,
    JobLearningGoalUpdateRequest,
    JobLearningOverviewResponse,
    PortalDashboardResponse,
    StudyReportResponse,
)
from app.services.student_portal_service import StudentPortalService

router = APIRouter()


@router.get("/dashboard", response_model=PortalDashboardResponse)
async def get_student_dashboard(
    user_id: int = Query(default=1001, ge=1),
    course_id: int | None = Query(default=None, ge=1),
) -> PortalDashboardResponse:
    return await StudentPortalService().get_dashboard(user_id=user_id, course_id=course_id)


@router.get("/capability-profile", response_model=CapabilityProfileResponse)
async def get_capability_profile(
    user_id: int = Query(default=1001, ge=1),
    course_id: int | None = Query(default=None, ge=1),
) -> CapabilityProfileResponse:
    return await StudentPortalService().get_capability_profile(user_id=user_id, course_id=course_id)


@router.get("/study-report", response_model=StudyReportResponse)
async def get_study_report(
    user_id: int = Query(default=1001, ge=1),
    course_id: int | None = Query(default=None, ge=1),
) -> StudyReportResponse:
    return await StudentPortalService().get_study_report(user_id=user_id, course_id=course_id)


@router.get("/job-learning", response_model=JobLearningOverviewResponse)
async def get_job_learning_overview(
    user_id: int = Query(default=1001, ge=1),
    course_id: int = Query(default=401, ge=1),
) -> JobLearningOverviewResponse:
    return await StudentPortalService().get_job_learning_overview(
        user_id=user_id,
        course_id=course_id,
    )


@router.put("/job-learning/goal", response_model=JobLearningGoalResponse)
async def update_job_learning_goal(
    request: JobLearningGoalUpdateRequest,
) -> JobLearningGoalResponse:
    return await StudentPortalService().update_job_learning_goal(request)
