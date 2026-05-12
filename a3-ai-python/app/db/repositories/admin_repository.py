from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.agent_runtime_log import AgentRuntimeLog
from app.db.models.admin_user_control import AdminUserControl
from app.db.models.audit_log import AuditLog
from app.db.models.chat_ticket import ChatTicket
from app.db.models.content_review_task import ContentReviewTask
from app.db.models.evaluation_record import EvaluationRecord
from app.db.models.learning_plan import LearningPlan
from app.db.models.plan_progress import PlanStepProgress
from app.db.models.system_config import SystemConfig
from app.db.models.user_profile import UserProfileSnapshot


class ReviewTaskRepository:
    async def create_task(
        self,
        session: AsyncSession,
        *,
        entity_type: str,
        entity_id: int,
        source_scene: str,
        priority: str,
        status: str,
        submitted_content: str,
        reviewer_name: str | None,
        decision_note: str | None,
        created_at: str,
        updated_at: str,
    ) -> ContentReviewTask:
        task = ContentReviewTask(
            entity_type=entity_type,
            entity_id=entity_id,
            source_scene=source_scene,
            priority=priority,
            status=status,
            submitted_content=submitted_content,
            reviewer_name=reviewer_name,
            decision_note=decision_note,
            created_at=created_at,
            updated_at=updated_at,
        )
        session.add(task)
        await session.flush()
        return task

    async def get_task(self, session: AsyncSession, review_id: int) -> ContentReviewTask | None:
        return await session.get(ContentReviewTask, review_id)

    async def list_tasks(
        self,
        session: AsyncSession,
        *,
        status: str | None = None,
        entity_type: str | None = None,
        priority: str | None = None,
        source_scene: str | None = None,
        reviewer_name: str | None = None,
        keyword: str | None = None,
    ) -> tuple[list[ContentReviewTask], int]:
        stmt: Select[tuple[ContentReviewTask]] = select(ContentReviewTask)
        count_stmt = select(func.count()).select_from(ContentReviewTask)
        if status:
            stmt = stmt.where(ContentReviewTask.status == status)
            count_stmt = count_stmt.where(ContentReviewTask.status == status)
        if entity_type:
            stmt = stmt.where(ContentReviewTask.entity_type == entity_type)
            count_stmt = count_stmt.where(ContentReviewTask.entity_type == entity_type)
        if priority:
            stmt = stmt.where(ContentReviewTask.priority == priority)
            count_stmt = count_stmt.where(ContentReviewTask.priority == priority)
        if source_scene:
            stmt = stmt.where(ContentReviewTask.source_scene == source_scene)
            count_stmt = count_stmt.where(ContentReviewTask.source_scene == source_scene)
        if reviewer_name:
            stmt = stmt.where(ContentReviewTask.reviewer_name == reviewer_name)
            count_stmt = count_stmt.where(ContentReviewTask.reviewer_name == reviewer_name)
        if keyword:
            like_keyword = f"%{keyword}%"
            stmt = stmt.where(ContentReviewTask.submitted_content.ilike(like_keyword))
            count_stmt = count_stmt.where(ContentReviewTask.submitted_content.ilike(like_keyword))
        stmt = stmt.order_by(ContentReviewTask.id.desc())
        result = await session.execute(stmt)
        total = await session.scalar(count_stmt)
        return list(result.scalars().all()), int(total or 0)

    async def list_tasks_by_ids(
        self,
        session: AsyncSession,
        review_ids: list[int],
    ) -> list[ContentReviewTask]:
        if not review_ids:
            return []
        stmt: Select[tuple[ContentReviewTask]] = select(ContentReviewTask).where(ContentReviewTask.id.in_(review_ids))
        result = await session.execute(stmt)
        return list(result.scalars().all())


class AuditLogRepository:
    async def create_log(
        self,
        session: AsyncSession,
        *,
        trace_id: str | None,
        scene: str,
        action: str,
        payload: dict | None,
        created_at: str,
        updated_at: str,
    ) -> AuditLog:
        log = AuditLog(
            trace_id=trace_id,
            scene=scene,
            action=action,
            payload=payload,
            created_at=created_at,
            updated_at=updated_at,
        )
        session.add(log)
        await session.flush()
        return log

    async def list_logs(
        self,
        session: AsyncSession,
        *,
        scene: str | None = None,
        action: str | None = None,
    ) -> tuple[list[AuditLog], int]:
        stmt: Select[tuple[AuditLog]] = select(AuditLog)
        count_stmt = select(func.count()).select_from(AuditLog)
        if scene:
            stmt = stmt.where(AuditLog.scene == scene)
            count_stmt = count_stmt.where(AuditLog.scene == scene)
        if action:
            stmt = stmt.where(AuditLog.action == action)
            count_stmt = count_stmt.where(AuditLog.action == action)
        stmt = stmt.order_by(AuditLog.id.desc())
        result = await session.execute(stmt)
        total = await session.scalar(count_stmt)
        return list(result.scalars().all()), int(total or 0)


