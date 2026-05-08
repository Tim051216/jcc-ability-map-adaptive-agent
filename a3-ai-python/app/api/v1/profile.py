from fastapi import APIRouter

from app.schemas.profile import ProfileBuildRequest, ProfileResponse
from app.services.profile_service import ProfileService

router = APIRouter()


@router.post("/build", response_model=ProfileResponse)
async def build_profile(request: ProfileBuildRequest) -> ProfileResponse:
    service = ProfileService()
    return await service.build_profile(request)
