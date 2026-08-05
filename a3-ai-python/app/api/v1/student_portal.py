from fastapi import APIRouter

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
async def get_student_dashboard(user_id: int = 1001, course_id: int | None = None) -> PortalDashboardResponse:
    return await StudentPortalService().get_dashboard(user_id=user_id, course_id=course_id)


@router.get("/capability-profile", response_model=CapabilityProfileResponse)
async def get_capability_profile(
    user_id: int = 1001,
    course_id: int | None = None,
) -> CapabilityProfileResponse:
    return await StudentPortalService().get_capability_profile(user_id=user_id, course_id=course_id)


@router.get("/study-report", response_model=StudyReportResponse)
async def get_study_report(user_id: int = 1001, course_id: int | None = None) -> StudyReportResponse:
    return await StudentPortalService().get_study_report(user_id=user_id, course_id=course_id)


@router.get("/job-learning", response_model=JobLearningOverviewResponse)
async def get_job_learning_overview(
    user_id: int = 1001,
    course_id: int = 401,
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
