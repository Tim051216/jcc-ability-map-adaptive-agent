from types import SimpleNamespace

import pytest

from app.services import chat_ticket_summary_service as chat_ticket_summary_service_module
from app.services.chat_ticket_summary_service import ChatTicketSummaryService


class _FakeSessionFactory:
    def __init__(self, session) -> None:
        self._session = session

    async def __aenter__(self):
        return self._session

    async def __aexit__(self, exc_type, exc, tb) -> bool:
        return False


def _patch_session_factory(monkeypatch, session) -> None:
    monkeypatch.setattr(chat_ticket_summary_service_module, "async_session_factory", lambda: _FakeSessionFactory(session))


@pytest.mark.asyncio
async def test_get_summary_aggregates_status_and_priority(monkeypatch) -> None:
    session = SimpleNamespace()
    _patch_session_factory(monkeypatch, session)

    tickets = [
        SimpleNamespace(status="processing", priority="high", updated_at="2026-05-09T20:00:00+00:00"),
        SimpleNamespace(status="open", priority="normal", updated_at="2026-05-09T19:00:00+00:00"),
        SimpleNamespace(status="closed", priority="high", updated_at="2026-05-09T18:00:00+00:00"),
    ]

    class FakeChatTicketRepository:
        async def list_tickets(self, session_obj, *, user_id=None, status=None):
            assert session_obj is session
            assert user_id == 1001
            assert status is None
            return tickets, len(tickets)

    monkeypatch.setattr(
        chat_ticket_summary_service_module,
        "ChatTicketRepository",
        lambda: FakeChatTicketRepository(),
    )

    response = await ChatTicketSummaryService().get_summary(user_id=1001)

    assert response.total == 3
    assert response.unresolved_count == 2
    assert response.by_status["processing"] == 1
    assert response.by_priority["high"] == 2
    assert response.latest_ticket_at == "2026-05-09T20:00:00+00:00"
