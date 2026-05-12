from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.services import resource_delivery_service as resource_delivery_service_module
from app.services.resource_delivery_service import ResourceDeliveryService


class _FakeSession:
    def __init__(self) -> None:
        self.committed = False

    async def commit(self) -> None:
        self.committed = True


class _FakeSessionContext:
    def __init__(self, session):
        self._session = session

    async def __aenter__(self):
        return self._session

    async def __aexit__(self, exc_type, exc, tb):
        return False


class _FakeSessionFactory:
    def __init__(self, session):
        self._session = session

    def __call__(self):
        return _FakeSessionContext(self._session)


@pytest.mark.asyncio
async def test_get_preview_returns_excerpt(monkeypatch) -> None:
    session = _FakeSession()

    async def fake_get_resource(self, db_session, resource_id: int):
        assert db_session is session
        assert resource_id == 301
        return SimpleNamespace(
            id=301,
            title="Asyncio Note",
            resource_type="lecture_note",
            summary="事件循环概览",
            content_markdown="# Note\n\nline1\nline2\nline3",
            source_titles=["chapter-1"],
            is_archived=False,
        )

    monkeypatch.setattr(resource_delivery_service_module, "async_session_factory", _FakeSessionFactory(session))
    monkeypatch.setattr(resource_delivery_service_module.ResourceRepository, "get_resource", fake_get_resource)

    response = await ResourceDeliveryService().get_preview(301)

    assert response.resource_id == 301
    assert "line1" in response.excerpt_markdown


@pytest.mark.asyncio
async def test_download_resource_increments_count(monkeypatch) -> None:
    session = _FakeSession()
    resource = SimpleNamespace(
        id=302,
        user_id=1001,
        title="Asyncio Note",
        download_scope="owner",
        is_archived=False,
        download_count=0,
        content_markdown="# content",
    )

    async def fake_get_resource(self, db_session, resource_id: int):
        assert db_session is session
        assert resource_id == 302
        return resource

    async def fake_increment_download_count(self, db_session, *, resource, updated_at: str):
        assert db_session is session
        resource.download_count += 1
        resource.updated_at = updated_at
        return resource

    monkeypatch.setattr(resource_delivery_service_module, "async_session_factory", _FakeSessionFactory(session))
    monkeypatch.setattr(resource_delivery_service_module.ResourceRepository, "get_resource", fake_get_resource)
    monkeypatch.setattr(
        resource_delivery_service_module.ResourceRepository,
        "increment_download_count",
        fake_increment_download_count,
    )

    response = await ResourceDeliveryService().download_resource(user_id=1001, resource_id=302)

    assert response.download_count == 1
    assert session.committed is True


@pytest.mark.asyncio
async def test_download_resource_rejects_non_owner(monkeypatch) -> None:
    session = _FakeSession()

    async def fake_get_resource(self, db_session, resource_id: int):
        return SimpleNamespace(
            id=303,
            user_id=1001,
            title="Asyncio Note",
            download_scope="owner",
            is_archived=False,
            download_count=0,
            content_markdown="# content",
        )

    monkeypatch.setattr(resource_delivery_service_module, "async_session_factory", _FakeSessionFactory(session))
    monkeypatch.setattr(resource_delivery_service_module.ResourceRepository, "get_resource", fake_get_resource)

    with pytest.raises(HTTPException) as exc_info:
        await ResourceDeliveryService().download_resource(user_id=1002, resource_id=303)

    assert exc_info.value.status_code == 403
    assert exc_info.value.detail == "resource download forbidden"
