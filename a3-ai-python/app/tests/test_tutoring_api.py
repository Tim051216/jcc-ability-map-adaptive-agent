"""智能辅导 HTTP 接口烟测（通过 Mock TutoringService 避免依赖数据库与 LLM）。"""

from contextlib import asynccontextmanager
from unittest.mock import AsyncMock, MagicMock

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.deps import get_current_user_id, get_db_session
from app.api.v1 import tutoring
from app.schemas.tutoring import TutoringHistoryResponse
from app.services.tutoring_task_service import TutoringTaskService
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
    """WebSocket 处理器内部自建 session，需单独打桩。"""

    @asynccontextmanager
    async def _cm():
        yield _async_session_mock()

    monkeypatch.setattr("app.api.v1.tutoring.async_session_factory", lambda: _cm())


def test_websocket_stream_completed_sends_complete(monkeypatch: object) -> None:
    _patch_ws_db_session(monkeypatch)

    class Q:
        user_id = 1001
        has_answer = True

    class A:
        id = 99
        answer_text = "已有解答"
        answer_diagrams = []
        answer_videos = []
        reference_sources = []
        confidence_score = 70.0
        generation_time = 50

    async def fake_get_question(self, qid: int):
        assert qid == 42
        return Q()

    async def fake_get_answer_by_question(self, qid: int):
        assert qid == 42
        return A()

    monkeypatch.setattr(TutoringService, "_get_question", fake_get_question)
    monkeypatch.setattr(TutoringService, "_get_answer_by_question", fake_get_answer_by_question)

    with client.websocket_connect("/api/v1/tutoring/stream/42?user_id=1001") as ws:
        msg = ws.receive_json()
    assert msg["chunk_type"] == "complete"
    assert msg["content"]["answer_id"] == 99
    assert msg["content"]["answer_text"] == "已有解答"
    assert msg["content"]["should_escalate"] is False
    assert msg["content"]["safety_review"]["output_review"]["blocked"] is False


def test_websocket_stream_pending_emits_step_and_saved(monkeypatch: object) -> None:
    _patch_ws_db_session(monkeypatch)

    class Q:
        user_id = 1001
        has_answer = False

    async def fake_get_question(self, qid: int):
        return Q()

    async def fake_generate(self, qid: int, uid: int, on_event=None):
        assert qid == 42 and uid == 1001
        if on_event:
            await on_event(
                {
                    "chunk_type": "step",
                    "content": "analyzing",
                    "metadata": {"label": "问题分析"},
                }
            )
        return {
            "answer_id": 501,
            "answer_text": "流式生成",
            "diagrams": [],
            "videos": [],
            "reference_sources": [],
            "confidence_score": 80.0,
            "generation_time": 10,
            "should_escalate": False,
        }

    monkeypatch.setattr(TutoringService, "_get_question", fake_get_question)
    monkeypatch.setattr(TutoringService, "generate_answer", fake_generate)

    with client.websocket_connect(
        "/api/v1/tutoring/stream/42",
        headers={"x-user-id": "1001"},
    ) as ws:
        m1 = ws.receive_json()
        m2 = ws.receive_json()
    assert m1["chunk_type"] == "step"
    assert m1["content"] == "analyzing"
    assert m2["chunk_type"] == "saved"
    assert m2["content"]["answer_text"] == "流式生成"


def test_websocket_stream_forbidden_wrong_user(monkeypatch: object) -> None:
    _patch_ws_db_session(monkeypatch)

    class Q:
        user_id = 9999
        has_answer = False

    async def fake_get_question(self, qid: int):
        return Q()

    monkeypatch.setattr(TutoringService, "_get_question", fake_get_question)

    with client.websocket_connect("/api/v1/tutoring/stream/42?user_id=1001") as ws:
        msg = ws.receive_json()
    assert msg["chunk_type"] == "error"
    assert "无权" in msg["content"] or "不存在" in msg["content"]


def test_websocket_stream_missing_user_when_not_debug(monkeypatch: object) -> None:
    _patch_ws_db_session(monkeypatch)

    with client.websocket_connect("/api/v1/tutoring/stream/42") as ws:
        msg = ws.receive_json()
    assert msg["chunk_type"] == "error"
    assert "auth" in msg["content"].lower() or "missing" in msg["content"].lower()


