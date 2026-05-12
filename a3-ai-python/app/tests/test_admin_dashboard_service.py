from types import SimpleNamespace

import pytest

from app.services import admin_dashboard_service as admin_dashboard_service_module
from app.services.admin_dashboard_service import AdminDashboardService


class _FakeSessionFactory:
    def __init__(self, session) -> None:
        self._session = session

    async def __aenter__(self):
        return self._session

    async def __aexit__(self, exc_type, exc, tb) -> bool:
        return False


def _patch_session_factory(monkeypatch, session) -> None:
    monkeypatch.setattr(admin_dashboard_service_module, "async_session_factory", lambda: _FakeSessionFactory(session))


@pytest.mark.asyncio
async def test_get_summary_aggregates_dashboard_metrics(monkeypatch) -> None:
    session = SimpleNamespace()
    _patch_session_factory(monkeypatch, session)

    payload = {
        "profiles": [
            SimpleNamespace(user_id=1001, id=1, version=2, updated_at="2026-05-09T20:10:00+00:00"),
            SimpleNamespace(user_id=1002, id=2, version=1, updated_at="2026-05-09T20:11:00+00:00"),
        ],
        "plans": [
            SimpleNamespace(user_id=1001, id=11, course_code="PYTHON-AI", status="active", plan_data={}, updated_at="2026-05-09T20:12:00+00:00"),
            SimpleNamespace(user_id=1002, id=12, course_code="JAVA-CORE", status="active", plan_data={}, updated_at="2026-05-09T20:13:00+00:00"),
        ],
        "evaluations": [],
        "tickets": [
            SimpleNamespace(user_id=1001, status="open", updated_at="2026-05-09T20:14:00+00:00"),
            SimpleNamespace(user_id=1001, status="processing", updated_at="2026-05-09T20:15:00+00:00"),
        ],
        "progress_items": [
            SimpleNamespace(plan_id=11, status="pending"),
            SimpleNamespace(plan_id=11, status="pending"),
            SimpleNamespace(plan_id=12, status="completed"),
        ],
        "controls": [
            SimpleNamespace(user_id=1002, status="suspended", reason="manual", updated_by="adminA", updated_at="2026-05-09T20:16:00+00:00"),
        ],
    }

    class FakeOverviewRepository:
        async def list_user_overview(self, session_obj):
            assert session_obj is session
            return payload

    class FakeReviewRepository:
        async def list_tasks(self, session_obj, **kwargs):
            assert session_obj is session
            assert kwargs["status"] == "pending"
            return [
                SimpleNamespace(id=1, updated_at="2026-05-09T20:17:00+00:00"),
                SimpleNamespace(id=2, updated_at="2026-05-09T20:18:00+00:00"),
            ], 2

    class FakeConfigRepository:
        async def list_configs(self, session_obj):
            assert session_obj is session
            return [
                SimpleNamespace(config_key="llm.api_key", updated_at="2026-05-09T20:19:00+00:00"),
                SimpleNamespace(config_key="rag.top_k", updated_at="2026-05-09T20:10:00+00:00"),
            ]

    class FakeAgentRepository:
        async def list_logs(self, session_obj, **kwargs):
            assert session_obj is session
            return [
                SimpleNamespace(agent_name="planner_agent", level="info", status="ok", message="ok", created_at="2026-05-09T20:00:00+00:00", updated_at="2026-05-09T20:00:00+00:00"),
                SimpleNamespace(agent_name="evaluator_agent", level="warn", status="degraded", message="slow", created_at="2026-05-09T20:01:00+00:00", updated_at="2026-05-09T20:01:00+00:00"),
            ], 2

    monkeypatch.setattr(admin_dashboard_service_module, "AdminUserOverviewRepository", lambda: FakeOverviewRepository())
    monkeypatch.setattr(admin_dashboard_service_module, "ReviewTaskRepository", lambda: FakeReviewRepository())
    monkeypatch.setattr(admin_dashboard_service_module, "SystemConfigRepository", lambda: FakeConfigRepository())
    monkeypatch.setattr(admin_dashboard_service_module, "AgentRuntimeRepository", lambda: FakeAgentRepository())

    response = await AdminDashboardService().get_summary()

    assert response.total_users == 2
    assert response.high_risk_users == 1
    assert response.suspended_users == 1
    assert response.open_ticket_count == 2
    assert response.pending_review_count == 2
    assert response.degraded_agent_count == 1
    assert response.sensitive_config_count == 1
    assert response.latest_activity_at == "2026-05-09T20:19:00+00:00"
