from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.deps import get_authenticated_user_id
from app.schemas.student_portal import (
    CapabilityProfileResponse,
    JobCoachingFeedbackRequest,
    JobCoachingRecordCreateRequest,
    JobCoachingRecordListResponse,
    JobCoachingRecordResponse,
    JobLearningGoalResponse,
    JobLearningGoalUpdateRequest,
    JobKnowledgeCatalogResponse,
    JobLearningOutcomeResponse,
    JobLearningOverviewResponse,
    JobTrialFeedbackCreateRequest,
    JobTrialFeedbackListResponse,
    JobTrialFeedbackResponse,
    PortalDashboardResponse,
    StudyReportResponse,
)
from app.services.student_portal_service import StudentPortalService
from app.services.job_knowledge_catalog_service import JobKnowledgeCatalogService

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


@router.get(
    "/job-learning/knowledge-catalog",
    response_model=JobKnowledgeCatalogResponse,
)
async def get_job_knowledge_catalog(
    ability_dimension: str | None = Query(default=None),
) -> JobKnowledgeCatalogResponse:
    return JobKnowledgeCatalogService.list_items(ability_dimension)


@router.get(
    "/job-learning/outcomes",
    response_model=JobLearningOutcomeResponse,
)
async def get_job_learning_outcomes(
    user_id: int = Query(default=1001, ge=1),
    course_id: int = Query(default=401, ge=1),
) -> JobLearningOutcomeResponse:
    try:
        return await StudentPortalService().get_job_learning_outcomes(
            user_id=user_id,
            course_id=course_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.put("/job-learning/goal", response_model=JobLearningGoalResponse)
async def update_job_learning_goal(
    request: JobLearningGoalUpdateRequest,
) -> JobLearningGoalResponse:
    return await StudentPortalService().update_job_learning_goal(request)


@router.post(
    "/job-learning/coaching-records",
    response_model=JobCoachingRecordResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_job_coaching_record(
    request: JobCoachingRecordCreateRequest,
) -> JobCoachingRecordResponse:
    try:
        return await StudentPortalService().create_job_coaching_record(request)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get(
    "/job-learning/coaching-records",
    response_model=JobCoachingRecordListResponse,
)
async def list_job_coaching_records(
    user_id: int = Query(default=1001, ge=1),
    course_id: int = Query(default=401, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
) -> JobCoachingRecordListResponse:
    return await StudentPortalService().list_job_coaching_records(
        user_id=user_id,
        course_id=course_id,
        limit=limit,
    )


@router.patch(
    "/job-learning/coaching-records/{record_id}/feedback",
    response_model=JobCoachingRecordResponse,
)
async def update_job_coaching_feedback(
    record_id: int,
    request: JobCoachingFeedbackRequest,
) -> JobCoachingRecordResponse:
    record = await StudentPortalService().update_job_coaching_feedback(
        record_id=record_id,
        request=request,
    )
    if record is None:
        raise HTTPException(status_code=404, detail="coaching record not found")
    return record


@router.post(
    "/job-learning/trial-feedback",
    response_model=JobTrialFeedbackResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_job_trial_feedback(
    request: JobTrialFeedbackCreateRequest,
    current_user_id: int = Depends(get_authenticated_user_id),
) -> JobTrialFeedbackResponse:
    if request.user_id != current_user_id:
        raise HTTPException(status_code=403, detail="cannot submit feedback for another user")
    try:
        return await StudentPortalService().create_job_trial_feedback(request)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get(
    "/job-learning/trial-feedback",
    response_model=JobTrialFeedbackListResponse,
)
async def list_job_trial_feedback(
    user_id: int = Query(default=1001, ge=1),
    course_id: int = Query(default=401, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    current_user_id: int = Depends(get_authenticated_user_id),
) -> JobTrialFeedbackListResponse:
    if user_id != current_user_id:
        raise HTTPException(status_code=403, detail="cannot read feedback for another user")
    return await StudentPortalService().list_job_trial_feedback(
        user_id=user_id,
        course_id=course_id,
        limit=limit,
    )
