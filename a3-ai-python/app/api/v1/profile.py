from fastapi import APIRouter, HTTPException

from app.schemas.profile import (
    ProfileBehaviorFeedbackRequest,
    ProfileBuildRequest,
    ProfileHistoryResponse,
    ProfileResponse,
    ProfileTagSummaryResponse,
    ProfileTuneRequest,
)
from app.services.profile_tag_summary_service import ProfileTagSummaryService
from app.services.profile_evolution_service import ProfileEvolutionService
from app.services.profile_service import ProfileService

router = APIRouter()


@router.post("/build", response_model=ProfileResponse)
async def build_profile(request: ProfileBuildRequest) -> ProfileResponse:
    service = ProfileService()
    return await service.build_profile(request)


@router.get("/latest", response_model=ProfileResponse)
async def get_latest_profile(user_id: int) -> ProfileResponse:
    service = ProfileService()
    profile = await service.get_latest_profile(user_id)
    if profile is None:
        raise HTTPException(status_code=404, detail="profile not found")
    return profile


@router.get("/history", response_model=ProfileHistoryResponse)
async def get_profile_history(user_id: int, limit: int = 10) -> ProfileHistoryResponse:
    service = ProfileEvolutionService()
    return await service.list_history(user_id=user_id, limit=limit)


@router.get("/summary", response_model=ProfileTagSummaryResponse)
async def get_profile_tag_summary(user_id: int, limit: int = 10) -> ProfileTagSummaryResponse:
    service = ProfileTagSummaryService()
    return await service.get_summary(user_id=user_id, limit=limit)


@router.post("/tune", response_model=ProfileResponse)
async def tune_profile(request: ProfileTuneRequest) -> ProfileResponse:
    service = ProfileEvolutionService()
    return await service.tune_profile(request)


@router.post("/feedback", response_model=ProfileResponse)
async def apply_behavior_feedback(request: ProfileBehaviorFeedbackRequest) -> ProfileResponse:
    service = ProfileEvolutionService()
    return await service.apply_behavior_feedback(request)
