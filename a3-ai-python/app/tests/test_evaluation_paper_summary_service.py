from types import SimpleNamespace

import pytest

from app.services import evaluation_paper_summary_service as evaluation_paper_summary_service_module
from app.services.evaluation_paper_summary_service import EvaluationPaperSummaryService


class _FakeSessionFactory:
    def __init__(self, session) -> None:
        self._session = session

    async def __aenter__(self):
        return self._session

    async def __aexit__(self, exc_type, exc, tb) -> bool:
        return False


def _patch_session_factory(monkeypatch, session) -> None:
    monkeypatch.setattr(
        evaluation_paper_summary_service_module,
        "async_session_factory",
        lambda: _FakeSessionFactory(session),
    )


@pytest.mark.asyncio
async def test_get_summary_aggregates_papers(monkeypatch) -> None:
    session = SimpleNamespace()
    _patch_session_factory(monkeypatch, session)

    papers = [
        SimpleNamespace(
            paper_type="diagnostic",
            updated_at="2026-05-10T05:00:00+00:00",
            questions_data=[
                {"question_type": "single_choice", "knowledge_point": "asyncio"},
                {"question_type": "short_answer", "knowledge_point": "event_loop"},
            ],
        ),
        SimpleNamespace(
            paper_type="practice",
            updated_at="2026-05-10T04:00:00+00:00",
            questions_data=[
                {"question_type": "single_choice", "knowledge_point": "asyncio"},
            ],
        ),
    ]

    class FakePaperRepository:
        async def list_papers_by_user(self, session_obj, **kwargs):
            assert session_obj is session
            assert kwargs["user_id"] == 1001
            assert kwargs["course_code"] == "PYTHON-AI"
            assert kwargs["limit"] == 5
            return papers

    monkeypatch.setattr(
        evaluation_paper_summary_service_module,
        "EvaluationPaperRepository",
        lambda: FakePaperRepository(),
    )

    response = await EvaluationPaperSummaryService().get_summary(
        user_id=1001,
        course_code="PYTHON-AI",
        limit=5,
    )

    assert response.total == 2
    assert response.total_questions == 3
    assert response.by_paper_type["diagnostic"] == 1
    assert response.by_question_type["single_choice"] == 2
    assert response.by_knowledge_point["asyncio"] == 2
    assert response.latest_paper_at == "2026-05-10T05:00:00+00:00"
