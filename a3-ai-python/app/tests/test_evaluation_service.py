from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.services import evaluation_service as evaluation_service_module
from app.services.evaluation_service import EvaluationService


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
    monkeypatch.setattr(evaluation_service_module, "async_session_factory", lambda: _FakeSessionFactory(session))


@pytest.mark.asyncio
async def test_generate_paper_persists_questions_and_commits(monkeypatch) -> None:
    session = _FakeSession()
    _patch_session_factory(monkeypatch, session)

    captured: dict = {}

    class FakePaperRepository:
        async def create_paper(self, session_obj, **kwargs):
            captured.update(kwargs)
            assert session_obj is session
            return SimpleNamespace(id=501, status=kwargs["status"])

    class FakeEvaluationAgentService:
        async def generate_questions(self, request):
            return SimpleNamespace(
                questions=[
                    SimpleNamespace(
                        question_content="什么是事件循环？",
                        question_options=[
                            {"key": "A", "content": "调度异步任务"},
                            {"key": "B", "content": "删除协程"},
                        ],
                        correct_answer="A",
                        answer_analysis="事件循环负责调度异步任务。",
                        knowledge_point="asyncio",
                        difficulty_level=1,
                        question_type=1,
                    ),
                    SimpleNamespace(
                        question_content="如何理解 await？",
                        question_options=[
                            {"key": "A", "content": "同步阻塞"},
                            {"key": "B", "content": "挂起等待"},
                        ],
                        correct_answer="B",
                        answer_analysis="await 会挂起当前协程等待结果。",
                        knowledge_point="event loop",
                        difficulty_level=2,
                        question_type=1,
                    ),
                ]
            )

    monkeypatch.setattr(evaluation_service_module, "EvaluationPaperRepository", lambda: FakePaperRepository())
    monkeypatch.setattr(
        evaluation_service_module,
        "EvaluationAgentService",
        lambda: FakeEvaluationAgentService(),
    )

    response = await EvaluationService().generate_paper(
        SimpleNamespace(
            user_id=1001,
            course_code="PYTHON-AI",
            target="asyncio",
            knowledge_points=["asyncio", "event loop"],
            paper_type="diagnostic",
            question_count=2,
        )
    )

    assert response.paper_id == 501
    assert response.status == "generated"
    assert len(response.questions) == 2
    assert response.questions[0].prompt == "什么是事件循环？"
    assert captured["course_code"] == "PYTHON-AI"
    assert len(captured["questions_data"]) == 2
    assert session.committed is True


@pytest.mark.asyncio
async def test_generate_paper_falls_back_when_agent_generation_fails(monkeypatch) -> None:
    session = _FakeSession()
    _patch_session_factory(monkeypatch, session)

    class FakePaperRepository:
        async def create_paper(self, session_obj, **kwargs):
            return SimpleNamespace(id=502, status=kwargs["status"])

    class FakeEvaluationAgentService:
        async def generate_questions(self, request):
            raise RuntimeError("agent unavailable")

    monkeypatch.setattr(evaluation_service_module, "EvaluationPaperRepository", lambda: FakePaperRepository())
    monkeypatch.setattr(
        evaluation_service_module,
        "EvaluationAgentService",
        lambda: FakeEvaluationAgentService(),
    )

    response = await EvaluationService().generate_paper(
        SimpleNamespace(
            user_id=1001,
            course_code="PYTHON-AI",
            target="asyncio",
            knowledge_points=["asyncio", "event loop"],
            paper_type="diagnostic",
            question_count=2,
        )
    )

    assert response.paper_id == 502
    assert len(response.questions) == 2
    assert response.questions[0].question_id == "q1"
    assert "asyncio" in response.questions[0].prompt


@pytest.mark.asyncio
async def test_get_wrong_questions_raises_when_record_missing(monkeypatch) -> None:
    session = _FakeSession()
    _patch_session_factory(monkeypatch, session)

    class FakeEvaluationRepository:
        async def get_by_id(self, session_obj, record_id: int):
            assert session_obj is session
            assert record_id == 801
            return None

    monkeypatch.setattr(evaluation_service_module, "EvaluationRepository", lambda: FakeEvaluationRepository())

    with pytest.raises(HTTPException) as exc_info:
        await EvaluationService().get_wrong_questions(801)

    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == "evaluation result not found"


@pytest.mark.asyncio
async def test_get_wrong_questions_returns_empty_when_not_from_paper(monkeypatch) -> None:
    session = _FakeSession()
    _patch_session_factory(monkeypatch, session)

    record = SimpleNamespace(
        id=801,
        user_id=1001,
        result_data={
            "paper_id": None,
            "overall_score": 88.0,
            "evaluation_type": "diagnostic",
            "mastery_level": "stable",
            "report_summary": "ok",
            "strengths": [],
            "weak_points": [],
            "suggestions": [],
            "layered_results": [],
            "metrics": [],
            "knowledge_points": [],
            "recommended_actions": [],
            "path_feedback": {},
            "profile_feedback": {},
        },
    )

    class FakeEvaluationRepository:
        async def get_by_id(self, session_obj, record_id: int):
            assert session_obj is session
            assert record_id == 801
            return record

    class FakePaperRepository:
        async def list_wrong_answers_by_paper(self, session_obj, paper_id: int, user_id: int):
            raise AssertionError("should not query wrong answers when paper_id is None")

    monkeypatch.setattr(evaluation_service_module, "EvaluationRepository", lambda: FakeEvaluationRepository())
    monkeypatch.setattr(evaluation_service_module, "EvaluationPaperRepository", lambda: FakePaperRepository())

    response = await EvaluationService().get_wrong_questions(801)

    assert response.total == 0
    assert response.items == []
