import asyncio
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.generation_task import GenerationTask
from app.db.session import async_session_factory
from app.schemas.chat import ChatRequest, ChatResponse, ChatTaskStatusResponse, ChatTaskSubmitResponse
from app.services.chat_service import ChatService


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


_memory_tasks: dict[int, dict] = {}
_memory_task_id = 100000


def _next_memory_task_id() -> int:
    global _memory_task_id
    _memory_task_id += 1
    return _memory_task_id


class ChatTaskService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def submit_task(self, request: ChatRequest) -> ChatTaskSubmitResponse:
        try:
            return await self._submit_db_task(request)
        except Exception:
            return await self._submit_memory_task(request)

    async def get_task_status(self, task_id: int) -> ChatTaskStatusResponse | None:
        memory_task = _memory_tasks.get(task_id)
        if memory_task is not None:
            result = None
            error_message = None
            if memory_task["status"] == "completed" and memory_task.get("result_data"):
                result = ChatResponse.model_validate(memory_task["result_data"])
            elif memory_task["status"] == "failed":
                error_message = memory_task.get("error_message")

            return ChatTaskStatusResponse(
                task_id=task_id,
                status=memory_task["status"],
                result=result,
                error_message=error_message,
            )

        try:
            task = await self.db.get(GenerationTask, task_id)
        except Exception:
            return None

        if task is None or task.task_type != "chat":
            return None

        result = None
        error_message = None
        if task.status == "completed" and task.result_data:
            result = ChatResponse.model_validate(task.result_data)
        elif task.status == "failed" and task.result_data:
            error_message = task.result_data.get("error_message")

        return ChatTaskStatusResponse(
            task_id=task.id,
            status=task.status,
            result=result,
            error_message=error_message,
        )

    async def _submit_db_task(self, request: ChatRequest) -> ChatTaskSubmitResponse:
        now = _now_iso()
        task = GenerationTask(
            user_id=request.user_id,
            task_type="chat",
            status="pending",
            payload=request.model_dump(mode="json"),
            result_data=None,
            created_at=now,
            updated_at=now,
        )
        self.db.add(task)
        await self.db.commit()
        await self.db.refresh(task)

        asyncio.create_task(self._run_db_task(task.id))
        return ChatTaskSubmitResponse(task_id=task.id, status=task.status)

    async def _submit_memory_task(self, request: ChatRequest) -> ChatTaskSubmitResponse:
        task_id = _next_memory_task_id()
        _memory_tasks[task_id] = {
            "status": "pending",
            "payload": request.model_dump(mode="json"),
            "result_data": None,
            "error_message": None,
            "updated_at": _now_iso(),
        }
        asyncio.create_task(self._run_memory_task(task_id))
        return ChatTaskSubmitResponse(task_id=task_id, status="pending")

    async def _run_db_task(self, task_id: int) -> None:
        async with async_session_factory() as session:
            task = await session.get(GenerationTask, task_id)
            if task is None:
                return

            task.status = "running"
            task.updated_at = _now_iso()
            await session.commit()

            try:
                request = ChatRequest.model_validate(task.payload)
                result = await ChatService().chat(request)
                task.status = "completed"
                task.result_data = result.model_dump(mode="json")
            except Exception as exc:  # noqa: BLE001
                task.status = "failed"
                task.result_data = {"error_message": str(exc)}

            task.updated_at = _now_iso()
            await session.commit()

    async def _run_memory_task(self, task_id: int) -> None:
        task = _memory_tasks.get(task_id)
        if task is None:
            return

        task["status"] = "running"
        task["updated_at"] = _now_iso()

        try:
            request = ChatRequest.model_validate(task["payload"])
            result = await ChatService().chat(request)
            task["status"] = "completed"
            task["result_data"] = result.model_dump(mode="json")
        except Exception as exc:  # noqa: BLE001
            task["status"] = "failed"
            task["error_message"] = str(exc)

        task["updated_at"] = _now_iso()
