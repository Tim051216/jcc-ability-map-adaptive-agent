from types import SimpleNamespace

import pytest

from app.services import resource_favorite_summary_service as resource_favorite_summary_service_module
from app.services.resource_favorite_summary_service import ResourceFavoriteSummaryService


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
async def test_get_summary_aggregates_favorites(monkeypatch) -> None:
    session = SimpleNamespace()

    async def fake_list_favorites(self, session_obj, *, user_id: int):
        assert session_obj is session
        assert user_id == 1001
        return [
            SimpleNamespace(resource_type="quiz_set"),
            SimpleNamespace(resource_type="quiz_set"),
            SimpleNamespace(resource_type="mind_map"),
        ]

    async def fake_list_favorite_history(self, session_obj, *, user_id: int):
        assert session_obj is session
        assert user_id == 1001
        return [
            SimpleNamespace(action="favorite", created_at="2026-05-10T01:00:00+00:00"),
            SimpleNamespace(action="unfavorite", created_at="2026-05-10T00:00:00+00:00"),
        ]

    monkeypatch.setattr(resource_favorite_summary_service_module, "async_session_factory", _FakeSessionFactory(session))
    monkeypatch.setattr(resource_favorite_summary_service_module.ResourceRepository, "list_favorites", fake_list_favorites)
    monkeypatch.setattr(
        resource_favorite_summary_service_module.ResourceRepository,
        "list_favorite_history",
        fake_list_favorite_history,
    )

    response = await ResourceFavoriteSummaryService().get_summary(user_id=1001)

    assert response.user_id == 1001
    assert response.total == 3
    assert response.by_type["quiz_set"] == 2
    assert response.latest_favorite_at == "2026-05-10T01:00:00+00:00"