class SystemConfigRepository:
    async def list_configs(self, session: AsyncSession) -> list[SystemConfig]:
        result = await session.execute(select(SystemConfig).order_by(SystemConfig.config_key.asc()))
        return list(result.scalars().all())

    async def get_by_key(self, session: AsyncSession, config_key: str) -> SystemConfig | None:
        stmt = select(SystemConfig).where(SystemConfig.config_key == config_key)
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    async def upsert_config(
        self,
        session: AsyncSession,
        *,
        config_key: str,
        config_value: str,
        description: str | None,
        updated_by: str,
        created_at: str,
        updated_at: str,
    ) -> SystemConfig:
        current = await self.get_by_key(session, config_key)
        if current is None:
            current = SystemConfig(
                config_key=config_key,
                config_value=config_value,
                description=description,
                updated_by=updated_by,
                created_at=created_at,
                updated_at=updated_at,
            )
            session.add(current)
            await session.flush()
            return current
        current.config_value = config_value
        current.description = description
        current.updated_by = updated_by
        current.updated_at = updated_at
        await session.flush()
        return current


class AgentRuntimeRepository:
    async def create_log(
        self,
        session: AsyncSession,
        *,
        agent_name: str,
        level: str,
        status: str,
        message: str,
        payload: dict | None,
        created_at: str,
        updated_at: str,
    ) -> AgentRuntimeLog:
        log = AgentRuntimeLog(
            agent_name=agent_name,
            level=level,
            status=status,
            message=message,
            payload=payload,
            created_at=created_at,
            updated_at=updated_at,
        )
        session.add(log)
        await session.flush()
        return log

    async def list_logs(
        self,
        session: AsyncSession,
        *,
        agent_name: str | None = None,
        level: str | None = None,
    ) -> tuple[list[AgentRuntimeLog], int]:
        stmt: Select[tuple[AgentRuntimeLog]] = select(AgentRuntimeLog)
        count_stmt = select(func.count()).select_from(AgentRuntimeLog)
        if agent_name:
            stmt = stmt.where(AgentRuntimeLog.agent_name == agent_name)
            count_stmt = count_stmt.where(AgentRuntimeLog.agent_name == agent_name)
        if level:
            stmt = stmt.where(AgentRuntimeLog.level == level)
            count_stmt = count_stmt.where(AgentRuntimeLog.level == level)
        stmt = stmt.order_by(AgentRuntimeLog.id.desc())
        result = await session.execute(stmt)
        total = await session.scalar(count_stmt)
        return list(result.scalars().all()), int(total or 0)


class AdminUserOverviewRepository:
    async def list_user_overview(self, session: AsyncSession) -> dict:
        profiles = list((await session.execute(select(UserProfileSnapshot))).scalars().all())
        plans = list((await session.execute(select(LearningPlan))).scalars().all())
        evaluations = list((await session.execute(select(EvaluationRecord))).scalars().all())
        tickets = list((await session.execute(select(ChatTicket))).scalars().all())
        progress_items = list((await session.execute(select(PlanStepProgress))).scalars().all())
        controls = list((await session.execute(select(AdminUserControl))).scalars().all())
        return {
            "profiles": profiles,
            "plans": plans,
            "evaluations": evaluations,
            "tickets": tickets,
            "progress_items": progress_items,
            "controls": controls,
        }


class AdminUserControlRepository:
    async def get_by_user_id(self, session: AsyncSession, user_id: int) -> AdminUserControl | None:
        stmt = select(AdminUserControl).where(AdminUserControl.user_id == user_id)
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    async def upsert_user_control(
        self,
        session: AsyncSession,
        *,
        user_id: int,
        status: str,
        reason: str | None,
        updated_by: str,
        created_at: str,
        updated_at: str,
    ) -> AdminUserControl:
        current = await self.get_by_user_id(session, user_id)
        if current is None:
            current = AdminUserControl(
                user_id=user_id,
                status=status,
                reason=reason,
                updated_by=updated_by,
                created_at=created_at,
                updated_at=updated_at,
            )
            session.add(current)
            await session.flush()
            return current
        current.status = status
        current.reason = reason
        current.updated_by = updated_by
        current.updated_at = updated_at
        await session.flush()
        return current