def test_websocket_stream_accepts_access_token(monkeypatch: object) -> None:
    _patch_ws_db_session(monkeypatch)

    class Q:
        user_id = 1001
        has_answer = True

    class A:
        id = 77
        answer_text = "Token 登录解答"
        answer_diagrams = []
        answer_videos = []
        reference_sources = []
        confidence_score = 88.0
        generation_time = 18

    async def fake_get_question(self, qid: int):
        assert qid == 42
        return Q()

    async def fake_get_answer_by_question(self, qid: int):
        assert qid == 42
        return A()

    monkeypatch.setattr(TutoringService, "_get_question", fake_get_question)
    monkeypatch.setattr(TutoringService, "_get_answer_by_question", fake_get_answer_by_question)

    with client.websocket_connect("/api/v1/tutoring/stream/42?access_token=student-demo") as ws:
        msg = ws.receive_json()
    assert msg["chunk_type"] == "complete"
    assert msg["content"]["answer_id"] == 77


def test_submit_question_validation_returns_400(monkeypatch: object) -> None:
    async def bad_submit(self, user_id: int, request: object):
        raise ValueError("问题内容不能为空")

    monkeypatch.setattr(TutoringService, "submit_question", bad_submit)

    response = client.post(
        "/api/v1/tutoring/question",
        json={
            "question_text": " ",
            "question_images": None,
            "course_id": 1,
            "section_id": None,
            "session_id": None,
        },
    )
    assert response.status_code == 400
    assert "问题" in response.json()["detail"]


