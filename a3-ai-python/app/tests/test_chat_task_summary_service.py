from types import SimpleNamespace

import pytest

from app.services import chat_task_service as chat_task_service_module
from app.services.chat_task_summary_service import ChatTaskSummaryService


class _FakeExecuteResult:
    def __init__(self, items) -> None:
        self._items = items

    def scalars(self):
        return self

    def all(self):
        return self._items


class _FakeDb:
    def __init__(self, items) -> None:
        self._items = items

    async def execute(self, stmt):
        return _FakeExecuteResult(self._items)


@pytest.mark.asyncio
async def test_get_summary_aggregates_db_and_memory_tasks() -> None:
    db_tasks = [
        SimpleNamespace(status="completed", created_at="2026-05-10T02:30:00+00:00"),
        SimpleNamespace(status="failed", created_at="2026-05-10T02:20:00+00:00"),
    ]
    chat_task_service_module._memory_tasks[100001] = {
        "status": "pending",
        "updated_at": "2026-05-10T02:40:00+00:00",
    }
    try:
        response = await ChatTaskSummaryService(_FakeDb(db_tasks)).get_summary()
    finally:
        chat_task_service_module._memory_tasks.pop(100001, None)

    assert response.total == 3
    assert response.pending_count == 1
    assert response.failed_count == 1
    assert response.by_status["completed"] == 1
    assert response.latest_task_at == "2026-05-10T02:40:00+00:00"
