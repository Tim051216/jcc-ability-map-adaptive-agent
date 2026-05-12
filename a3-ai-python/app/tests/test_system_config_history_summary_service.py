from types import SimpleNamespace

import pytest

from app.services import system_config_history_summary_service as system_config_history_summary_service_module
from app.services.system_config_history_summary_service import SystemConfigHistorySummaryService


class _FakeSessionFactory:
    def __init__(self, session) -> None:
        self._session = session

    async def __aenter__(self):
        return self._session

    async def __aexit__(self, exc_type, exc, tb) -> bool:
        return False


def _patch_session_factory(monkeypatch, session) -> None:
    monkeypatch.setattr(
        system_config_history_summary_service_module,
        "async_session_factory",
        lambda: _FakeSessionFactory(session),
    )


@pytest.mark.asyncio
async def test_get_summary_aggregates_config_history(monkeypatch) -> None:
    session = SimpleNamespace()
    _patch_session_factory(monkeypatch, session)

    logs = [
        SimpleNamespace(
            payload={"config_key": "llm.provider", "updated_by": "adminA"},
            created_at="2026-05-10T06:00:00+00:00",
        ),
        SimpleNamespace(
            payload={"config_key": "llm.provider", "updated_by": "adminB"},
            created_at="2026-05-10T05:00:00+00:00",
        ),
        SimpleNamespace(
            payload={"config_key": "rag.top_k", "updated_by": "adminA"},
            created_at="2026-05-10T04:00:00+00:00",
        ),
    ]

    class FakeAuditLogRepository:
        async def list_logs(self, session_obj, **kwargs):
            assert session_obj is session
            assert kwargs["scene"] == "system_config"
            assert kwargs["action"] == "system_config_updated"
            return logs, len(logs)

    monkeypatch.setattr(
        system_config_history_summary_service_module,
        "AuditLogRepository",
        lambda: FakeAuditLogRepository(),
    )

    response = await SystemConfigHistorySummaryService().get_summary(updated_by="adminA")

    assert response.total == 2
    assert response.by_config_key["llm.provider"] == 1
    assert response.by_updated_by["adminA"] == 2
    assert response.latest_created_at == "2026-05-10T06:00:00+00:00"
