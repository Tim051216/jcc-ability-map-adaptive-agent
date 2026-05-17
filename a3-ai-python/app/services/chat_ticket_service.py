from datetime import datetime, timezone

from fastapi import HTTPException

from app.db.repositories.chat_ticket_repository import ChatTicketRepository
from app.db.session import async_session_factory
from app.schemas.chat import (
    ChatTicketCreateRequest,
    ChatTicketListResponse,
    ChatTicketReplyRequest,
    ChatTicketReplyResponse,
    ChatTicketResponse,
    ChatTicketStatusRequest,
)
from app.services.course_context_service import CourseContextService


class ChatTicketService:
    async def create_ticket(self, request: ChatTicketCreateRequest) -> ChatTicketResponse:
        course_context = None
        if request.course_id is not None or request.course_code:
            course_context = await CourseContextService().resolve(
                course_id=request.course_id,
                course_code=request.course_code,
            )
        now = datetime.now(timezone.utc).isoformat()
        async with async_session_factory() as session:
            ticket = await ChatTicketRepository().create_ticket(
                session,
                user_id=request.user_id,
                session_id=request.session_id,
                course_code=course_context.course_code if course_context else request.course_code,
                title=request.title,
                question_summary=request.question_summary,
                latest_answer=request.latest_answer,
                priority=request.priority,
                status="open",
                created_at=now,
                updated_at=now,
            )
            await session.commit()
        return self._to_ticket_response(ticket, replies=[])

    async def list_tickets(
        self,
        *,
        user_id: int | None = None,
        course_id: int | None = None,
        course_code: str | None = None,
        status: str | None = None,
    ) -> ChatTicketListResponse:
        resolved_course_code = course_code
        if course_id is not None:
            resolved_course_code = (
                await CourseContextService().resolve(course_id=course_id, course_code=course_code)
            ).course_code
        async with async_session_factory() as session:
            items, total = await ChatTicketRepository().list_tickets(
                session,
                user_id=user_id,
                course_code=resolved_course_code,
                status=status,
            )
        return ChatTicketListResponse(items=[self._to_ticket_response(item) for item in items], total=total)

    async def get_ticket(self, ticket_id: int) -> ChatTicketResponse:
        async with async_session_factory() as session:
            repo = ChatTicketRepository()
            ticket = await repo.get_ticket(session, ticket_id)
            if ticket is None:
                raise HTTPException(status_code=404, detail="chat ticket not found")
            replies = await repo.list_replies(session, ticket_id=ticket_id)
        return self._to_ticket_response(ticket, replies=replies)

    async def reply_ticket(
        self,
        ticket_id: int,
        request: ChatTicketReplyRequest,
    ) -> ChatTicketReplyResponse:
        now = datetime.now(timezone.utc).isoformat()
        async with async_session_factory() as session:
            repo = ChatTicketRepository()
            ticket = await repo.get_ticket(session, ticket_id)
            if ticket is None:
                raise HTTPException(status_code=404, detail="chat ticket not found")
            reply = await repo.create_reply(
                session,
                ticket_id=ticket_id,
                replier_name=request.replier_name,
                replier_role=request.replier_role,
                content=request.content,
                created_at=now,
                updated_at=now,
            )
            ticket.status = "processing" if ticket.status == "open" else ticket.status
            ticket.updated_at = now
            await session.commit()
        return ChatTicketReplyResponse(
            ticket_id=ticket_id,
            reply_id=reply.id,
            replier_name=reply.replier_name,
            replier_role=reply.replier_role,
            content=reply.content,
            created_at=reply.created_at,
        )

    async def update_status(self, ticket_id: int, request: ChatTicketStatusRequest) -> ChatTicketResponse:
        now = datetime.now(timezone.utc).isoformat()
        async with async_session_factory() as session:
            repo = ChatTicketRepository()
            ticket = await repo.get_ticket(session, ticket_id)
            if ticket is None:
                raise HTTPException(status_code=404, detail="chat ticket not found")
            ticket.status = request.status
            ticket.updated_at = now
            await session.commit()
            replies = await repo.list_replies(session, ticket_id=ticket_id)
        return self._to_ticket_response(ticket, replies=replies)

    @staticmethod
    def _to_ticket_response(ticket, replies: list | None = None) -> ChatTicketResponse:
        reply_items = [
            ChatTicketReplyResponse(
                ticket_id=ticket.id,
                reply_id=item.id,
                replier_name=item.replier_name,
                replier_role=item.replier_role,
                content=item.content,
                created_at=item.created_at,
            )
            for item in (replies or [])
        ]
        return ChatTicketResponse(
            ticket_id=ticket.id,
            user_id=ticket.user_id,
            session_id=ticket.session_id,
            course_code=ticket.course_code,
            title=ticket.title,
            question_summary=ticket.question_summary,
            latest_answer=ticket.latest_answer,
            priority=ticket.priority,
            status=ticket.status,
            created_at=ticket.created_at,
            updated_at=ticket.updated_at,
            replies=reply_items,
        )
