from fastapi import APIRouter, HTTPException

from app.schemas.profile import ProfileBuildRequest, ProfileResponse
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
