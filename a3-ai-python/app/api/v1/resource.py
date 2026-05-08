from fastapi import APIRouter

from app.schemas.resource import ResourceGenerationRequest, ResourceGenerationResponse
from app.services.resource_service import ResourceService

router = APIRouter()


@router.post("/generate", response_model=ResourceGenerationResponse)
async def generate_resource(
    request: ResourceGenerationRequest,
) -> ResourceGenerationResponse:
    service = ResourceService()
    return await service.generate_resources(request)
