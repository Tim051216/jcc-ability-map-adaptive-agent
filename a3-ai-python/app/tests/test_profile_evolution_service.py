from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.services import profile_evolution_service as profile_evolution_service_module
from app.services.profile_evolution_service import ProfileEvolutionService


class _FakeSession:
    def __init__(self) -> None:
        self.committed = False

    async def commit(self) -> None:
        self.committed = True


class _FakeSessionFactory:
    def __init__(self, session: _FakeSession) -> None:
        self._session = session

    async def __aenter__(self) -> _FakeSession:
        return self._session

    async def __aexit__(self, exc_type, exc, tb) -> bool:
        return False


def _patch_session_factory(monkeypatch, session: _FakeSession) -> None:
    monkeypatch.setattr(
        profile_evolution_service_module,
        "async_session_factory",
        lambda: _FakeSessionFactory(session),
    )


@pytest.mark.asyncio
async def test_list_history_returns_snapshot_items(monkeypatch) -> None:
    session = _FakeSession()
    _patch_session_factory(monkeypatch, session)

    snapshots = [
        SimpleNamespace(
            id=3,
            user_id=1001,
            version=3,
            source_summary="人工微调后",
            updated_at="2026-05-09T18:00:00+00:00",
            profile_data={"summary": "第三版", "profile_tags": ["稳定"]},
        ),
        SimpleNamespace(
            id=2,
            user_id=1001,
            version=2,
            source_summary="行为回流后",
            updated_at="2026-05-09T17:00:00+00:00",
            profile_data={"summary": "第二版", "profile_tags": ["进阶"]},
        ),
    ]

    class FakeProfileRepository:
        async def list_by_user(self, session_obj, user_id: int, *, limit: int = 10):
            assert session_obj is session
            assert user_id == 1001
            assert limit == 5
            return snapshots

    monkeypatch.setattr(
        profile_evolution_service_module,
        "ProfileRepository",
        lambda: FakeProfileRepository(),
    )

    response = await ProfileEvolutionService().list_history(user_id=1001, limit=5)

    assert response.total == 2
    assert response.items[0].snapshot_id == 3
    assert response.items[0].profile_tags == ["稳定"]


@pytest.mark.asyncio
async def test_tune_profile_creates_new_version(monkeypatch) -> None:
    session = _FakeSession()
    _patch_session_factory(monkeypatch, session)

    latest_snapshot = SimpleNamespace(
        version=2,
        source_summary="初始构建",
        profile_data={
            "dimensions": {"logic": {"score": 0.7}, "speed": {"score": 0.5}},
            "dimension_order": ["logic", "speed"],
            "profile_tags": ["踏实"],
            "recommended_resource_types": ["note"],
            "summary": "当前更适合稳步推进",
        },
    )
    captured: dict = {}

    class FakeProfileRepository:
        async def latest_by_user(self, session_obj, user_id: int):
            assert session_obj is session
            assert user_id == 1001
            return latest_snapshot

        async def create_snapshot(self, session_obj, **kwargs):
            assert session_obj is session
            captured.update(kwargs)
            return SimpleNamespace(id=8, **kwargs)

    monkeypatch.setattr(
        profile_evolution_service_module,
        "ProfileRepository",
        lambda: FakeProfileRepository(),
    )

    response = await ProfileEvolutionService().tune_profile(
        SimpleNamespace(
            user_id=1001,
            dimensions_patch={"confidence": {"score": 0.8}},
            profile_tags=["踏实", "表达提升"],
            recommended_resource_types=["note", "quiz"],
            summary="增加表达训练",
            source_summary="教师人工微调",
            updated_by="teacherA",
        )
    )

    assert response.version == 3
    assert response.summary == "增加表达训练"
    assert response.dimension_order == ["logic", "speed", "confidence"]
    assert captured["version"] == 3
    assert captured["source_summary"] == "教师人工微调"
    assert captured["profile_data"]["last_manual_tune"]["updated_by"] == "teacherA"
    assert session.committed is True


@pytest.mark.asyncio
async def test_tune_profile_raises_when_profile_missing(monkeypatch) -> None:
    session = _FakeSession()
    _patch_session_factory(monkeypatch, session)

    class FakeProfileRepository:
        async def latest_by_user(self, session_obj, user_id: int):
            assert session_obj is session
            assert user_id == 1001
            return None

    monkeypatch.setattr(
        profile_evolution_service_module,
        "ProfileRepository",
        lambda: FakeProfileRepository(),
    )

    with pytest.raises(HTTPException) as exc_info:
        await ProfileEvolutionService().tune_profile(
            SimpleNamespace(
                user_id=1001,
                dimensions_patch={},
                profile_tags=None,
                recommended_resource_types=None,
                summary=None,
                source_summary=None,
                updated_by=None,
            )
        )

    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == "profile not found"


@pytest.mark.asyncio
async def test_apply_behavior_feedback_creates_new_snapshot(monkeypatch) -> None:
    session = _FakeSession()
    _patch_session_factory(monkeypatch, session)

    latest_snapshot = SimpleNamespace(
        version=3,
        source_summary="教师人工微调",
        profile_data={
            "dimensions": {"logic": {"score": 0.7}},
            "dimension_order": ["logic"],
            "profile_tags": ["踏实"],
            "recommended_resource_types": ["note"],
            "summary": "旧版画像",
        },
    )
    captured: dict = {}

    class FakeProfileRepository:
        async def latest_by_user(self, session_obj, user_id: int):
            assert session_obj is session
            assert user_id == 1001
            return latest_snapshot

        async def create_snapshot(self, session_obj, **kwargs):
            assert session_obj is session
            captured.update(kwargs)
            return SimpleNamespace(id=9, **kwargs)

    monkeypatch.setattr(
        profile_evolution_service_module,
        "ProfileRepository",
        lambda: FakeProfileRepository(),
    )

    response = await ProfileEvolutionService().apply_behavior_feedback(
        SimpleNamespace(
            user_id=1001,
            activity_type="weekly_review",
            course_code="PYTHON-AI",
            duration_minutes=90,
            completion_rate=85.0,
            resource_usage_count=4,
            weak_points=["asyncio"],
            note="本周完成度明显提升",
            updated_by="system",
        )
    )

    assert response.version == 4
    assert "discipline" in response.dimensions
    assert "engagement" in response.dimensions
    assert "reinforcement_need" in response.dimensions
    assert "执行稳定" in response.profile_tags
    assert captured["profile_data"]["behavior_feedback"]["activity_type"] == "weekly_review"
    assert session.committed is True
