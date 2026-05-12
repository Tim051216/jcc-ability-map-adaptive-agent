from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.services import chat_ticket_service as chat_ticket_service_module
from app.services.chat_ticket_service import ChatTicketService


class _FakeSession:
    def __init__(self) -> None:
        self.committed = False

    async def commit(self) -> None:
        self.committed = True


class _FakeSessionFactory:
    def __init__(self, session: _FakeSession) -> None:
        self._session = session

    async def __aenter__(self) -> _FakeSession:
        return self._session

    async def __aexit__(self, exc_type, exc, tb) -> bool:
        return False


def _patch_session_factory(monkeypatch, session: _FakeSession) -> None:
    monkeypatch.setattr(chat_ticket_service_module, "async_session_factory", lambda: _FakeSessionFactory(session))


@pytest.mark.asyncio
async def test_create_ticket_defaults_status_open_and_commits(monkeypatch) -> None:
    session = _FakeSession()
    _patch_session_factory(monkeypatch, session)

    captured: dict = {}

    class FakeTicketRepository:
        async def create_ticket(self, session_obj, **kwargs):
            captured.update(kwargs)
            assert session_obj is session
            return SimpleNamespace(id=301, **kwargs)

    monkeypatch.setattr(chat_ticket_service_module, "ChatTicketRepository", lambda: FakeTicketRepository())

    response = await ChatTicketService().create_ticket(
        SimpleNamespace(
            user_id=1001,
            session_id=88,
            course_code="PYTHON-AI",
            title="Need tutor help",
            question_summary="stuck on asyncio",
            latest_answer="event loop unclear",
            priority="high",
        )
    )

    assert response.ticket_id == 301
    assert response.status == "open"
    assert captured["status"] == "open"
    assert session.committed is True


@pytest.mark.asyncio
async def test_reply_ticket_switches_open_ticket_to_processing(monkeypatch) -> None:
    session = _FakeSession()
    _patch_session_factory(monkeypatch, session)

    ticket = SimpleNamespace(
        id=301,
        user_id=1001,
        session_id=88,
        course_code="PYTHON-AI",
        title="Need tutor help",
        question_summary="stuck on asyncio",
        latest_answer="event loop unclear",
        priority="high",
        status="open",
        created_at="2026-05-09T10:00:00+00:00",
        updated_at="2026-05-09T10:00:00+00:00",
    )

    class FakeTicketRepository:
        async def get_ticket(self, session_obj, ticket_id: int):
            assert session_obj is session
            assert ticket_id == 301
            return ticket

        async def create_reply(self, session_obj, **kwargs):
            assert session_obj is session
            return SimpleNamespace(id=901, **kwargs)

    monkeypatch.setattr(chat_ticket_service_module, "ChatTicketRepository", lambda: FakeTicketRepository())

    response = await ChatTicketService().reply_ticket(
        301,
        SimpleNamespace(replier_name="teacherA", replier_role="staff", content="先看事件循环示意图"),
    )

    assert response.reply_id == 901
    assert ticket.status == "processing"
    assert session.committed is True


@pytest.mark.asyncio
async def test_get_ticket_raises_when_missing(monkeypatch) -> None:
    session = _FakeSession()
    _patch_session_factory(monkeypatch, session)

    class FakeTicketRepository:
        async def get_ticket(self, session_obj, ticket_id: int):
            assert session_obj is session
            assert ticket_id == 999
            return None

    monkeypatch.setattr(chat_ticket_service_module, "ChatTicketRepository", lambda: FakeTicketRepository())

    with pytest.raises(HTTPException) as exc_info:
        await ChatTicketService().get_ticket(999)

    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == "chat ticket not found"
