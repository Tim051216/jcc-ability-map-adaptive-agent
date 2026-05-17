import pytest

from app.services import llm_health_service as llm_health_service_module
from app.services.llm_health_service import LLMHealthService


@pytest.mark.asyncio
async def test_ping_returns_not_configured_when_llm_settings_missing(monkeypatch) -> None:
    service = LLMHealthService()
    monkeypatch.setattr(LLMHealthService, "_cached_response", None)
    monkeypatch.setattr(LLMHealthService, "_cached_at", 0.0)
    monkeypatch.setattr(service, "_configured", lambda: False)

    response = await service.ping()

    assert response["status"] == "not_configured"
    assert response["provider"] == llm_health_service_module.settings.llm_provider


@pytest.mark.asyncio
async def test_ping_returns_ok_when_provider_responds(monkeypatch) -> None:
    service = LLMHealthService()
    monkeypatch.setattr(LLMHealthService, "_cached_response", None)
    monkeypatch.setattr(LLMHealthService, "_cached_at", 0.0)
    monkeypatch.setattr(service, "_configured", lambda: True)

    class FakeProvider:
        async def ping(self):
            return "provider reachable"

    monkeypatch.setattr(llm_health_service_module, "get_llm_provider", lambda: FakeProvider())

    response = await service.ping()

    assert response["status"] == "ok"
    assert response["message"] == "provider reachable"


@pytest.mark.asyncio
async def test_ping_returns_unavailable_when_provider_raises(monkeypatch) -> None:
    service = LLMHealthService()
    monkeypatch.setattr(LLMHealthService, "_cached_response", None)
    monkeypatch.setattr(LLMHealthService, "_cached_at", 0.0)
    monkeypatch.setattr(service, "_configured", lambda: True)

    class FakeProvider:
        async def ping(self):
            raise RuntimeError("gateway timeout")

    monkeypatch.setattr(llm_health_service_module, "get_llm_provider", lambda: FakeProvider())

    response = await service.ping()

    assert response["status"] == "unavailable"
    assert "gateway timeout" in response["message"]


@pytest.mark.asyncio
async def test_ping_reuses_cached_response_within_ttl(monkeypatch) -> None:
    service = LLMHealthService()
    monkeypatch.setattr(LLMHealthService, "_cached_response", None)
    monkeypatch.setattr(LLMHealthService, "_cached_at", 0.0)
    monkeypatch.setattr(service, "_configured", lambda: True)

    state = {"calls": 0}

    class FakeProvider:
        async def ping(self):
            state["calls"] += 1
            return "provider reachable"

    monkeypatch.setattr(llm_health_service_module, "get_llm_provider", lambda: FakeProvider())

    first = await service.ping()
    second = await service.ping()

    assert first["status"] == "ok"
    assert second["status"] == "ok"
    assert state["calls"] == 1
