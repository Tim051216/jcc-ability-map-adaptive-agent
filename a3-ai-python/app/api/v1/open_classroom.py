from fastapi import APIRouter, Depends

from app.api.deps import get_current_user_id
from app.schemas.open_classroom import OpenClassroomBuildRequest, OpenClassroomBuildResponse
from app.services.open_classroom_service import OpenClassroomService

router = APIRouter()


@router.post("/build", response_model=OpenClassroomBuildResponse)
async def build_open_classroom(
    request: OpenClassroomBuildRequest,
    user_id: int = Depends(get_current_user_id),
) -> OpenClassroomBuildResponse:
    return await OpenClassroomService().build_session(user_id=user_id, request=request)
