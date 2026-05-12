from collections import Counter

from app.db.repositories.chat_ticket_repository import ChatTicketRepository
from app.db.session import async_session_factory
from app.schemas.chat import ChatTicketSummaryResponse


class ChatTicketSummaryService:
    async def get_summary(self, *, user_id: int | None = None) -> ChatTicketSummaryResponse:
        async with async_session_factory() as session:
            tickets, total = await ChatTicketRepository().list_tickets(session, user_id=user_id, status=None)

        by_status = Counter(ticket.status for ticket in tickets)
        by_priority = Counter(ticket.priority for ticket in tickets)
        unresolved_count = sum(
            count for status, count in by_status.items() if status not in {"closed", "resolved"}
        )
        latest_ticket_at = tickets[0].updated_at if tickets else None

        return ChatTicketSummaryResponse(
            user_id=user_id,
            total=total,
            unresolved_count=unresolved_count,
            by_status=dict(by_status),
            by_priority=dict(by_priority),
            latest_ticket_at=latest_ticket_at,
        )
