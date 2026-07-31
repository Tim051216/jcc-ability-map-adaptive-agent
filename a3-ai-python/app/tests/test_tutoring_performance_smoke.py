"""智能辅导接口性能烟测。

基于 FastAPI TestClient + Mock TutoringService，避免依赖数据库、对象存储和真实 LLM。
目的不是做绝对性能压测，而是给本地开发一个可重复执行的时延守门。
"""

from contextlib import asynccontextmanager
from time import perf_counter
from unittest.mock import AsyncMock, MagicMock

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.deps import get_current_user_id, get_db_session
from app.api.v1 import tutoring
from app.services.tutoring_service import TutoringService

app = FastAPI()
app.include_router(tutoring.router, prefix="/api/v1/tutoring")


async def fake_user_id() -> int:
    return 1001


def _async_session_mock() -> MagicMock:
    db = MagicMock()
    db.add = MagicMock()
    db.commit = AsyncMock()
    db.execute = AsyncMock(
        return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=None))
    )
    db.delete = AsyncMock()
    return db


async def fake_db_session():
    yield _async_session_mock()


app.dependency_overrides[get_current_user_id] = fake_user_id
app.dependency_overrides[get_db_session] = fake_db_session

client = TestClient(app)


def _patch_ws_db_session(monkeypatch: object) -> None:
    @asynccontextmanager
    async def _cm():
        yield _async_session_mock()

    monkeypatch.setattr("app.api.v1.tutoring.async_session_factory", lambda: _cm())


def _p95_ms(values: list[float]) -> float:
    ordered = sorted(values)
    index = max(0, int(len(ordered) * 0.95) - 1)
    return ordered[index] * 1000


def test_get_answer_performance_smoke(monkeypatch: object) -> None:
    class Q:
        id = 77
        session_id = 10001
        user_id = 1001
        course_id = 1
        question_text = "性能烟测问题"
        question_images = []
        question_type = None
        knowledge_points = []
        difficulty_level = None
        has_answer = False
        question_status = 0
        is_escalated = False

    async def fake_get_question(self, qid: int):
        assert qid == 77
        return Q()

    async def fake_generate(self, qid: int, uid: int, on_event=None):
        assert qid == 77 and uid == 1001
        return {
            "answer_id": 501,
            "answer_text": "生成解答",
            "diagrams": [],
            "videos": [],
            "reference_sources": [],
            "confidence_score": 82.0,
            "generation_time": 12,
            "should_escalate": False,
        }

    async def fake_background_generate(qid: int, uid: int):
        assert qid == 77 and uid == 1001

    monkeypatch.setattr(TutoringService, "_get_question", fake_get_question)
    monkeypatch.setattr(TutoringService, "generate_answer", fake_generate)
    monkeypatch.setattr("app.api.v1.tutoring._generate_db_answer", fake_background_generate)

    latencies: list[float] = []
    for _ in range(40):
        started = perf_counter()
        response = client.get("/api/v1/tutoring/answer/77")
        latencies.append(perf_counter() - started)
        assert response.status_code == 200
        assert response.json()["status"] == "processing"

    assert _p95_ms(latencies) < 120.0


def test_websocket_stream_performance_smoke(monkeypatch: object) -> None:
    _patch_ws_db_session(monkeypatch)

    class Q:
        id = 42
        session_id = 10002
        user_id = 1001
        course_id = 1
        question_text = "已有答案性能烟测问题"
        question_images = []
        question_type = None
        knowledge_points = []
        difficulty_level = None
        has_answer = True
        question_status = 1
        is_escalated = False

    class A:
        id = 99
        question_id = 42
        session_id = 10002
        answer_text = "已有解答"
        answer_diagrams = []
        answer_videos = []
        reference_sources = []
        confidence_score = 70.0
        generation_time = 50
        view_count = 0

    async def fake_get_question(self, qid: int):
        assert qid == 42
        return Q()

    async def fake_get_answer_by_question(self, qid: int):
        assert qid == 42
        return A()

    monkeypatch.setattr(TutoringService, "_get_question", fake_get_question)
    monkeypatch.setattr(TutoringService, "_get_answer_by_question", fake_get_answer_by_question)

    latencies: list[float] = []
    for _ in range(20):
        started = perf_counter()
        with client.websocket_connect("/api/v1/tutoring/stream/42?user_id=1001") as ws:
            payload = ws.receive_json()
        latencies.append(perf_counter() - started)
        assert payload["chunk_type"] == "complete"
        assert payload["content"]["answer_id"] == 99

    assert _p95_ms(latencies) < 150.0
