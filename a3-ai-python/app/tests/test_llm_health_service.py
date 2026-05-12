import pytest

from app.services import llm_health_service as llm_health_service_module
from app.services.llm_health_service import LLMHealthService


@pytest.mark.asyncio
async def test_ping_returns_not_configured_when_llm_settings_missing(monkeypatch) -> None:
    service = LLMHealthService()
    monkeypatch.setattr(service, "_configured", lambda: False)

    response = await service.ping()

    assert response["status"] == "not_configured"
    assert response["provider"] == llm_health_service_module.settings.llm_provider


@pytest.mark.asyncio
async def test_ping_returns_ok_when_provider_responds(monkeypatch) -> None:
    service = LLMHealthService()
    monkeypatch.setattr(service, "_configured", lambda: True)

    class FakeProvider:
        async def generate(self, messages):
            assert len(messages) == 2
            return "ok"

    monkeypatch.setattr(llm_health_service_module, "get_llm_provider", lambda: FakeProvider())

    response = await service.ping()

    assert response["status"] == "ok"
    assert response["message"] == "ok"


@pytest.mark.asyncio
async def test_ping_returns_unavailable_when_provider_raises(monkeypatch) -> None:
    service = LLMHealthService()
    monkeypatch.setattr(service, "_configured", lambda: True)

    class FakeProvider:
        async def generate(self, messages):
            raise RuntimeError("gateway timeout")

    monkeypatch.setattr(llm_health_service_module, "get_llm_provider", lambda: FakeProvider())

    response = await service.ping()

    assert response["status"] == "unavailable"
    assert "gateway timeout" in response["message"]
