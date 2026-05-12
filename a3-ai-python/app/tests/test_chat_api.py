from types import SimpleNamespace

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.deps import get_db_session
from app.api.v1 import chat
from app.services.chat_task_service import ChatTaskService
from app.services.chat_task_summary_service import ChatTaskSummaryService
from app.services.chat_ticket_service import ChatTicketService
from app.services.chat_ticket_summary_service import ChatTicketSummaryService


app = FastAPI()
app.include_router(chat.router, prefix="/api/v1/chat")
app.dependency_overrides[get_db_session] = lambda: SimpleNamespace()
client = TestClient(app)


def test_chat_endpoint_returns_payload(monkeypatch) -> None:
    async def fake_chat(self, request):
        assert request.user_id == 1001
        assert request.message == "what is asyncio"
        return {
            "answer": "asyncio is an event-loop based concurrency library",
            "citations": [],
            "intent": "study_assistant",
            "agent_trace": ["router_agent"],
            "profile": None,
            "generated_plan": None,
            "generated_resources": [],
            "generated_evaluation": None,
        }

    monkeypatch.setattr(chat.ChatService, "chat", fake_chat)

    response = client.post("/api/v1/chat", json={"user_id": 1001, "message": "what is asyncio"})

    assert response.status_code == 200
    assert "asyncio" in response.json()["answer"]


def test_submit_chat_task_returns_payload(monkeypatch) -> None:
    async def fake_submit_task(self, request):
        assert request.user_id == 1001
        assert request.message == "help me"
        return {"task_id": 77, "status": "pending", "poll_interval_ms": 2000}

    monkeypatch.setattr(ChatTaskService, "submit_task", fake_submit_task)

    response = client.post("/api/v1/chat/tasks", json={"user_id": 1001, "message": "help me"})

    assert response.status_code == 200
    assert response.json()["task_id"] == 77


def test_get_chat_task_summary_returns_payload(monkeypatch) -> None:
    async def fake_get_summary(self):
        return {
            "total": 3,
            "pending_count": 1,
            "failed_count": 1,
            "by_status": {"completed": 1, "failed": 1, "pending": 1},
            "latest_task_at": "2026-05-10T02:40:00+00:00",
        }

    monkeypatch.setattr(ChatTaskSummaryService, "get_summary", fake_get_summary)

    response = client.get("/api/v1/chat/tasks/summary")

    assert response.status_code == 200
    assert response.json()["failed_count"] == 1


def test_get_chat_task_status_returns_404_when_missing(monkeypatch) -> None:
    async def fake_get_task_status(self, task_id: int):
        assert task_id == 77
        return None

    monkeypatch.setattr(ChatTaskService, "get_task_status", fake_get_task_status)

    response = client.get("/api/v1/chat/tasks/77")

    assert response.status_code == 404
    assert response.json()["detail"] == "chat task not found"


def test_get_chat_task_status_returns_payload(monkeypatch) -> None:
    async def fake_get_task_status(self, task_id: int):
        assert task_id == 77
        return {
            "task_id": 77,
            "status": "completed",
            "result": {
                "answer": "done",
                "citations": [],
                "intent": "study_assistant",
                "agent_trace": [],
                "profile": None,
                "generated_plan": None,
                "generated_resources": [],
                "generated_evaluation": None,
            },
            "error_message": None,
        }

    monkeypatch.setattr(ChatTaskService, "get_task_status", fake_get_task_status)

    response = client.get("/api/v1/chat/tasks/77")

    assert response.status_code == 200
    assert response.json()["status"] == "completed"
    assert response.json()["result"]["answer"] == "done"


def test_create_chat_ticket_returns_payload(monkeypatch) -> None:
    async def fake_create_ticket(self, request):
        assert request.user_id == 1001
        return {
            "ticket_id": 301,
            "user_id": 1001,
            "session_id": 88,
            "course_code": "PYTHON-AI",
            "title": "Need tutor help",
            "question_summary": "stuck on asyncio",
            "latest_answer": "event loop unclear",
            "priority": "high",
            "status": "open",
            "created_at": "2026-05-09T10:00:00+00:00",
            "updated_at": "2026-05-09T10:00:00+00:00",
            "replies": [],
        }

    monkeypatch.setattr(ChatTicketService, "create_ticket", fake_create_ticket)

    response = client.post(
        "/api/v1/chat/tickets",
        json={
            "user_id": 1001,
            "session_id": 88,
            "course_code": "PYTHON-AI",
            "title": "Need tutor help",
            "question_summary": "stuck on asyncio",
            "latest_answer": "event loop unclear",
            "priority": "high",
        },
    )

    assert response.status_code == 200
    assert response.json()["status"] == "open"


