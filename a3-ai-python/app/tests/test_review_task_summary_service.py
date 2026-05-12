from types import SimpleNamespace

import pytest

from app.services import review_task_summary_service as review_task_summary_service_module
from app.services.review_task_summary_service import ReviewTaskSummaryService


class _FakeSessionFactory:
    def __init__(self, session) -> None:
        self._session = session

    async def __aenter__(self):
        return self._session

    async def __aexit__(self, exc_type, exc, tb) -> bool:
        return False


def _patch_session_factory(monkeypatch, session) -> None:
    monkeypatch.setattr(review_task_summary_service_module, "async_session_factory", lambda: _FakeSessionFactory(session))


@pytest.mark.asyncio
async def test_get_summary_aggregates_review_tasks(monkeypatch) -> None:
    session = SimpleNamespace()
    _patch_session_factory(monkeypatch, session)

    items = [
        SimpleNamespace(status="pending", priority="high", source_scene="manual_submit", updated_at="2026-05-09T22:00:00+00:00"),
        SimpleNamespace(status="approved", priority="normal", source_scene="system_scan", updated_at="2026-05-09T21:00:00+00:00"),
        SimpleNamespace(status="pending", priority="high", source_scene="manual_submit", updated_at="2026-05-09T20:00:00+00:00"),
    ]

    class FakeReviewTaskRepository:
        async def list_tasks(self, session_obj, **kwargs):
            assert session_obj is session
            return items, len(items)

    monkeypatch.setattr(
        review_task_summary_service_module,
        "ReviewTaskRepository",
        lambda: FakeReviewTaskRepository(),
    )

    response = await ReviewTaskSummaryService().get_summary()

    assert response.total == 3
    assert response.pending_count == 2
    assert response.by_status["pending"] == 2
    assert response.by_priority["high"] == 2
    assert response.by_source_scene["manual_submit"] == 2
    assert response.latest_review_at == "2026-05-09T22:00:00+00:00"
