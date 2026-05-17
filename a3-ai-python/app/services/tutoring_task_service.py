import asyncio
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.generation_task import GenerationTask
from app.db.session import async_session_factory
from app.schemas.tutoring import (
    TutoringQuestionCreate,
    TutoringTaskHistoryItem,
    TutoringTaskHistoryResponse,
    TutoringTaskResult,
    TutoringTaskStatusResponse,
    TutoringTaskSubmitResponse,
)
from app.services.tutoring_service import TutoringService


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


_memory_tasks: dict[int, dict] = {}
_memory_task_id = 200000


def _next_memory_task_id() -> int:
    global _memory_task_id
    _memory_task_id += 1
    return _memory_task_id


class TutoringTaskService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def submit_task(self, user_id: int, request: TutoringQuestionCreate) -> TutoringTaskSubmitResponse:
        service = TutoringService(self.db)
        submit_result = await service.submit_question(user_id, request)
        try:
            return await self._submit_db_task(user_id, request, submit_result)
        except Exception:
            return await self._submit_memory_task(user_id, request, submit_result)

    async def get_task_status(self, task_id: int) -> TutoringTaskStatusResponse | None:
        memory_task = _memory_tasks.get(task_id)
        if memory_task is not None:
            result = None
            error_message = None
            if memory_task["status"] == "completed" and memory_task.get("result_data"):
                result = TutoringTaskResult.model_validate(memory_task["result_data"])
            elif memory_task["status"] == "failed":
                error_message = memory_task.get("error_message")
            return TutoringTaskStatusResponse(
                task_id=task_id,
                status=memory_task["status"],
                question_id=memory_task.get("question_id"),
                session_id=memory_task.get("session_id"),
                result=result,
                error_message=error_message,
            )

        try:
            task = await self.db.get(GenerationTask, task_id)
        except Exception:
            return None
        if task is None or task.task_type != "tutoring":
            return None

        payload = task.payload or {}
        result = None
        error_message = None
        if task.status == "completed" and task.result_data:
            result = TutoringTaskResult.model_validate(task.result_data)
        elif task.status == "failed" and task.result_data:
            error_message = task.result_data.get("error_message")
        return TutoringTaskStatusResponse(
            task_id=task.id,
            status=task.status,
            question_id=payload.get("question_id"),
            session_id=payload.get("session_id"),
            result=result,
            error_message=error_message,
        )

    async def list_tasks(
        self,
        *,
        user_id: int | None = None,
        course_id: int | None = None,
        limit: int = 10,
    ) -> TutoringTaskHistoryResponse:
        items: list[TutoringTaskHistoryItem] = []
        try:
            stmt = select(GenerationTask).where(GenerationTask.task_type == "tutoring").order_by(GenerationTask.id.desc())
            if user_id is not None:
                stmt = stmt.where(GenerationTask.user_id == user_id)
            result = await self.db.execute(stmt.limit(limit))
            for task in result.scalars().all():
                payload = task.payload or {}
                if course_id is not None and int(payload.get("course_id") or 0) != int(course_id):
                    continue
                result_data = task.result_data or {}
                items.append(
                    TutoringTaskHistoryItem(
                        task_id=task.id,
                        user_id=task.user_id,
                        question_id=payload.get("question_id"),
                        session_id=payload.get("session_id"),
                        course_id=payload.get("course_id"),
                        question_text=payload.get("question_text"),
                        status=task.status,
                        answer_text=result_data.get("answer_text"),
                        created_at=task.created_at,
                        updated_at=task.updated_at,
                    )
                )
            return TutoringTaskHistoryResponse(items=items, total=len(items))
        except Exception:
            filtered: list[TutoringTaskHistoryItem] = []
            for task_id, task in sorted(_memory_tasks.items(), key=lambda item: item[0], reverse=True):
                if user_id is not None and task.get("user_id") != user_id:
                    continue
                if course_id is not None and int(task.get("course_id") or 0) != int(course_id):
                    continue
                filtered.append(
                    TutoringTaskHistoryItem(
                        task_id=task_id,
                        user_id=task.get("user_id"),
                        question_id=task.get("question_id"),
                        session_id=task.get("session_id"),
                        course_id=task.get("course_id"),
                        question_text=task.get("question_text"),
                        status=task.get("status", "pending"),
                        answer_text=(task.get("result_data") or {}).get("answer_text"),
                        created_at=task.get("created_at"),
                        updated_at=task.get("updated_at"),
                    )
                )
                if len(filtered) >= limit:
                    break
            return TutoringTaskHistoryResponse(items=filtered, total=len(filtered))

    async def _submit_db_task(
        self,
        user_id: int,
        request: TutoringQuestionCreate,
        submit_result: dict,
    ) -> TutoringTaskSubmitResponse:
        now = _now_iso()
        payload = {
            "user_id": user_id,
            "question_id": submit_result["question_id"],
            "session_id": submit_result.get("session_id"),
            "course_id": request.course_id,
            "question_text": request.question_text,
        }
        task = GenerationTask(
            user_id=user_id,
            task_type="tutoring",
            status="pending",
            payload=payload,
            result_data=None,
            created_at=now,
            updated_at=now,
        )
        self.db.add(task)
        await self.db.commit()
        await self.db.refresh(task)
        asyncio.create_task(self._run_db_task(task.id))
        return TutoringTaskSubmitResponse(
            task_id=task.id,
            status=task.status,
            question_id=submit_result["question_id"],
            session_id=submit_result.get("session_id"),
        )

    async def _submit_memory_task(
        self,
        user_id: int,
        request: TutoringQuestionCreate,
        submit_result: dict,
    ) -> TutoringTaskSubmitResponse:
        task_id = _next_memory_task_id()
        _memory_tasks[task_id] = {
            "status": "pending",
            "user_id": user_id,
            "question_id": submit_result["question_id"],
            "session_id": submit_result.get("session_id"),
            "course_id": request.course_id,
            "question_text": request.question_text,
            "result_data": None,
            "error_message": None,
            "created_at": _now_iso(),
            "updated_at": _now_iso(),
        }
        asyncio.create_task(self._run_memory_task(task_id))
        return TutoringTaskSubmitResponse(
            task_id=task_id,
            status="pending",
            question_id=submit_result["question_id"],
            session_id=submit_result.get("session_id"),
        )

    async def _run_db_task(self, task_id: int) -> None:
        async with async_session_factory() as session:
            task = await session.get(GenerationTask, task_id)
            if task is None:
                return
            task.status = "running"
            task.updated_at = _now_iso()
            await session.commit()

            try:
                payload = task.payload or {}
                result = await TutoringService(session).generate_answer(payload["question_id"], task.user_id)
                task.status = "completed"
                task.result_data = TutoringTaskResult.model_validate(result).model_dump(mode="json")
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
            async with async_session_factory() as session:
                result = await TutoringService(session).generate_answer(task["question_id"], task["user_id"])
            task["status"] = "completed"
            task["result_data"] = TutoringTaskResult.model_validate(result).model_dump(mode="json")
        except Exception as exc:  # noqa: BLE001
            task["status"] = "failed"
            task["error_message"] = str(exc)
        task["updated_at"] = _now_iso()
