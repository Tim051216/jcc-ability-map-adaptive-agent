from types import SimpleNamespace

import pytest

from app.services import system_config_summary_service as system_config_summary_service_module
from app.services.system_config_summary_service import SystemConfigSummaryService


class _FakeSessionFactory:
    def __init__(self, session) -> None:
        self._session = session

    async def __aenter__(self):
        return self._session

    async def __aexit__(self, exc_type, exc, tb) -> bool:
        return False


def _patch_session_factory(monkeypatch, session) -> None:
    monkeypatch.setattr(system_config_summary_service_module, "async_session_factory", lambda: _FakeSessionFactory(session))


@pytest.mark.asyncio
async def test_get_summary_aggregates_system_configs(monkeypatch) -> None:
    session = SimpleNamespace()
    _patch_session_factory(monkeypatch, session)

    items = [
        SimpleNamespace(config_key="llm.api_key", updated_at="2026-05-10T00:30:00+00:00"),
        SimpleNamespace(config_key="llm.provider", updated_at="2026-05-10T00:10:00+00:00"),
        SimpleNamespace(config_key="rag.top_k", updated_at="2026-05-09T23:10:00+00:00"),
    ]

    class FakeSystemConfigRepository:
        async def list_configs(self, session_obj):
            assert session_obj is session
            return items

    monkeypatch.setattr(
        system_config_summary_service_module,
        "SystemConfigRepository",
        lambda: FakeSystemConfigRepository(),
    )

    response = await SystemConfigSummaryService().get_summary()

    assert response.total == 3
    assert response.sensitive_count == 1
    assert response.by_prefix["llm"] == 2
    assert response.by_prefix["rag"] == 1
    assert response.latest_updated_at == "2026-05-10T00:30:00+00:00"