def test_list_chat_tickets_returns_payload(monkeypatch) -> None:
    async def fake_list_tickets(self, *, user_id=None, status=None):
        assert user_id == 1001
        assert status == "open"
        return {
            "items": [
                {
                    "ticket_id": 301,
                    "user_id": 1001,
                    "session_id": 88,
                    "course_code": "PYTHON-AI",
                    "title": "Need tutor help",
                    "question_summary": "stuck on asyncio",
                    "latest_answer": "event loop unclear",
                    "priority": "high",
                    "status": "open",
                    "created_at": "2026-05-09T10:00:00+00:00",
                    "updated_at": "2026-05-09T10:00:00+00:00",
                    "replies": [],
                }
            ],
            "total": 1,
        }

    monkeypatch.setattr(ChatTicketService, "list_tickets", fake_list_tickets)

    response = client.get("/api/v1/chat/tickets", params={"user_id": 1001, "status": "open"})

    assert response.status_code == 200
    assert response.json()["total"] == 1


def test_get_chat_ticket_summary_returns_payload(monkeypatch) -> None:
    async def fake_get_summary(self, *, user_id=None):
        assert user_id == 1001
        return {
            "user_id": 1001,
            "total": 3,
            "unresolved_count": 2,
            "by_status": {"open": 1, "processing": 1, "closed": 1},
            "by_priority": {"high": 2, "normal": 1},
            "latest_ticket_at": "2026-05-09T20:00:00+00:00",
        }

    monkeypatch.setattr(ChatTicketSummaryService, "get_summary", fake_get_summary)

    response = client.get("/api/v1/chat/tickets/summary", params={"user_id": 1001})

    assert response.status_code == 200
    assert response.json()["unresolved_count"] == 2


def test_get_chat_ticket_returns_payload(monkeypatch) -> None:
    async def fake_get_ticket(self, ticket_id: int):
        assert ticket_id == 301
        return {
            "ticket_id": 301,
            "user_id": 1001,
            "session_id": 88,
            "course_code": "PYTHON-AI",
            "title": "Need tutor help",
            "question_summary": "stuck on asyncio",
            "latest_answer": "event loop unclear",
            "priority": "high",
            "status": "processing",
            "created_at": "2026-05-09T10:00:00+00:00",
            "updated_at": "2026-05-09T10:05:00+00:00",
            "replies": [],
        }

    monkeypatch.setattr(ChatTicketService, "get_ticket", fake_get_ticket)

    response = client.get("/api/v1/chat/tickets/301")

    assert response.status_code == 200
    assert response.json()["status"] == "processing"


def test_reply_chat_ticket_returns_payload(monkeypatch) -> None:
    async def fake_reply_ticket(self, ticket_id: int, request):
        assert ticket_id == 301
        assert request.replier_name == "teacherA"
        return {
            "ticket_id": 301,
            "reply_id": 901,
            "replier_name": "teacherA",
            "replier_role": "staff",
            "content": "先看事件循环示意图",
            "created_at": "2026-05-09T10:05:00+00:00",
        }

    monkeypatch.setattr(ChatTicketService, "reply_ticket", fake_reply_ticket)

    response = client.post(
        "/api/v1/chat/tickets/301/reply",
        json={"replier_name": "teacherA", "replier_role": "staff", "content": "先看事件循环示意图"},
    )

    assert response.status_code == 200
    assert response.json()["reply_id"] == 901


def test_update_chat_ticket_status_returns_payload(monkeypatch) -> None:
    async def fake_update_status(self, ticket_id: int, request):
        assert ticket_id == 301
        assert request.status == "closed"
        return {
            "ticket_id": 301,
            "user_id": 1001,
            "session_id": 88,
            "course_code": "PYTHON-AI",
            "title": "Need tutor help",
            "question_summary": "stuck on asyncio",
            "latest_answer": "event loop unclear",
            "priority": "high",
            "status": "closed",
            "created_at": "2026-05-09T10:00:00+00:00",
            "updated_at": "2026-05-09T10:10:00+00:00",
            "replies": [],
        }

    monkeypatch.setattr(ChatTicketService, "update_status", fake_update_status)

    response = client.put("/api/v1/chat/tickets/301/status", json={"status": "closed"})

    assert response.status_code == 200
    assert response.json()["status"] == "closed"
