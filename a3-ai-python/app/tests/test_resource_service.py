from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.services import resource_service as resource_service_module
from app.services.resource_service import ResourceService


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


class _FakeSession:
    def __init__(self) -> None:
        self.committed = False

    async def commit(self) -> None:
        self.committed = True


@pytest.mark.asyncio
async def test_get_download_access_allows_owner(monkeypatch) -> None:
    session = _FakeSession()

    async def fake_get_resource(self, db_session, resource_id: int):
        assert db_session is session
        assert resource_id == 301
        return SimpleNamespace(
            id=301,
            user_id=1001,
            is_archived=False,
            download_scope="owner",
        )

    monkeypatch.setattr(resource_service_module, "async_session_factory", _FakeSessionFactory(session))
    monkeypatch.setattr(resource_service_module.ResourceRepository, "get_resource", fake_get_resource)

    response = await ResourceService().get_download_access(user_id=1001, resource_id=301)

    assert response.can_download is True
    assert response.reason == "download allowed"


@pytest.mark.asyncio
async def test_get_download_access_blocks_archived_resource(monkeypatch) -> None:
    session = _FakeSession()

    async def fake_get_resource(self, db_session, resource_id: int):
        return SimpleNamespace(
            id=302,
            user_id=1001,
            is_archived=True,
            download_scope="public",
        )

    monkeypatch.setattr(resource_service_module, "async_session_factory", _FakeSessionFactory(session))
    monkeypatch.setattr(resource_service_module.ResourceRepository, "get_resource", fake_get_resource)

    response = await ResourceService().get_download_access(user_id=1002, resource_id=302)

    assert response.can_download is False
    assert response.reason == "resource archived"


@pytest.mark.asyncio
async def test_archive_resource_updates_flags(monkeypatch) -> None:
    session = _FakeSession()
    resource = SimpleNamespace(
        id=303,
        user_id=1001,
        is_archived=False,
        archived_at=None,
        archived_by=None,
        archive_reason=None,
        updated_at=None,
    )

    async def fake_get_resource(self, db_session, resource_id: int):
        assert resource_id == 303
        return resource

    monkeypatch.setattr(resource_service_module, "async_session_factory", _FakeSessionFactory(session))
    monkeypatch.setattr(resource_service_module.ResourceRepository, "get_resource", fake_get_resource)

    response = await ResourceService().archive_resource(
        303,
        SimpleNamespace(user_id=1001, archived_by="adminA", reason="old version"),
    )

    assert response.archived is True
    assert resource.is_archived is True
    assert resource.archived_by == "adminA"
    assert session.committed is True


@pytest.mark.asyncio
async def test_archive_resource_rejects_non_owner(monkeypatch) -> None:
    session = _FakeSession()

    async def fake_get_resource(self, db_session, resource_id: int):
        return SimpleNamespace(
            id=304,
            user_id=1001,
            is_archived=False,
            archived_at=None,
            archived_by=None,
            archive_reason=None,
            updated_at=None,
        )

    monkeypatch.setattr(resource_service_module, "async_session_factory", _FakeSessionFactory(session))
    monkeypatch.setattr(resource_service_module.ResourceRepository, "get_resource", fake_get_resource)

    with pytest.raises(HTTPException) as exc_info:
        await ResourceService().archive_resource(
            304,
            SimpleNamespace(user_id=1002, archived_by="adminA", reason="forbidden"),
        )

    assert exc_info.value.status_code == 403


def test_build_title_and_summary_use_ascii_fallbacks() -> None:
    assert ResourceService._build_title("quiz_set", "JAVA-CORE") == "JAVA-CORE 分层练习"
    assert "异步编程" in ResourceService._build_summary("lecture_note", "JAVA-CORE", ["异步编程"])


@pytest.mark.asyncio
async def test_generate_resources_supports_frontend_alias_types(monkeypatch) -> None:
    captured: dict = {}

    async def fake_persist_resources(self, request, resources):
        captured["types"] = [item.resource_type for item in resources]
        captured["titles"] = [item.title for item in resources]
        return [
            item.model_copy(update={"resource_id": index + 1})
            for index, item in enumerate(resources)
        ]

    async def fake_generate_with_coordinator(self, request, resource_types):
        return []

    monkeypatch.setattr(ResourceService, "_persist_resources", fake_persist_resources)
    monkeypatch.setattr(ResourceService, "_generate_with_coordinator", fake_generate_with_coordinator)

    response = await ResourceService().generate_resources(
        SimpleNamespace(
            user_id=1001,
            course_code="PYTHON-AI",
            knowledge_points=["过拟合", "泛化误差"],
            resource_types=["lecture_notes", "practice_set", "case_study"],
        )
    )

    assert captured["types"] == ["lecture_notes", "practice_set", "case_study"]
    assert response.resources[0].resource_id == 1
    assert "PYTHON-AI" in captured["titles"][0]


@pytest.mark.asyncio
async def test_generate_resources_prefers_coordinator_output(monkeypatch) -> None:
    async def fake_generate_with_coordinator(self, request, resource_types):
        return [
            resource_service_module.ResourceCard(
                resource_type="lecture_notes",
                title="AI 讲义",
                summary="真实生成摘要",
                content_markdown="# AI 讲义",
                source_titles=["过拟合"],
                study_suggestion="先读后练",
            )
        ]

    async def fake_persist_resources(self, request, resources):
        return [resources[0].model_copy(update={"resource_id": 99})]

    monkeypatch.setattr(ResourceService, "_generate_with_coordinator", fake_generate_with_coordinator)
    monkeypatch.setattr(ResourceService, "_persist_resources", fake_persist_resources)

    response = await ResourceService().generate_resources(
        SimpleNamespace(
            user_id=1001,
            course_code="PYTHON-AI",
            knowledge_points=["过拟合"],
            resource_types=["lecture_notes"],
        )
    )

    assert response.resources[0].resource_id == 99
    assert response.resources[0].title == "AI 讲义"
    assert response.recommended_order == ["AI 讲义"]
