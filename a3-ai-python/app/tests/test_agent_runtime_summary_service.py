from types import SimpleNamespace

import pytest

from app.services import agent_runtime_summary_service as agent_runtime_summary_service_module
from app.services.agent_runtime_summary_service import AgentRuntimeSummaryService


class _FakeSessionFactory:
    def __init__(self, session) -> None:
        self._session = session

    async def __aenter__(self):
        return self._session

    async def __aexit__(self, exc_type, exc, tb) -> bool:
        return False


def _patch_session_factory(monkeypatch, session) -> None:
    monkeypatch.setattr(agent_runtime_summary_service_module, "async_session_factory", lambda: _FakeSessionFactory(session))


@pytest.mark.asyncio
async def test_get_summary_aggregates_agent_runtime_logs(monkeypatch) -> None:
    session = SimpleNamespace()
    _patch_session_factory(monkeypatch, session)

    items = [
        SimpleNamespace(agent_name="planner_agent", level="info", status="ok", created_at="2026-05-10T00:00:00+00:00"),
        SimpleNamespace(agent_name="evaluator_agent", level="warn", status="degraded", created_at="2026-05-09T23:00:00+00:00"),
        SimpleNamespace(agent_name="evaluator_agent", level="error", status="failed", created_at="2026-05-09T22:00:00+00:00"),
    ]

    class FakeAgentRuntimeRepository:
        async def list_logs(self, session_obj, **kwargs):
            assert session_obj is session
            assert kwargs["agent_name"] is None
            assert kwargs["level"] is None
            return items, len(items)

    monkeypatch.setattr(
        agent_runtime_summary_service_module,
        "AgentRuntimeRepository",
        lambda: FakeAgentRuntimeRepository(),
    )

    response = await AgentRuntimeSummaryService().get_summary()

    assert response.total == 3
    assert response.error_count == 1
    assert response.degraded_agent_count == 1
    assert response.by_agent["evaluation_feedback_agent"] == 2
    assert response.by_level["warn"] == 1
    assert response.latest_log_at == "2026-05-10T00:00:00+00:00"


@pytest.mark.asyncio
async def test_get_summary_counts_only_latest_degraded_agents(monkeypatch) -> None:
    session = SimpleNamespace()
    _patch_session_factory(monkeypatch, session)

    items = [
        SimpleNamespace(agent_name="planner_agent", level="info", status="ok", created_at="2026-05-10T02:00:00+00:00"),
        SimpleNamespace(agent_name="planner_agent", level="warn", status="degraded", created_at="2026-05-10T01:00:00+00:00"),
        SimpleNamespace(agent_name="evaluator_agent", level="error", status="failed", created_at="2026-05-10T00:30:00+00:00"),
    ]

    class FakeAgentRuntimeRepository:
        async def list_logs(self, session_obj, **kwargs):
            assert session_obj is session
            return items, len(items)

    monkeypatch.setattr(
        agent_runtime_summary_service_module,
        "AgentRuntimeRepository",
        lambda: FakeAgentRuntimeRepository(),
    )

    response = await AgentRuntimeSummaryService().get_summary()

    assert response.degraded_agent_count == 1
