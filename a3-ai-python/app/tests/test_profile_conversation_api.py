"""对话式画像 HTTP 接口烟测（Mock ProfileConversationService，不连库、不调 LLM）。"""

from datetime import datetime
from unittest.mock import MagicMock

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.deps import get_db_session
from app.api.v1 import profile_conversation
from app.schemas.profile_conversation import (
    ConversationMessageResponse,
    ConversationSessionResponse,
    ProfileHistoryResponse,
    StudentProfileDetail,
)
from app.services.profile_conversation_service import ProfileConversationService


async def fake_db_session():
    yield MagicMock()


app = FastAPI()
app.include_router(profile_conversation.router, prefix="/api/v1")
app.dependency_overrides[get_db_session] = fake_db_session

client = TestClient(app)


def test_start_conversation_returns_session(monkeypatch: object) -> None:
    now = datetime(2026, 1, 1, 10, 0, 0)

    async def fake_start(self: object, user_id: int, session_type: int = 1) -> ConversationSessionResponse:
        assert user_id == 1001
        assert session_type == 1
        return ConversationSessionResponse(
            session_id=42,
            user_id=user_id,
            status=0,
            session_type=session_type,
            total_rounds=0,
            collected_dimensions=[],
            completeness=0,
            start_time=now,
            end_time=None,
            messages=[
                ConversationMessageResponse(
                    message_id=1,
                    role="assistant",
                    content="欢迎",
                    round_number=0,
                    message_type=2,
                    related_dimension=None,
                    created_at=now,
                ),
            ],
        )

    monkeypatch.setattr(ProfileConversationService, "start_conversation", fake_start)

    resp = client.post("/api/v1/profile/conversation/start", json={"user_id": 1001, "session_type": 1})
    assert resp.status_code == 200
    data = resp.json()
    assert data["session_id"] == 42
    assert len(data["messages"]) == 1


def test_get_session_returns_404_when_missing(monkeypatch: object) -> None:
    async def fake_get(self: object, session_id: int) -> None:
        assert session_id == 999
        return None

    monkeypatch.setattr(ProfileConversationService, "get_session", fake_get)

    resp = client.get("/api/v1/profile/conversation/session/999")
    assert resp.status_code == 404
    assert resp.json()["detail"] == "会话不存在"


def test_send_message_returns_400_on_value_error(monkeypatch: object) -> None:
    async def fake_process(self: object, session_id: int, user_message: str):
        raise ValueError("会话已结束")

    monkeypatch.setattr(ProfileConversationService, "process_message", fake_process)

    resp = client.post(
        "/api/v1/profile/conversation/message",
        json={"session_id": 1, "content": "hello"},
    )
    assert resp.status_code == 400
    assert resp.json()["detail"] == "会话已结束"


def test_complete_returns_400_when_completeness_too_low(monkeypatch: object) -> None:
    async def fake_complete(self: object, session_id: int, force_complete: bool = False):
        raise ValueError("画像信息不足")

    monkeypatch.setattr(ProfileConversationService, "complete_conversation", fake_complete)

    resp = client.post(
        "/api/v1/profile/conversation/complete",
        json={"session_id": 1, "force_complete": False},
    )
    assert resp.status_code == 400
    assert "画像信息不足" in resp.json()["detail"]


def test_get_profile_returns_detail(monkeypatch: object) -> None:
    now = datetime(2026, 1, 2, 10, 0, 0)

    async def fake_get_profile(self: object, user_id: int):
        assert user_id == 1002
        return StudentProfileDetail(
            profile_id=10,
            user_id=user_id,
            version=1,
            dimensions=[],
            tags=["Python"],
            completeness=70,
            summary="测试中",
            created_at=now,
            updated_at=now,
        )

    monkeypatch.setattr(ProfileConversationService, "get_profile", fake_get_profile)

    resp = client.get("/api/v1/profile/conversation/profile/1002")
    assert resp.status_code == 200
    body = resp.json()
    assert body["user_id"] == 1002
    assert body["tags"] == ["Python"]


def test_behavior_returns_400_when_no_profile(monkeypatch: object) -> None:
    async def fake_update(self: object, **kwargs):
        raise ValueError("画像不存在")

    monkeypatch.setattr(ProfileConversationService, "update_profile_by_behavior", fake_update)

    resp = client.post(
        "/api/v1/profile/conversation/behavior",
        json={
            "user_id": 1003,
            "behavior_type": 1,
            "behavior_data": {"result": "correct"},
        },
    )
    assert resp.status_code == 400


def test_get_history_returns_structure(monkeypatch: object) -> None:
    async def fake_history(self: object, user_id: int, limit: int = 10):
        assert limit == 5
        return ProfileHistoryResponse(
            user_id=user_id,
            profile_id=5,
            history=[],
            total=0,
        )

    monkeypatch.setattr(ProfileConversationService, "get_profile_history", fake_history)

    resp = client.get("/api/v1/profile/conversation/profile/1004/history", params={"limit": 5})
    assert resp.status_code == 200
    assert resp.json()["profile_id"] == 5
