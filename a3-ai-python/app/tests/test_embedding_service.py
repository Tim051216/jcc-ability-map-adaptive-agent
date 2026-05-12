import pytest

from app.services import embedding_service as embedding_service_module
from app.services.embedding_service import EmbeddingService


@pytest.mark.asyncio
async def test_ping_returns_local_when_remote_not_enabled(monkeypatch) -> None:
    service = EmbeddingService()
    monkeypatch.setattr(service, "_remote_enabled", lambda: False)

    response = await service.ping()

    assert response["status"] == "local"
    assert response["active_backend"] == "hash"
    assert response["dimension"] == embedding_service_module.settings.milvus_dimension


@pytest.mark.asyncio
async def test_ping_returns_ok_when_remote_embedding_available(monkeypatch) -> None:
    service = EmbeddingService()
    monkeypatch.setattr(service, "_remote_enabled", lambda: True)

    async def fake_request_remote_embedding(text: str) -> list[float]:
        assert text == "embedding health check"
        return [0.1] * embedding_service_module.settings.milvus_dimension

    monkeypatch.setattr(service, "_request_remote_embedding", fake_request_remote_embedding)

    response = await service.ping()

    assert response["status"] == "ok"
    assert response["active_backend"] == "remote"
    assert response["dimension"] == embedding_service_module.settings.milvus_dimension


@pytest.mark.asyncio
async def test_ping_returns_degraded_when_remote_embedding_fails(monkeypatch) -> None:
    service = EmbeddingService()
    monkeypatch.setattr(service, "_remote_enabled", lambda: True)

    async def fake_request_remote_embedding(text: str) -> list[float]:
        raise RuntimeError("connect timeout")

    monkeypatch.setattr(service, "_request_remote_embedding", fake_request_remote_embedding)

    response = await service.ping()

    assert response["status"] == "degraded"
    assert response["active_backend"] == "hash"
    assert "connect timeout" in response["message"]
