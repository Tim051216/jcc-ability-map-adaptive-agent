from fastapi import APIRouter, Depends, HTTPException

from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db_session
from app.schemas.chat import ChatRequest, ChatResponse, ChatTaskStatusResponse, ChatTaskSubmitResponse
from app.services.chat_service import ChatService
from app.services.chat_task_service import ChatTaskService

router = APIRouter()


@router.post("", response_model=ChatResponse)
async def chat(request: ChatRequest) -> ChatResponse:
    service = ChatService()
    return await service.chat(request)


@router.post("/tasks", response_model=ChatTaskSubmitResponse)
async def submit_chat_task(
    request: ChatRequest,
    db: AsyncSession = Depends(get_db_session),
) -> ChatTaskSubmitResponse:
    service = ChatTaskService(db)
    return await service.submit_task(request)


@router.get("/tasks/{task_id}", response_model=ChatTaskStatusResponse)
async def get_chat_task_status(
    task_id: int,
    db: AsyncSession = Depends(get_db_session),
) -> ChatTaskStatusResponse:
    service = ChatTaskService(db)
    task_status = await service.get_task_status(task_id)
    if task_status is None:
        raise HTTPException(status_code=404, detail="chat task not found")
    return task_status
