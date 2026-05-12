from fastapi import APIRouter, Depends, HTTPException

from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db_session
from app.schemas.chat import (
    ChatRequest,
    ChatResponse,
    ChatTaskStatusResponse,
    ChatTaskSubmitResponse,
    ChatTaskSummaryResponse,
    ChatTicketCreateRequest,
    ChatTicketListResponse,
    ChatTicketReplyRequest,
    ChatTicketReplyResponse,
    ChatTicketResponse,
    ChatTicketSummaryResponse,
    ChatTicketStatusRequest,
)
from app.services.chat_service import ChatService
from app.services.chat_task_service import ChatTaskService
from app.services.chat_task_summary_service import ChatTaskSummaryService
from app.services.chat_ticket_service import ChatTicketService
from app.services.chat_ticket_summary_service import ChatTicketSummaryService

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


@router.get("/tasks/summary", response_model=ChatTaskSummaryResponse)
async def get_chat_task_summary(
    db: AsyncSession = Depends(get_db_session),
) -> ChatTaskSummaryResponse:
    service = ChatTaskSummaryService(db)
    return await service.get_summary()


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


@router.post("/tickets", response_model=ChatTicketResponse)
async def create_chat_ticket(request: ChatTicketCreateRequest) -> ChatTicketResponse:
    service = ChatTicketService()
    return await service.create_ticket(request)


@router.get("/tickets", response_model=ChatTicketListResponse)
async def list_chat_tickets(
    user_id: int | None = None,
    status: str | None = None,
) -> ChatTicketListResponse:
    service = ChatTicketService()
    return await service.list_tickets(user_id=user_id, status=status)


@router.get("/tickets/summary", response_model=ChatTicketSummaryResponse)
async def get_chat_ticket_summary(user_id: int | None = None) -> ChatTicketSummaryResponse:
    service = ChatTicketSummaryService()
    return await service.get_summary(user_id=user_id)


@router.get("/tickets/{ticket_id}", response_model=ChatTicketResponse)
async def get_chat_ticket(ticket_id: int) -> ChatTicketResponse:
    service = ChatTicketService()
    return await service.get_ticket(ticket_id)


@router.post("/tickets/{ticket_id}/reply", response_model=ChatTicketReplyResponse)
async def reply_chat_ticket(
    ticket_id: int,
    request: ChatTicketReplyRequest,
) -> ChatTicketReplyResponse:
    service = ChatTicketService()
    return await service.reply_ticket(ticket_id, request)


@router.put("/tickets/{ticket_id}/status", response_model=ChatTicketResponse)
async def update_chat_ticket_status(
    ticket_id: int,
    request: ChatTicketStatusRequest,
) -> ChatTicketResponse:
    service = ChatTicketService()
    return await service.update_status(ticket_id, request)
