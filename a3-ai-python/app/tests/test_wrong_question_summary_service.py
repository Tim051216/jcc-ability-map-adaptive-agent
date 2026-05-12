from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.services import wrong_question_summary_service as wrong_question_summary_service_module
from app.services.wrong_question_summary_service import WrongQuestionSummaryService


class _FakeSessionFactory:
    def __init__(self, session) -> None:
        self._session = session

    async def __aenter__(self):
        return self._session

    async def __aexit__(self, exc_type, exc, tb) -> bool:
        return False


def _patch_session_factory(monkeypatch, session) -> None:
    monkeypatch.setattr(wrong_question_summary_service_module, "async_session_factory", lambda: _FakeSessionFactory(session))


@pytest.mark.asyncio
async def test_get_summary_returns_empty_when_record_not_from_paper(monkeypatch) -> None:
    session = SimpleNamespace()
    _patch_session_factory(monkeypatch, session)

    record = SimpleNamespace(id=801, user_id=1001, result_data={"paper_id": None})

    class FakeEvaluationRepository:
        async def get_by_id(self, session_obj, record_id: int):
            assert session_obj is session
            assert record_id == 801
            return record

    monkeypatch.setattr(
        wrong_question_summary_service_module,
        "EvaluationRepository",
        lambda: FakeEvaluationRepository(),
    )

    response = await WrongQuestionSummaryService().get_summary(801)

    assert response.total == 0
    assert response.paper_id is None


@pytest.mark.asyncio
async def test_get_summary_aggregates_wrong_answers(monkeypatch) -> None:
    session = SimpleNamespace()
    _patch_session_factory(monkeypatch, session)

    record = SimpleNamespace(id=802, user_id=1001, result_data={"paper_id": 501})
    wrong_answers = [
        SimpleNamespace(knowledge_point="asyncio", question_type="single_choice"),
        SimpleNamespace(knowledge_point="asyncio", question_type="single_choice"),
        SimpleNamespace(knowledge_point="event_loop", question_type="short_answer"),
    ]

    class FakeEvaluationRepository:
        async def get_by_id(self, session_obj, record_id: int):
            assert session_obj is session
            assert record_id == 802
            return record

    class FakePaperRepository:
        async def list_wrong_answers_by_paper(self, session_obj, *, paper_id: int, user_id: int):
            assert session_obj is session
            assert paper_id == 501
            assert user_id == 1001
            return wrong_answers

    monkeypatch.setattr(
        wrong_question_summary_service_module,
        "EvaluationRepository",
        lambda: FakeEvaluationRepository(),
    )
    monkeypatch.setattr(
        wrong_question_summary_service_module,
        "EvaluationPaperRepository",
        lambda: FakePaperRepository(),
    )

    response = await WrongQuestionSummaryService().get_summary(802)

    assert response.total == 3
    assert response.by_knowledge_point["asyncio"] == 2
    assert response.by_question_type["single_choice"] == 2


@pytest.mark.asyncio
async def test_get_summary_raises_when_record_missing(monkeypatch) -> None:
    session = SimpleNamespace()
    _patch_session_factory(monkeypatch, session)

    class FakeEvaluationRepository:
        async def get_by_id(self, session_obj, record_id: int):
            assert session_obj is session
            assert record_id == 999
            return None

    monkeypatch.setattr(
        wrong_question_summary_service_module,
        "EvaluationRepository",
        lambda: FakeEvaluationRepository(),
    )

    with pytest.raises(HTTPException) as exc_info:
        await WrongQuestionSummaryService().get_summary(999)

    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == "evaluation result not found"
