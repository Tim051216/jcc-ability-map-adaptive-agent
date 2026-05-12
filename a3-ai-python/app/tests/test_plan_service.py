from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.services import plan_service as plan_service_module
from app.services.plan_service import PlanService


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
    monkeypatch.setattr(plan_service_module, "async_session_factory", lambda: _FakeSessionFactory(session))


@pytest.mark.asyncio
async def test_get_plan_progress_calculates_completion_with_saved_status(monkeypatch) -> None:
    session = _FakeSession()
    _patch_session_factory(monkeypatch, session)

    plan = SimpleNamespace(
        id=11,
        user_id=1001,
        plan_data={
            "user_id": 1001,
            "course_code": "JAVA-CORE",
            "course_name": "Java Core",
            "summary": "summary",
            "progress_hint": "hint",
            "next_action": "next",
            "risk_alerts": [],
            "path_mode": "laddered",
            "current_stage": "stage 1",
            "completion_rate": 0.0,
            "dynamic_adjustments": [],
            "recommended_checkpoints": [],
            "stages": [],
            "steps": [
                {"step_id": "day-1", "day": 1, "title": "Warm up", "status": "pending"},
                {"step_id": "day-2", "day": 2, "title": "Practice", "status": "pending"},
            ],
        },
    )

    class FakePlanRepository:
        async def get_by_id(self, session_obj, plan_id: int):
            assert session_obj is session
            assert plan_id == 11
            return plan

    class FakeProgressRepository:
        async def list_by_plan_user(self, session_obj, *, plan_id: int, user_id: int):
            assert session_obj is session
            assert plan_id == 11
            assert user_id == 1001
            return [
                SimpleNamespace(
                    step_id="day-1",
                    status="completed",
                    progress_note="done",
                    last_action="complete",
                    updated_at="2026-05-09T10:00:00+00:00",
                )
            ]

    monkeypatch.setattr(plan_service_module, "PlanRepository", lambda: FakePlanRepository())
    monkeypatch.setattr(plan_service_module, "PlanProgressRepository", lambda: FakeProgressRepository())

    response = await PlanService().get_plan_progress(plan_id=11, user_id=1001)

    assert response.completed_steps == 1
    assert response.total_steps == 2
    assert response.completion_rate == 50.0
    assert response.items[0].status == "completed"
    assert response.items[1].last_action == "initialize"


@pytest.mark.asyncio
async def test_update_step_status_rejects_missing_step(monkeypatch) -> None:
    session = _FakeSession()
    _patch_session_factory(monkeypatch, session)

    plan = SimpleNamespace(
        id=11,
        user_id=1001,
        plan_data={
            "user_id": 1001,
            "course_code": "JAVA-CORE",
            "course_name": "Java Core",
            "summary": "summary",
            "progress_hint": "hint",
            "next_action": "next",
            "risk_alerts": [],
            "path_mode": "laddered",
            "current_stage": "stage 1",
            "completion_rate": 0.0,
            "dynamic_adjustments": [],
            "recommended_checkpoints": [],
            "stages": [],
            "steps": [{"step_id": "day-1", "day": 1, "title": "Warm up", "status": "pending"}],
        },
    )

    class FakePlanRepository:
        async def get_by_id(self, session_obj, plan_id: int):
            assert session_obj is session
            assert plan_id == 11
            return plan

    class FakeProgressRepository:
        async def upsert_step(self, *args, **kwargs):
            raise AssertionError("should not write progress when step does not exist")

    monkeypatch.setattr(plan_service_module, "PlanRepository", lambda: FakePlanRepository())
    monkeypatch.setattr(plan_service_module, "PlanProgressRepository", lambda: FakeProgressRepository())

    with pytest.raises(HTTPException) as exc_info:
        await PlanService().update_step_status(plan_id=11, user_id=1001, step_id="day-9", action="pause")

    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == "plan step not found"
    assert session.committed is False
