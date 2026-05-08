from fastapi import APIRouter

from app.schemas.rag import RagSearchRequest, RagSearchResponse
from app.services.rag_service import RagService

router = APIRouter()


@router.post("/search", response_model=RagSearchResponse)
async def search(request: RagSearchRequest) -> RagSearchResponse:
    service = RagService()
    return await service.search(request)
