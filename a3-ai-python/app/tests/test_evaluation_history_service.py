from types import SimpleNamespace

import pytest

from app.services import evaluation_history_service as evaluation_history_service_module
from app.services.evaluation_history_service import EvaluationHistoryService


class _FakeSessionFactory:
    def __init__(self, session) -> None:
        self._session = session

    async def __aenter__(self):
        return self._session

    async def __aexit__(self, exc_type, exc, tb) -> bool:
        return False


def _patch_session_factory(monkeypatch, session) -> None:
    monkeypatch.setattr(evaluation_history_service_module, "async_session_factory", lambda: _FakeSessionFactory(session))


@pytest.mark.asyncio
async def test_list_history_returns_items(monkeypatch) -> None:
    session = SimpleNamespace()
    _patch_session_factory(monkeypatch, session)

    records = [
        SimpleNamespace(
            id=803,
            course_code="PYTHON-AI",
            evaluation_type="paper_submission",
            created_at="2026-05-09T18:10:00+00:00",
            result_data={
                "paper_id": 501,
                "overall_score": 88.0,
                "evaluation_type": "paper_submission",
                "mastery_level": "good",
                "report_summary": "improving",
                "weak_points": ["asyncio"],
                "knowledge_points": ["event_loop"],
            },
        ),
    ]

    class FakeEvaluationRepository:
        async def list_by_user_course(self, session_obj, **kwargs):
            assert session_obj is session
            assert kwargs["user_id"] == 1001
            assert kwargs["course_code"] == "PYTHON-AI"
            return records

    monkeypatch.setattr(
        evaluation_history_service_module,
        "EvaluationRepository",
        lambda: FakeEvaluationRepository(),
    )

    response = await EvaluationHistoryService().list_history(user_id=1001, course_code="PYTHON-AI")

    assert response.total == 1
    assert response.items[0].record_id == 803
    assert response.items[0].paper_id == 501


@pytest.mark.asyncio
async def test_get_trend_builds_summary(monkeypatch) -> None:
    session = SimpleNamespace()
    _patch_session_factory(monkeypatch, session)

    records = [
        SimpleNamespace(
            id=803,
            course_code="PYTHON-AI",
            evaluation_type="paper_submission",
            result_data={
                "overall_score": 88.0,
                "mastery_level": "good",
                "weak_points": ["asyncio", "project"],
            },
        ),
        SimpleNamespace(
            id=801,
            course_code="PYTHON-AI",
            evaluation_type="diagnostic",
            result_data={
                "overall_score": 76.0,
                "mastery_level": "developing",
                "weak_points": ["asyncio"],
            },
        ),
    ]

    class FakeEvaluationRepository:
        async def list_by_user_course(self, session_obj, **kwargs):
            assert session_obj is session
            return records

    monkeypatch.setattr(
        evaluation_history_service_module,
        "EvaluationRepository",
        lambda: FakeEvaluationRepository(),
    )

    response = await EvaluationHistoryService().get_trend(user_id=1001, course_code="PYTHON-AI")

    assert response.total == 2
    assert response.latest_score == 88.0
    assert response.average_score == 82.0
    assert response.best_score == 88.0
    assert response.improvement == 12.0
    assert response.focus_knowledge_points[0] == "asyncio"
