from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.chat_ticket import ChatTicket, ChatTicketReply


class ChatTicketRepository:
    async def create_ticket(
        self,
        session: AsyncSession,
        *,
        user_id: int,
        session_id: int | None,
        course_code: str | None,
        title: str,
        question_summary: str,
        latest_answer: str | None,
        priority: str,
        status: str,
        created_at: str,
        updated_at: str,
    ) -> ChatTicket:
        ticket = ChatTicket(
            user_id=user_id,
            session_id=session_id,
            course_code=course_code,
            title=title,
            question_summary=question_summary,
            latest_answer=latest_answer,
            priority=priority,
            status=status,
            created_at=created_at,
            updated_at=updated_at,
        )
        session.add(ticket)
        await session.flush()
        return ticket

    async def get_ticket(self, session: AsyncSession, ticket_id: int) -> ChatTicket | None:
        return await session.get(ChatTicket, ticket_id)

    async def list_tickets(
        self,
        session: AsyncSession,
        *,
        user_id: int | None = None,
        course_code: str | None = None,
        status: str | None = None,
    ) -> tuple[list[ChatTicket], int]:
        stmt: Select[tuple[ChatTicket]] = select(ChatTicket)
        count_stmt = select(func.count()).select_from(ChatTicket)
        if user_id is not None:
            stmt = stmt.where(ChatTicket.user_id == user_id)
            count_stmt = count_stmt.where(ChatTicket.user_id == user_id)
        if course_code:
            stmt = stmt.where(ChatTicket.course_code == course_code)
            count_stmt = count_stmt.where(ChatTicket.course_code == course_code)
        if status:
            stmt = stmt.where(ChatTicket.status == status)
            count_stmt = count_stmt.where(ChatTicket.status == status)
        stmt = stmt.order_by(ChatTicket.id.desc())
        result = await session.execute(stmt)
        total = await session.scalar(count_stmt)
        return list(result.scalars().all()), int(total or 0)

    async def list_replies(self, session: AsyncSession, *, ticket_id: int) -> list[ChatTicketReply]:
        stmt = (
            select(ChatTicketReply)
            .where(ChatTicketReply.ticket_id == ticket_id)
            .order_by(ChatTicketReply.id.asc())
        )
        result = await session.execute(stmt)
        return list(result.scalars().all())

    async def create_reply(
        self,
        session: AsyncSession,
        *,
        ticket_id: int,
        replier_name: str,
        replier_role: str,
        content: str,
        created_at: str,
        updated_at: str,
    ) -> ChatTicketReply:
        reply = ChatTicketReply(
            ticket_id=ticket_id,
            replier_name=replier_name,
            replier_role=replier_role,
            content=content,
            created_at=created_at,
            updated_at=updated_at,
        )
        session.add(reply)
        await session.flush()
        return reply
