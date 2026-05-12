from types import SimpleNamespace

import pytest

from app.services import profile_tag_summary_service as profile_tag_summary_service_module
from app.services.profile_tag_summary_service import ProfileTagSummaryService


class _FakeSessionFactory:
    def __init__(self, session) -> None:
        self._session = session

    async def __aenter__(self):
        return self._session

    async def __aexit__(self, exc_type, exc, tb) -> bool:
        return False


def _patch_session_factory(monkeypatch, session) -> None:
    monkeypatch.setattr(profile_tag_summary_service_module, "async_session_factory", lambda: _FakeSessionFactory(session))


@pytest.mark.asyncio
async def test_get_summary_aggregates_profile_tags(monkeypatch) -> None:
    session = SimpleNamespace()
    _patch_session_factory(monkeypatch, session)

    snapshots = [
        SimpleNamespace(
            updated_at="2026-05-10T03:00:00+00:00",
            profile_data={
                "profile_tags": ["踏实", "执行稳定"],
                "recommended_resource_types": ["note", "quiz"],
            },
        ),
        SimpleNamespace(
            updated_at="2026-05-10T02:00:00+00:00",
            profile_data={
                "profile_tags": ["踏实", "表达提升"],
                "recommended_resource_types": ["quiz"],
            },
        ),
    ]

    class FakeProfileRepository:
        async def list_by_user(self, session_obj, user_id: int, *, limit: int = 10):
            assert session_obj is session
            assert user_id == 1001
            assert limit == 5
            return snapshots

    monkeypatch.setattr(profile_tag_summary_service_module, "ProfileRepository", lambda: FakeProfileRepository())

    response = await ProfileTagSummaryService().get_summary(user_id=1001, limit=5)

    assert response.total_snapshots == 2
    assert response.by_tag["踏实"] == 2
    assert response.by_resource_type["quiz"] == 2
    assert response.latest_updated_at == "2026-05-10T03:00:00+00:00"
