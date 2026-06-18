import asyncio
from contextlib import asynccontextmanager
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.services import tutoring_task_service as task_module
from app.services.tutoring_task_service import (
    TutoringTaskService,
    _active_background_tasks,
    _track_background_task,
)


@pytest.mark.asyncio
async def test_track_background_task_keeps_reference_until_done() -> None:
    started = asyncio.Event()
    release = asyncio.Event()

    async def worker() -> str:
        started.set()
        await release.wait()
        return "ok"

    task = _track_background_task(asyncio.create_task(worker()))
    await started.wait()
    assert task in _active_background_tasks

    release.set()
    await task
    await asyncio.sleep(0)

    assert task not in _active_background_tasks


@pytest.mark.asyncio
async def test_run_db_task_marks_completed(monkeypatch: pytest.MonkeyPatch) -> None:
    task_row = SimpleNamespace(
        id=77,
        user_id=1001,
        status="pending",
        payload={"question_id": 123},
        result_data=None,
        updated_at=None,
    )
    session = MagicMock()
    session.get = AsyncMock(return_value=task_row)
    session.commit = AsyncMock()

    @asynccontextmanager
    async def fake_get_db():
        yield session

    async def fake_generate_answer(self, question_id: int, user_id: int) -> dict:
        assert question_id == 123
        assert user_id == 1001
        return {
            "question_id": 123,
            "session_id": 456,
            "answer_id": 789,
            "answer_text": "解释完成",
            "diagrams": [],
            "videos": [],
            "reference_sources": [],
            "confidence_score": 86.5,
            "generation_time": 1200,
            "should_escalate": False,
            "question_type": "概念理解",
            "knowledge_points": ["过拟合"],
            "safety_review": None,
            "hallucination_review": None,
        }

    monkeypatch.setattr(task_module, "get_db", fake_get_db)
    monkeypatch.setattr(task_module.TutoringService, "generate_answer", fake_generate_answer)

    await TutoringTaskService(MagicMock())._run_db_task(77)

    assert task_row.status == "completed"
    assert task_row.result_data["answer_id"] == 789
    assert session.commit.await_count == 2


@pytest.mark.asyncio
async def test_run_db_task_marks_timeout_failure(monkeypatch: pytest.MonkeyPatch) -> None:
    task_row = SimpleNamespace(
        id=88,
        user_id=1001,
        status="pending",
        payload={"question_id": 321},
        result_data=None,
        updated_at=None,
    )
    session = MagicMock()
    session.get = AsyncMock(return_value=task_row)
    session.commit = AsyncMock()

    @asynccontextmanager
    async def fake_get_db():
        yield session

    async def fake_generate_answer(self, question_id: int, user_id: int) -> dict:
        raise asyncio.TimeoutError

    monkeypatch.setattr(task_module, "get_db", fake_get_db)
    monkeypatch.setattr(task_module.TutoringService, "generate_answer", fake_generate_answer)

    await TutoringTaskService(MagicMock())._run_db_task(88)

    assert task_row.status == "failed"
    assert "超时" in task_row.result_data["error_message"]
    assert session.commit.await_count == 2
