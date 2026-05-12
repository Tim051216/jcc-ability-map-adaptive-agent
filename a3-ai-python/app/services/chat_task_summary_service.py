from collections import Counter

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.generation_task import GenerationTask
from app.schemas.chat import ChatTaskSummaryResponse
from app.services import chat_task_service as chat_task_service_module


class ChatTaskSummaryService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_summary(self) -> ChatTaskSummaryResponse:
        result = await self.db.execute(
            select(GenerationTask)
            .where(GenerationTask.task_type == "chat")
            .order_by(GenerationTask.id.desc())
        )
        db_tasks = list(result.scalars().all())
        memory_tasks = list(chat_task_service_module._memory_tasks.values())

        status_counter = Counter(task.status for task in db_tasks)
        status_counter.update(task.get("status", "pending") for task in memory_tasks)
        latest_candidates = [task.created_at for task in db_tasks if getattr(task, "created_at", None)]
        latest_candidates.extend(task.get("updated_at") for task in memory_tasks if task.get("updated_at"))

        total = len(db_tasks) + len(memory_tasks)
        return ChatTaskSummaryResponse(
            total=total,
            pending_count=status_counter.get("pending", 0) + status_counter.get("running", 0),
            failed_count=status_counter.get("failed", 0),
            by_status=dict(status_counter),
            latest_task_at=max(latest_candidates) if latest_candidates else None,
        )
