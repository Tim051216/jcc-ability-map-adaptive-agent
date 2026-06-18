import asyncio
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.schemas.evaluation import EvaluationPaperGenerateRequest, EvaluationQuestion, QuestionGenerateRequest
from app.services import evaluation_service as evaluation_service_module
from app.services.evaluation_service import EvaluationService


class _FakeSession:
    def __init__(self) -> None:
        self.committed = False
        self.rows = []
        self.added = []
        self.executed = []

    async def commit(self) -> None:
        self.committed = True

    async def execute(self, query):
        self.executed.append(query)

        class _Result:
            def __init__(self, rows):
                self._rows = rows

            def scalars(self):
                class _Scalars:
                    def __init__(self, rows):
                        self._rows = rows

                    def all(self):
                        return self._rows

                return _Scalars(self._rows)

            def scalar_one(self):
                if isinstance(self._rows, (int, float)):
                    return self._rows
                return 0

        return _Result(self.rows)

    def add(self, item) -> None:
        self.added.append(item)


class _FakeSessionFactory:
    def __init__(self, session: _FakeSession) -> None:
        self._session = session

    async def __aenter__(self) -> _FakeSession:
        return self._session

    async def __aexit__(self, exc_type, exc, tb) -> bool:
        return False


def _patch_session_factory(monkeypatch, session: _FakeSession) -> None:
    monkeypatch.setattr(evaluation_service_module, "async_session_factory", lambda: _FakeSessionFactory(session))


def _patch_course_context(monkeypatch) -> None:
    class FakeCourseContextService:
        async def resolve(self, *, course_id=None, course_code=None):
            return SimpleNamespace(course_id=course_id, course_code=course_code or "PYTHON-AI")

    monkeypatch.setattr(evaluation_service_module, "CourseContextService", lambda: FakeCourseContextService())


@pytest.mark.asyncio
async def test_generate_paper_persists_questions_and_commits(monkeypatch) -> None:
    session = _FakeSession()
    _patch_session_factory(monkeypatch, session)
    _patch_course_context(monkeypatch)

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
        EvaluationPaperGenerateRequest(
            user_id=1001,
            course_code="PYTHON-AI",
            course_id=None,
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
    _patch_course_context(monkeypatch)

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
        EvaluationPaperGenerateRequest(
            user_id=1001,
            course_code="PYTHON-AI",
            course_id=None,
            target="asyncio",
            knowledge_points=["asyncio", "event loop"],
            paper_type="diagnostic",
            question_count=2,
        )
    )

    assert response.paper_id == 502
    assert len(response.questions) == 2
    assert response.questions[0].question_id == "q1"
    assert response.questions[0].knowledge_point == "asyncio"


@pytest.mark.asyncio
async def test_generate_question_bank_falls_back_after_timeout(monkeypatch) -> None:
    service = EvaluationService()
    monkeypatch.setattr(service, "QUESTION_BANK_USE_AGENT", True)
    monkeypatch.setattr(service, "QUESTION_BANK_SINGLE_TIMEOUT_SECONDS", 0.01)
    monkeypatch.setattr(service, "QUESTION_BANK_SINGLE_RETRY_COUNT", 1)
    monkeypatch.setattr(service, "QUESTION_BANK_MAX_CONCURRENCY", 2)
    monkeypatch.setattr(service, "_save_cached_question_bank", lambda **kwargs: asyncio.sleep(0))

    async def slow_agent_builder(request):
        await asyncio.sleep(0.05)
        return []

    monkeypatch.setattr(service, "_build_questions_with_agent", slow_agent_builder)

    response = await service.generate_question_bank(
        QuestionGenerateRequest(
            test_id=401,
            knowledge_points=["software crisis", "software lifecycle"],
            difficulty_level=2,
            question_type=1,
            count=3,
            generate_layered=False,
            course_context="software crisis and software lifecycle",
            persist_to_db=False,
        )
    )

    assert response.total_count == 3
    assert response.fallback_count == 3
    assert response.source == "fallback"
    assert len(response.questions) == 3


