from types import SimpleNamespace

import pytest

from app.services.admin_export_service import AdminExportService


def test_build_audit_log_csv_contains_header_and_rows() -> None:
    items = [
        SimpleNamespace(
            id=1,
            trace_id="trace-1",
            scene="content_review",
            action="review_task_created",
            payload={"review_id": 9},
            created_at="2026-05-09T10:00:00+00:00",
            updated_at="2026-05-09T10:01:00+00:00",
        )
    ]

    csv_text = AdminExportService._build_audit_log_csv(items)

    assert "log_id,trace_id,scene,action,payload,created_at,updated_at" in csv_text
    assert "trace-1" in csv_text
    assert "content_review" in csv_text
    assert "review_task_created" in csv_text
    assert '{""review_id"": 9}' in csv_text


def test_build_agent_runtime_csv_contains_header_and_rows() -> None:
    items = [
        SimpleNamespace(
            id=2,
            agent_name="planner_agent",
            level="info",
            status="ok",
            message="path generated",
            payload={"plan_id": 3},
            created_at="2026-05-09T10:02:00+00:00",
            updated_at="2026-05-09T10:03:00+00:00",
        )
    ]

    csv_text = AdminExportService._build_agent_runtime_csv(items)

    assert "log_id,agent_name,level,status,message,payload,created_at,updated_at" in csv_text
    assert "planner_agent" in csv_text
    assert "path generated" in csv_text
    assert '{""plan_id"": 3}' in csv_text


class _FakeSessionFactory:
    def __init__(self, session) -> None:
        self._session = session

    async def __aenter__(self):
        return self._session

    async def __aexit__(self, exc_type, exc, tb) -> bool:
        return False


def _patch_session_factory(monkeypatch, session) -> None:
    monkeypatch.setattr("app.db.session.async_session_factory", lambda: _FakeSessionFactory(session))


@pytest.mark.asyncio
async def test_export_agent_runtime_logs_csv_returns_header_only_when_no_logs(monkeypatch) -> None:
    session = SimpleNamespace()
    _patch_session_factory(monkeypatch, session)

    class FakeAgentRuntimeRepository:
        async def list_logs(self, session_obj, **kwargs):
            assert session_obj is session
            return [], 0

    monkeypatch.setattr("app.services.admin_export_service.AgentRuntimeRepository", lambda: FakeAgentRuntimeRepository())

    csv_text = await AdminExportService().export_agent_runtime_logs_csv()

    lines = [line for line in csv_text.splitlines() if line.strip()]
    assert lines == ["log_id,agent_name,level,status,message,payload,created_at,updated_at"]
