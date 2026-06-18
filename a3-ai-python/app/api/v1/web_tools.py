from fastapi import APIRouter

from app.schemas.web_tools import (
    WebFetchRequest,
    WebFetchResponse,
    WebSearchRequest,
    WebSearchResponse,
)
from app.services.web_tool_service import WebToolService

router = APIRouter()


@router.post("/search", response_model=WebSearchResponse)
async def web_search(request: WebSearchRequest) -> WebSearchResponse:
    return await WebToolService().websearch(request)


@router.post("/fetch", response_model=WebFetchResponse)
async def web_fetch(request: WebFetchRequest) -> WebFetchResponse:
    return await WebToolService().webfetch(request.url, max_chars=request.max_chars)