@pytest.mark.asyncio
async def test_generate_question_bank_keeps_ai_results_and_runs_concurrently(monkeypatch) -> None:
    service = EvaluationService()
    monkeypatch.setattr(service, "QUESTION_BANK_USE_AGENT", True)
    monkeypatch.setattr(service, "QUESTION_BANK_SINGLE_TIMEOUT_SECONDS", 1)
    monkeypatch.setattr(service, "QUESTION_BANK_SINGLE_RETRY_COUNT", 1)
    monkeypatch.setattr(service, "QUESTION_BANK_MAX_CONCURRENCY", 3)
    monkeypatch.setattr(service, "_save_cached_question_bank", lambda **kwargs: asyncio.sleep(0))

    active = 0
    max_active = 0

    async def fast_agent_builder(request):
        nonlocal active, max_active
        active += 1
        max_active = max(max_active, active)
        try:
            await asyncio.sleep(0.02)
            point = request.knowledge_points[0]
            return [
                EvaluationQuestion(
                    question_id="tmp",
                    question_type="single_choice",
                    prompt=f"What is the core concept of {point}?",
                    options=["A. Option 1", "B. Option 2", "C. Option 3", "D. Option 4"],
                    correct_answer="A",
                    explanation=f"Explanation for {point}",
                    knowledge_point=point,
                    difficulty="advanced",
                    source="ai",
                )
            ]
        finally:
            active -= 1

    monkeypatch.setattr(service, "_build_questions_with_agent", fast_agent_builder)

    response = await service.generate_question_bank(
        QuestionGenerateRequest(
            test_id=402,
            knowledge_points=["requirements analysis", "architecture design", "detailed design"],
            difficulty_level=2,
            question_type=1,
            count=3,
            generate_layered=False,
            course_context="software engineering fundamentals",
            persist_to_db=False,
        )
    )

    assert response.total_count == 3
    assert response.fallback_count == 0
    assert response.source == "ai"
    assert max_active >= 2
    assert all(item.quality_score == 1.0 for item in response.questions)


@pytest.mark.asyncio
async def test_generate_question_bank_uses_cached_questions(monkeypatch) -> None:
    session = _FakeSession()
    session.rows = [
        SimpleNamespace(
            id=11,
            order_num=1,
            question_type=1,
            difficulty_level=2,
            question_content="cached question 1",
            question_options=[{"key": "A", "value": "Option 1"}, {"key": "B", "value": "Option 2"}],
            correct_answer="A",
            answer_analysis="cached analysis 1",
            knowledge_point="software crisis",
            generation_model="cached_ai",
            generation_prompt="cache-key",
            status=1,
        ),
        SimpleNamespace(
            id=12,
            order_num=2,
            question_type=1,
            difficulty_level=2,
            question_content="cached question 2",
            question_options=[{"key": "A", "value": "Option 1"}, {"key": "B", "value": "Option 2"}],
            correct_answer="B",
            answer_analysis="cached analysis 2",
            knowledge_point="software lifecycle",
            generation_model="cached_ai",
            generation_prompt="cache-key",
            status=1,
        ),
    ]
    _patch_session_factory(monkeypatch, session)

    service = EvaluationService()

    async def fail_if_called(*args, **kwargs):
        raise AssertionError("should not generate when cache is hit")

    monkeypatch.setattr(service, "_build_questions", fail_if_called)
    monkeypatch.setattr(service, "_build_question_bank_cache_key", lambda **kwargs: "cache-key")

    response = await service.generate_question_bank(
        QuestionGenerateRequest(
            test_id=501,
            knowledge_points=["software crisis", "software lifecycle"],
            difficulty_level=2,
            question_type=1,
            count=2,
            generate_layered=False,
            course_context="software engineering",
            persist_to_db=True,
        )
    )

    assert response.total_count == 2
    assert response.fallback_count == 0
    assert response.questions[0].question_content == "cached question 1"
    assert session.committed is False


@pytest.mark.asyncio
async def test_generate_question_bank_persists_generated_questions(monkeypatch) -> None:
    session = _FakeSession()
    _patch_session_factory(monkeypatch, session)

    service = EvaluationService()

    async def empty_cache(*args, **kwargs):
        return []

    monkeypatch.setattr(service, "_load_cached_question_bank", empty_cache)
    monkeypatch.setattr(
        service,
        "_build_questions",
        lambda request: [
            EvaluationQuestion(
                question_id="q1",
                question_type="single_choice",
                prompt="generated question",
                options=["A. One", "B. Two"],
                correct_answer="A",
                explanation="analysis",
                knowledge_point="software crisis",
                difficulty="advanced",
                source="fallback",
            )
        ],
    )

    response = await service.generate_question_bank(
        QuestionGenerateRequest(
            test_id=601,
            knowledge_points=["software crisis"],
            difficulty_level=2,
            question_type=1,
            count=1,
            generate_layered=False,
            course_context="software engineering",
            persist_to_db=True,
        )
    )

    assert response.total_count == 1
    assert len(session.added) == 1
    assert session.added[0].generation_prompt.startswith(service.QUESTION_BANK_CACHE_PREFIX)
    assert session.committed is True


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
