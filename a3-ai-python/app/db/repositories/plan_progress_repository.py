from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.plan_progress import PlanStepProgress


class PlanProgressRepository:
    async def list_by_plan_user(
        self,
        session: AsyncSession,
        *,
        plan_id: int,
        user_id: int,
    ) -> list[PlanStepProgress]:
        stmt = (
            select(PlanStepProgress)
            .where(PlanStepProgress.plan_id == plan_id, PlanStepProgress.user_id == user_id)
            .order_by(PlanStepProgress.id.asc())
        )
        result = await session.execute(stmt)
        return list(result.scalars().all())

    async def get_by_step(
        self,
        session: AsyncSession,
        *,
        plan_id: int,
        user_id: int,
        step_id: str,
    ) -> PlanStepProgress | None:
        stmt = select(PlanStepProgress).where(
            PlanStepProgress.plan_id == plan_id,
            PlanStepProgress.user_id == user_id,
            PlanStepProgress.step_id == step_id,
        )
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    async def upsert_step(
        self,
        session: AsyncSession,
        *,
        plan_id: int,
        user_id: int,
        step_id: str,
        status: str,
        last_action: str,
        progress_note: str | None,
        created_at: str,
        updated_at: str,
    ) -> PlanStepProgress:
        current = await self.get_by_step(session, plan_id=plan_id, user_id=user_id, step_id=step_id)
        if current is None:
            current = PlanStepProgress(
                plan_id=plan_id,
                user_id=user_id,
                step_id=step_id,
                status=status,
                last_action=last_action,
                progress_note=progress_note,
                created_at=created_at,
                updated_at=updated_at,
            )
            session.add(current)
            await session.flush()
            return current
        current.status = status
        current.last_action = last_action
        current.progress_note = progress_note
        current.updated_at = updated_at
        await session.flush()
        return current
