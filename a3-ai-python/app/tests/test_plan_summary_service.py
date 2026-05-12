from types import SimpleNamespace

import pytest

from app.services import plan_summary_service as plan_summary_service_module
from app.services.plan_summary_service import PlanSummaryService


class _FakeSessionFactory:
    def __init__(self, session) -> None:
        self._session = session

    async def __aenter__(self):
        return self._session

    async def __aexit__(self, exc_type, exc, tb) -> bool:
        return False


def _patch_session_factory(monkeypatch, session) -> None:
    monkeypatch.setattr(plan_summary_service_module, "async_session_factory", lambda: _FakeSessionFactory(session))


@pytest.mark.asyncio
async def test_get_summary_aggregates_learning_plans(monkeypatch) -> None:
    session = SimpleNamespace()
    _patch_session_factory(monkeypatch, session)

    plans = [
        SimpleNamespace(
            status="active",
            course_code="PYTHON-AI",
            updated_at="2026-05-10T02:00:00+00:00",
            plan_data={"completion_rate": 60},
        ),
        SimpleNamespace(
            status="completed",
            course_code="PYTHON-AI",
            updated_at="2026-05-10T01:00:00+00:00",
            plan_data={"completion_rate": 100},
        ),
        SimpleNamespace(
            status="paused",
            course_code="JAVA-CORE",
            updated_at="2026-05-10T00:00:00+00:00",
            plan_data={"completion_rate": 20},
        ),
    ]

    class FakePlanRepository:
        async def list_by_user(self, session_obj, *, user_id: int):
            assert session_obj is session
            assert user_id == 1001
            return plans

    monkeypatch.setattr(plan_summary_service_module, "PlanRepository", lambda: FakePlanRepository())

    response = await PlanSummaryService().get_summary(user_id=1001)

    assert response.user_id == 1001
    assert response.total == 3
    assert response.average_completion_rate == 60.0
    assert response.by_status["active"] == 1
    assert response.by_course["PYTHON-AI"] == 2
    assert response.latest_updated_at == "2026-05-10T02:00:00+00:00"
