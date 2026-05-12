from types import SimpleNamespace

import pytest

from app.services import resource_archive_summary_service as resource_archive_summary_service_module
from app.services.resource_archive_summary_service import ResourceArchiveSummaryService


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
async def test_get_summary_aggregates_archived_resources(monkeypatch) -> None:
    session = SimpleNamespace()

    async def fake_list_resources(self, session_obj, **kwargs):
        assert session_obj is session
        assert kwargs["user_id"] == 1001
        assert kwargs["archived_only"] is True
        return [
            SimpleNamespace(resource_type="quiz_set", archived_by="adminA", archived_at="2026-05-10T04:00:00+00:00"),
            SimpleNamespace(resource_type="quiz_set", archived_by="adminA", archived_at="2026-05-10T03:00:00+00:00"),
            SimpleNamespace(resource_type="mind_map", archived_by="adminB", archived_at="2026-05-10T02:00:00+00:00"),
        ], 3

    monkeypatch.setattr(resource_archive_summary_service_module, "async_session_factory", _FakeSessionFactory(session))
    monkeypatch.setattr(
        resource_archive_summary_service_module.ResourceRepository,
        "list_resources",
        fake_list_resources,
    )

    response = await ResourceArchiveSummaryService().get_summary(user_id=1001)

    assert response.total == 3
    assert response.by_type["quiz_set"] == 2
    assert response.by_archived_by["adminA"] == 2
    assert response.latest_archived_at == "2026-05-10T04:00:00+00:00"
