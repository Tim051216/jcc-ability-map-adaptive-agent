import asyncio
import json
import time

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse

from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db_session
from app.api.deps import get_ai_data_db_session, get_current_user_id
from app.db.session import get_ai_data_db
from app.schemas.chat import (
    ChatRequest,
    ChatResponse,
    ImMessageListResponse,
    ImMessageResponse,
    ImSendMessageRequest,
    ImSessionReadResponse,
    ImSessionCreateRequest,
    ImSessionListResponse,
    ImSessionSummaryResponse,
    ChatTaskStatusResponse,
    ChatTaskSubmitResponse,
    ChatTaskHistoryResponse,
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
from app.services.im_service import ImService
from app.services.chat_task_service import ChatTaskService
from app.services.chat_task_summary_service import ChatTaskSummaryService
from app.services.chat_ticket_service import ChatTicketService
from app.services.chat_ticket_summary_service import ChatTicketSummaryService

router = APIRouter()


@router.post("", response_model=ChatResponse)
async def chat(request: ChatRequest) -> ChatResponse:
    service = ChatService()
    return await service.chat(request)


@router.get("/sessions", response_model=ImSessionListResponse)
async def list_im_sessions(
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_ai_data_db_session),
) -> ImSessionListResponse:
    return await ImService(db).list_sessions(user_id)


@router.post("/sessions", response_model=ImSessionSummaryResponse)
async def create_im_session(
    request: ImSessionCreateRequest,
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_ai_data_db_session),
) -> ImSessionSummaryResponse:
    return await ImService(db).create_session(user_id, request)


@router.get("/sessions/{session_id}/messages", response_model=ImMessageListResponse)
async def list_im_messages(
    session_id: int,
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_ai_data_db_session),
) -> ImMessageListResponse:
    return await ImService(db).list_messages(user_id, session_id)


@router.put("/sessions/{session_id}/read", response_model=ImSessionReadResponse)
async def mark_im_session_read(
    session_id: int,
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_ai_data_db_session),
) -> ImSessionReadResponse:
    return await ImService(db).mark_session_read(user_id, session_id)


@router.post("/sessions/{session_id}/messages", response_model=ImMessageResponse)
async def send_im_message(
    session_id: int,
    request: ImSendMessageRequest,
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_ai_data_db_session),
) -> ImMessageResponse:
    return await ImService(db).send_message(user_id, session_id, request)


@router.get("/stream")
async def stream_im_updates(
    request: Request,
    user_id: int,
) -> StreamingResponse:
    async def event_generator():
        last_fingerprint: str | None = None
        last_keepalive = 0.0
        while True:
            if await request.is_disconnected():
                break
            async with get_ai_data_db() as db:
                payload = await ImService(db).list_sessions(user_id)
            payload_text = json.dumps(payload.model_dump(mode="json"), ensure_ascii=False, sort_keys=True)
            if payload_text != last_fingerprint:
                last_fingerprint = payload_text
                yield f"event: im-update\ndata: {payload_text}\n\n"
                last_keepalive = time.monotonic()
            elif time.monotonic() - last_keepalive > 12:
                yield "event: ping\ndata: {}\n\n"
                last_keepalive = time.monotonic()
            await asyncio.sleep(1.2)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


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


@router.get("/tasks", response_model=ChatTaskHistoryResponse)
async def list_chat_tasks(
    user_id: int | None = None,
    course_id: int | None = None,
    course_code: str | None = None,
    limit: int = 10,
    db: AsyncSession = Depends(get_db_session),
) -> ChatTaskHistoryResponse:
    service = ChatTaskService(db)
    return await service.list_tasks(user_id=user_id, course_id=course_id, course_code=course_code, limit=limit)


@router.post("/tickets", response_model=ChatTicketResponse)
async def create_chat_ticket(request: ChatTicketCreateRequest) -> ChatTicketResponse:
    service = ChatTicketService()
    return await service.create_ticket(request)


@router.get("/tickets", response_model=ChatTicketListResponse)
async def list_chat_tickets(
    user_id: int | None = None,
    course_id: int | None = None,
    course_code: str | None = None,
    status: str | None = None,
) -> ChatTicketListResponse:
    service = ChatTicketService()
    filters = {"user_id": user_id, "status": status}
    if course_id is not None:
        filters["course_id"] = course_id
    if course_code is not None:
        filters["course_code"] = course_code
    return await service.list_tickets(**filters)


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