def test_submit_question_returns_ids(monkeypatch: object) -> None:
    async def fake_submit(self, user_id: int, request: object) -> dict:
        assert user_id == 1001
        return {"question_id": 9001, "session_id": 8001}

    monkeypatch.setattr(TutoringService, "submit_question", fake_submit)

    response = client.post(
        "/api/v1/tutoring/question",
        json={
            "question_text": "什么是梯度下降？",
            "question_images": None,
            "course_id": 1,
            "section_id": None,
            "session_id": None,
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["question_id"] == 9001
    assert body["session_id"] == 8001


def test_submit_tutoring_task_success(monkeypatch: object) -> None:
    async def fake_submit_task(self, user_id: int, request: object) -> object:
        assert user_id == 1001
        assert request.question_text == "请解释过拟合"
        return {
            "task_id": 9001,
            "status": "pending",
            "question_id": 123,
            "session_id": 456,
            "poll_interval_ms": 2000,
        }

    monkeypatch.setattr(TutoringTaskService, "submit_task", fake_submit_task)

    response = client.post(
        "/api/v1/tutoring/tasks",
        json={
            "question_text": "请解释过拟合",
            "question_images": [],
            "course_id": 101,
            "section_id": None,
            "session_id": None,
        },
    )

    assert response.status_code == 200
    assert response.json()["task_id"] == 9001


def test_get_tutoring_task_status_success(monkeypatch: object) -> None:
    async def fake_get_status(self, task_id: int) -> object:
        assert task_id == 9001
        return {
            "task_id": 9001,
            "status": "completed",
            "question_id": 123,
            "session_id": 456,
            "result": {
                "question_id": 123,
                "session_id": 456,
                "answer_id": 789,
                "answer_text": "训练集表现远好于验证集时，常见于过拟合。",
                "diagrams": [],
                "videos": [],
                "reference_sources": [],
                "confidence_score": 88.5,
                "generation_time": 1200,
                "should_escalate": False,
                "question_type": "概念理解",
                "knowledge_points": ["过拟合"],
            },
            "error_message": None,
        }

    monkeypatch.setattr(TutoringTaskService, "get_task_status", fake_get_status)

    response = client.get("/api/v1/tutoring/tasks/9001")
    assert response.status_code == 200
    assert response.json()["result"]["answer_id"] == 789


def test_list_tutoring_tasks_success(monkeypatch: object) -> None:
    async def fake_list_tasks(self, *, user_id: int | None = None, course_id: int | None = None, limit: int = 10) -> object:
        assert user_id == 1001
        assert course_id == 101
        assert limit == 5
        return {
            "items": [
                {
                    "task_id": 9001,
                    "user_id": 1001,
                    "question_id": 123,
                    "session_id": 456,
                    "course_id": 101,
                    "question_text": "请解释过拟合",
                    "status": "completed",
                    "answer_text": "训练集表现远好于验证集时，常见于过拟合。",
                    "created_at": "2026-05-01T00:00:00",
                    "updated_at": "2026-05-01T00:01:00",
                }
            ],
            "total": 1,
        }

    monkeypatch.setattr(TutoringTaskService, "list_tasks", fake_list_tasks)

    response = client.get("/api/v1/tutoring/tasks?course_id=101&limit=5")
    assert response.status_code == 200
    assert response.json()["total"] == 1


def test_get_answer_completed_includes_should_escalate(monkeypatch: object) -> None:
    class Q:
        user_id = 1001
        has_answer = True

    class A:
        id = 42
        answer_text = "解答"
        answer_diagrams = []
        answer_videos = []
        reference_sources = []
        confidence_score = 55.0
        generation_time = 100

    async def fake_get_question(self, qid: int):
        assert qid == 1
        return Q()

    async def fake_get_answer_by_question(self, qid: int):
        return A()

    monkeypatch.setattr(TutoringService, "_get_question", fake_get_question)
    monkeypatch.setattr(TutoringService, "_get_answer_by_question", fake_get_answer_by_question)

    response = client.get("/api/v1/tutoring/answer/1")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "completed"
    assert body["answer_id"] == 42
    assert body["should_escalate"] is True
    assert body["safety_review"]["output_review"]["blocked"] is False


def test_history_returns_payload(monkeypatch: object) -> None:
    async def fake_query_history(self, user_id: int, query: object) -> dict:
        assert user_id == 1001
        return {"total": 0, "page": 1, "page_size": 20, "items": []}

    monkeypatch.setattr(TutoringService, "query_history", fake_query_history)

    response = client.get("/api/v1/tutoring/history")

    assert response.status_code == 200
    parsed = TutoringHistoryResponse.model_validate(response.json())
    assert parsed.total == 0
    assert parsed.items == []


def test_history_forwards_query_params_to_service(monkeypatch: object) -> None:
    captured: dict = {}

    async def fake_query_history(self, user_id: int, query: object) -> dict:
        captured["user_id"] = user_id
        captured["course_id"] = query.course_id
        captured["section_id"] = query.section_id
        captured["question_type"] = query.question_type
        captured["keyword"] = query.keyword
        captured["start_date"] = query.start_date
        captured["end_date"] = query.end_date
        captured["page"] = query.page
        captured["page_size"] = query.page_size
        return {"total": 0, "page": query.page, "page_size": query.page_size, "items": []}

    monkeypatch.setattr(TutoringService, "query_history", fake_query_history)

    response = client.get(
        "/api/v1/tutoring/history"
        "?course_id=7&section_id=12&question_type=concept&keyword=grad"
        "&start_date=2026-05-01T00:00:00&end_date=2026-05-10T00:00:00&page=2&page_size=10"
    )
    assert response.status_code == 200
    assert captured["user_id"] == 1001
    assert captured["course_id"] == 7
    assert captured["section_id"] == 12
    assert captured["question_type"] == "concept"
    assert captured["keyword"] == "grad"
    assert captured["start_date"] is not None
    assert captured["start_date"].year == 2026
    assert captured["start_date"].month == 5
    assert captured["start_date"].day == 1
    assert captured["end_date"] is not None
    assert captured["end_date"].year == 2026
    assert captured["end_date"].month == 5
    assert captured["end_date"].day == 10
    assert captured["page"] == 2
    assert captured["page_size"] == 10


def test_evaluate_answer(monkeypatch: object) -> None:
    async def fake_evaluate(self, user_id: int, request: object) -> dict:
        assert user_id == 1001
        return {"status": "success"}

    monkeypatch.setattr(TutoringService, "evaluate_answer", fake_evaluate)

    response = client.post(
        "/api/v1/tutoring/evaluate",
        json={
            "answer_id": 42,
            "is_helpful": True,
            "user_rating": 5,
            "user_feedback": "很好",
        },
    )
    assert response.status_code == 200
    assert response.json()["status"] == "success"


def test_escalate(monkeypatch: object) -> None:
    async def fake_escalate(self, user_id: int, request: object) -> dict:
        assert user_id == 1001
        return {"status": "success", "escalation_id": 7001}

    monkeypatch.setattr(TutoringService, "create_escalation", fake_escalate)

    response = client.post(
        "/api/v1/tutoring/escalate",
        json={"question_id": 1, "escalation_reason": 3},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "success"
    assert body["escalation_id"] == 7001


def test_list_escalations(monkeypatch: object) -> None:
    captured: dict = {}

    async def fake_list(self, user_id: int, **kwargs: object) -> dict:
        captured["user_id"] = user_id
        captured.update(kwargs)
        return {"total": 1, "page": 1, "page_size": 10, "items": []}

    monkeypatch.setattr(TutoringService, "list_escalations", fake_list)

    response = client.get("/api/v1/tutoring/escalations?course_id=9&escalation_status=1&assigned_expert_id=3001&page=1&page_size=10")
    assert response.status_code == 200
    assert captured["user_id"] == 1001
    assert captured["course_id"] == 9
    assert captured["escalation_status"] == 1
    assert captured["assigned_expert_id"] == 3001


def test_get_escalation_detail(monkeypatch: object) -> None:
    class R:
        id = 88
        question_id = 1
        escalation_reason = 3
        session_id = 2
        user_id = 1001
        ai_confidence_score = None
        escalation_status = 1
        assigned_expert_id = 3001
        assign_time = None
        expert_answer_id = None
        complete_time = None
        response_time = None
        expert_notes = None
        feedback_to_ai = False
        create_time = "2026-05-01T00:00:00"
        update_time = "2026-05-01T00:00:00"
        question_text = "如何理解过拟合"
        question_images = ["https://example.com/q1.png"]
        question_type = "概念理解"
        knowledge_points = ["过拟合"]
        latest_answer_id = 501
        latest_answer_text = "可以从训练集和验证集表现差异判断。"
        latest_answer_source = 0

    async def fake_detail(self, escalation_id: int, user_id: int | None = None):
        assert escalation_id == 88
        assert user_id == 1001
        return R()

    monkeypatch.setattr(TutoringService, "get_escalation_detail", fake_detail)

    response = client.get("/api/v1/tutoring/escalations/88")
    assert response.status_code == 200
    assert response.json()["id"] == 88
    assert response.json()["question_text"] == "如何理解过拟合"


def test_assign_escalation(monkeypatch: object) -> None:
    async def fake_assign(self, request: object) -> dict:
        assert request.escalation_id == 88
        assert request.expert_id == 3001
        return {"status": "success", "escalation_id": 88, "assigned_expert_id": 3001}

    monkeypatch.setattr(TutoringService, "assign_escalation", fake_assign)

    response = client.post(
        "/api/v1/tutoring/escalations/assign",
        json={"escalation_id": 88, "expert_id": 3001, "notes": "handle asap"},
    )
    assert response.status_code == 200
    assert response.json()["assigned_expert_id"] == 3001


def test_submit_expert_answer(monkeypatch: object) -> None:
    async def fake_submit(self, request: object) -> dict:
        assert request.escalation_id == 88
        assert request.expert_id == 3001
        assert request.answer_text == "人工补充说明"
        return {"status": "success", "answer_id": 9001, "escalation_id": 88}

    monkeypatch.setattr(TutoringService, "submit_expert_answer", fake_submit)

    response = client.post(
        "/api/v1/tutoring/escalations/answer",
        json={
            "escalation_id": 88,
            "expert_id": 3001,
            "answer_text": "人工补充说明",
            "expert_notes": "已处理",
            "feedback_to_ai": True,
        },
    )
    assert response.status_code == 200
    assert response.json()["answer_id"] == 9001


def test_admin_list_escalations(monkeypatch: object) -> None:
    captured: dict = {}

    async def fake_list(self, user_id: int | None = None, **kwargs: object) -> dict:
        captured["user_id"] = user_id
        captured.update(kwargs)
        return {"total": 1, "page": 1, "page_size": 20, "items": []}

    monkeypatch.setattr(TutoringService, "list_escalations", fake_list)

    response = client.get("/api/v1/tutoring/admin/escalations?course_id=5&escalation_status=0")
    assert response.status_code == 200
    assert captured["user_id"] is None
    assert captured["course_id"] == 5
    assert captured["escalation_status"] == 0


def test_admin_get_escalation_detail(monkeypatch: object) -> None:
    class R:
        id = 99
        question_id = 2
        escalation_reason = 1
        session_id = 8
        user_id = 1002
        ai_confidence_score = 55
        escalation_status = 0
        assigned_expert_id = None
        assign_time = None
        expert_answer_id = None
        complete_time = None
        response_time = None
        expert_notes = None
        feedback_to_ai = False
        create_time = "2026-05-01T00:00:00"
        update_time = "2026-05-01T00:00:00"
        question_text = "请帮我看这道题"
        question_images = []
        question_type = "解题方法"
        knowledge_points = ["回归分析"]
        latest_answer_id = 777
        latest_answer_text = "先分析题干，再拆步骤。"
        latest_answer_source = 1

    async def fake_detail(self, escalation_id: int, user_id: int | None = None):
        assert escalation_id == 99
        assert user_id is None
        return R()

    monkeypatch.setattr(TutoringService, "get_escalation_detail", fake_detail)

    response = client.get("/api/v1/tutoring/admin/escalations/99")
    assert response.status_code == 200
    assert response.json()["id"] == 99
    assert response.json()["latest_answer_id"] == 777


def test_get_answer_404_when_question_belongs_to_other_user(monkeypatch: object) -> None:
    class Q:
        user_id = 9999
        has_answer = False

    async def fake_get_question(self, qid: int):
        assert qid == 1
        return Q()

    monkeypatch.setattr(TutoringService, "_get_question", fake_get_question)

    response = client.get("/api/v1/tutoring/answer/1")
    assert response.status_code == 404


def test_add_favorite_success(monkeypatch: object) -> None:
    class Q:
        user_id = 1001

    class A:
        question_id = 1

    async def fake_get_question(self, qid: int):
        assert qid == 1
        return Q()

    async def fake_get_answer(self, aid: int):
        assert aid == 42
        return A()

    async def fake_not_favorited(self, uid: int, qid: int):
        assert uid == 1001 and qid == 1
        return False

    monkeypatch.setattr(TutoringService, "_get_question", fake_get_question)
    monkeypatch.setattr(TutoringService, "_get_answer", fake_get_answer)
    monkeypatch.setattr(TutoringService, "_is_favorited", fake_not_favorited)
    monkeypatch.setattr(TutoringService, "_generate_id", staticmethod(lambda: 88001))

    response = client.post(
        "/api/v1/tutoring/favorite",
        params={"question_id": 1, "answer_id": 42, "note": "mark"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "success"
    assert body["favorite_id"] == 88001


def test_add_favorite_duplicate_returns_400(monkeypatch: object) -> None:
    class Q:
        user_id = 1001

    class A:
        question_id = 1

    async def fake_get_question(self, qid: int):
        return Q()

    async def fake_get_answer(self, aid: int):
        return A()

    async def fake_already_favorited(self, uid: int, qid: int):
        return True

    monkeypatch.setattr(TutoringService, "_get_question", fake_get_question)
    monkeypatch.setattr(TutoringService, "_get_answer", fake_get_answer)
    monkeypatch.setattr(TutoringService, "_is_favorited", fake_already_favorited)

    response = client.post(
        "/api/v1/tutoring/favorite",
        params={"question_id": 1, "answer_id": 42},
    )
    assert response.status_code == 400
    assert "已收藏" in response.json()["detail"]


def test_remove_favorite_success() -> None:
    fav = MagicMock()

    async def session_with_row():
        db = MagicMock()
        exec_result = MagicMock()
        exec_result.scalar_one_or_none = MagicMock(return_value=fav)
        db.execute = AsyncMock(return_value=exec_result)
        db.delete = AsyncMock()
        db.commit = AsyncMock()
        yield db

    prev = app.dependency_overrides[get_db_session]
    app.dependency_overrides[get_db_session] = session_with_row
    try:
        response = client.delete("/api/v1/tutoring/favorite/55")
        assert response.status_code == 200
        assert response.json()["status"] == "success"
    finally:
        app.dependency_overrides[get_db_session] = prev


def test_get_answer_404_when_question_not_found(monkeypatch: object) -> None:
    async def fake_get_question(self, qid: int):
        assert qid == 99
        return None

    monkeypatch.setattr(TutoringService, "_get_question", fake_get_question)

    response = client.get("/api/v1/tutoring/answer/99")
    assert response.status_code == 404


def test_get_answer_returns_processing_when_pending(monkeypatch: object) -> None:
    class Q:
        id = 77
        session_id = 7001
        user_id = 1001
        has_answer = False
        is_escalated = False
        question_type = None
        knowledge_points = []

    async def fake_get_question(self, qid: int):
        assert qid == 77
        return Q()

    monkeypatch.setattr(TutoringService, "_get_question", fake_get_question)
    monkeypatch.setattr("app.api.v1.tutoring._generate_db_answer", AsyncMock())

    response = client.get("/api/v1/tutoring/answer/77")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "processing"
    assert body["question_id"] == 77
    assert body["session_id"] == 7001
    assert body["answer_id"] is None


def test_add_favorite_404_when_answer_not_for_question(monkeypatch: object) -> None:
    class Q:
        user_id = 1001

    class A:
        question_id = 999

    async def fake_get_question(self, qid: int):
        return Q()

    async def fake_get_answer(self, aid: int):
        return A()

    monkeypatch.setattr(TutoringService, "_get_question", fake_get_question)
    monkeypatch.setattr(TutoringService, "_get_answer", fake_get_answer)

    response = client.post(
        "/api/v1/tutoring/favorite",
        params={"question_id": 1, "answer_id": 42},
    )
    assert response.status_code == 404


def test_ocr_preview_invalid_base64_returns_400() -> None:
    response = client.post(
        "/api/v1/tutoring/ocr-preview",
        json={"image_base64": "@@@not-base64@@@"},
    )
    assert response.status_code == 400


def test_ocr_preview_minimal_png_returns_200() -> None:
    """1x1 PNG；无 OCR 依赖时 engine=none，有 Pillow+Tesseract 时可能识别出空串。"""

    png_b64 = (
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
    )
    response = client.post(
        "/api/v1/tutoring/ocr-preview",
        json={"image_base64": png_b64},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["engine"] in ("none", "tesseract")
    assert "text" in body
    assert "hint" in body


def test_upload_image_returns_url(monkeypatch: object) -> None:
    def fake_upload(user_id: int, data: bytes, content_type: str):
        assert user_id == 1001
        assert data == b"png-bytes"
        assert content_type == "image/png"
        return type("Result", (), {"url": "https://minio.example/learning/t.png", "extracted_text": None})()

    monkeypatch.setattr(
        "app.api.v1.tutoring.upload_tutoring_attachment",
        fake_upload,
    )
    response = client.post(
        "/api/v1/tutoring/upload-image",
        files={"file": ("a.png", b"png-bytes", "image/png")},
    )
    assert response.status_code == 200
    assert response.json()["url"] == "https://minio.example/learning/t.png"
    assert response.json()["extracted_text"] is None


def test_upload_image_validation_returns_400(monkeypatch: object) -> None:
    def bad_upload(*_a, **_k):
        raise ValueError("仅支持 JPEG、PNG、WebP、GIF")

    monkeypatch.setattr(
        "app.api.v1.tutoring.upload_tutoring_attachment",
        bad_upload,
    )
    response = client.post(
        "/api/v1/tutoring/upload-image",
        files={"file": ("a.txt", b"x", "text/plain")},
    )
    assert response.status_code == 400


def test_upload_image_storage_returns_503(monkeypatch: object) -> None:
    def fail_upload(*_a, **_k):
        raise RuntimeError("minio refused")

    monkeypatch.setattr(
        "app.api.v1.tutoring.upload_tutoring_attachment",
        fail_upload,
    )
    response = client.post(
        "/api/v1/tutoring/upload-image",
        files={"file": ("a.png", b"x", "image/png")},
    )
    assert response.status_code == 503


def test_remove_favorite_not_found_returns_404() -> None:
    async def session_empty():
        db = MagicMock()
        exec_result = MagicMock()
        exec_result.scalar_one_or_none = MagicMock(return_value=None)
        db.execute = AsyncMock(return_value=exec_result)
        yield db

    prev = app.dependency_overrides[get_db_session]
    app.dependency_overrides[get_db_session] = session_empty
    try:
        response = client.delete("/api/v1/tutoring/favorite/999")
        assert response.status_code == 404
    finally:
        app.dependency_overrides[get_db_session] = prev
