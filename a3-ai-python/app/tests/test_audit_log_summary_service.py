from types import SimpleNamespace

import pytest

from app.services import audit_log_summary_service as audit_log_summary_service_module
from app.services.audit_log_summary_service import AuditLogSummaryService


class _FakeSessionFactory:
    def __init__(self, session) -> None:
        self._session = session

    async def __aenter__(self):
        return self._session

    async def __aexit__(self, exc_type, exc, tb) -> bool:
        return False


def _patch_session_factory(monkeypatch, session) -> None:
    monkeypatch.setattr(audit_log_summary_service_module, "async_session_factory", lambda: _FakeSessionFactory(session))


@pytest.mark.asyncio
async def test_get_summary_aggregates_audit_logs(monkeypatch) -> None:
    session = SimpleNamespace()
    _patch_session_factory(monkeypatch, session)

    items = [
        SimpleNamespace(scene="system_config", action="system_config_updated", created_at="2026-05-09T23:00:00+00:00"),
        SimpleNamespace(scene="content_review", action="review_task_created", created_at="2026-05-09T22:00:00+00:00"),
        SimpleNamespace(scene="content_review", action="review_task_created", created_at="2026-05-09T21:00:00+00:00"),
    ]

    class FakeAuditLogRepository:
        async def list_logs(self, session_obj, **kwargs):
            assert session_obj is session
            assert kwargs["scene"] is None
            assert kwargs["action"] is None
            return items, len(items)

    monkeypatch.setattr(
        audit_log_summary_service_module,
        "AuditLogRepository",
        lambda: FakeAuditLogRepository(),
    )

    response = await AuditLogSummaryService().get_summary()

    assert response.total == 3
    assert response.by_scene["content_review"] == 2
    assert response.by_action["review_task_created"] == 2
    assert response.latest_log_at == "2026-05-09T23:00:00+00:00"
