from types import SimpleNamespace

import pytest

from app.services import chat_task_service as chat_task_service_module
from app.services.chat_task_service import ChatTaskService


@pytest.mark.asyncio
async def test_submit_task_falls_back_to_memory_when_db_submit_fails(monkeypatch) -> None:
    service = ChatTaskService(db=SimpleNamespace())

    async def fake_submit_db_task(self, request):
        raise RuntimeError("db unavailable")

    async def fake_submit_memory_task(self, request):
        assert request.user_id == 1001
        return {"task_id": 100001, "status": "pending", "poll_interval_ms": 2000}

    monkeypatch.setattr(ChatTaskService, "_submit_db_task", fake_submit_db_task)
    monkeypatch.setattr(ChatTaskService, "_submit_memory_task", fake_submit_memory_task)

    response = await service.submit_task(SimpleNamespace(user_id=1001, message="hello"))

    assert response["task_id"] == 100001
    assert response["status"] == "pending"


@pytest.mark.asyncio
async def test_get_task_status_reads_completed_memory_task(monkeypatch) -> None:
    task_id = 100321
    chat_task_service_module._memory_tasks[task_id] = {
        "status": "completed",
        "result_data": {
            "answer": "done",
            "citations": [],
            "intent": "study_assistant",
            "agent_trace": [],
            "profile": None,
            "generated_plan": None,
            "generated_resources": [],
            "generated_evaluation": None,
        },
        "error_message": None,
    }

    try:
        service = ChatTaskService(db=SimpleNamespace())
        response = await service.get_task_status(task_id)
    finally:
        chat_task_service_module._memory_tasks.pop(task_id, None)

    assert response is not None
    assert response.status == "completed"
    assert response.result is not None
    assert response.result.answer == "done"


@pytest.mark.asyncio
async def test_get_task_status_reads_failed_db_task(monkeypatch) -> None:
    task = SimpleNamespace(
        id=21,
        task_type="chat",
        status="failed",
        result_data={"error_message": "timeout"},
    )

    class FakeDb:
        async def get(self, model, task_id: int):
            assert task_id == 21
            return task

    service = ChatTaskService(db=FakeDb())

    response = await service.get_task_status(21)

    assert response is not None
    assert response.status == "failed"
    assert response.error_message == "timeout"


@pytest.mark.asyncio
async def test_run_memory_task_marks_completed_when_chat_succeeds(monkeypatch) -> None:
    task_id = 100654
    chat_task_service_module._memory_tasks[task_id] = {
        "status": "pending",
        "payload": {
            "user_id": 1001,
            "message": "help me",
            "session_id": None,
            "course_code": None,
            "scene": "study_assistant",
        },
        "result_data": None,
        "error_message": None,
        "updated_at": None,
    }

    class FakeChatService:
        async def chat(self, request):
            assert request.user_id == 1001
            return SimpleNamespace(
                model_dump=lambda mode="json": {
                    "answer": "ok",
                    "citations": [],
                    "intent": "study_assistant",
                    "agent_trace": [],
                    "profile": None,
                    "generated_plan": None,
                    "generated_resources": [],
                    "generated_evaluation": None,
                }
            )

    monkeypatch.setattr(chat_task_service_module, "ChatService", lambda: FakeChatService())

    try:
        await ChatTaskService(db=SimpleNamespace())._run_memory_task(task_id)
        task = chat_task_service_module._memory_tasks[task_id]
    finally:
        chat_task_service_module._memory_tasks.pop(task_id, None)

    assert task["status"] == "completed"
    assert task["result_data"]["answer"] == "ok"
