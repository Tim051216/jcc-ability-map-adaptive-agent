from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy.exc import SQLAlchemyError

from app.db.repositories.admin_repository import (
    AdminUserControlRepository,
    AdminUserOverviewRepository,
    AgentRuntimeRepository,
    AuditLogRepository,
    ReviewTaskRepository,
    SystemConfigRepository,
)
from app.services.admin_demo_data import AdminDemoStore, should_use_admin_demo_data
from app.services.agent_registry_service import AgentRegistryService
from app.schemas.admin import (
    AgentRuntimeLogListResponse,
    AgentRuntimeLogResponse,
    AgentStatusListResponse,
    AgentStatusResponse,
    AdminUserDetailResponse,
    AdminUserOverviewListResponse,
    AdminUserOverviewResponse,
    AdminUserPlanProgressResponse,
    AdminUserStatusResponse,
    AdminUserStatusUpdateRequest,
    AdminUserTicketResponse,
    AuditLogListResponse,
    AuditLogResponse,
    ReviewTaskBatchDecisionRequest,
    ReviewTaskBatchDecisionResponse,
    ReviewTaskCreateRequest,
    ReviewTaskDecisionRequest,
    ReviewTaskHistoryListResponse,
    ReviewTaskHistoryResponse,
    ReviewTaskListResponse,
    ReviewTaskResponse,
    SystemConfigListResponse,
    SystemConfigHistoryListResponse,
    SystemConfigHistoryResponse,
    SystemConfigResponse,
    SystemConfigUpdateRequest,
)


class AdminService:
    ALLOWED_USER_STATUS = {"active", "suspended", "disabled"}
    SENSITIVE_CONFIG_KEYWORDS = (
        "secret",
        "token",
        "password",
        "api_key",
        "apikey",
        "access_key",
        "private_key",
        "credential",
    )

    async def get_overview(self) -> dict:
        from app.services.admin_dashboard_service import AdminDashboardService

        summary = await AdminDashboardService().get_summary()
        return summary.model_dump()

    async def list_system_configs(self, *, sensitive_only: bool = False) -> SystemConfigListResponse:
        from app.db.session import async_session_factory

        async with async_session_factory() as session:
            items = await SystemConfigRepository().list_configs(session)
        response_items = [self._to_config_response(item) for item in items]
        if sensitive_only:
            response_items = [item for item in response_items if item.is_sensitive]
        return SystemConfigListResponse(items=response_items, total=len(response_items))

    async def update_system_config(self, config_key: str, request: SystemConfigUpdateRequest) -> SystemConfigResponse:
        now = datetime.now(timezone.utc).isoformat()
        from app.db.session import async_session_factory

        async with async_session_factory() as session:
            existing = await SystemConfigRepository().get_by_key(session, config_key)
            config = await SystemConfigRepository().upsert_config(
                session,
                config_key=config_key,
                config_value=request.value,
                description=request.description,
                updated_by=request.updated_by,
                created_at=now,
                updated_at=now,
            )
            await AuditLogRepository().create_log(
                session,
                trace_id=None,
                scene="system_config",
                action="system_config_updated",
                payload={
                    "config_key": config_key,
                    "updated_by": request.updated_by,
                    "old_value": getattr(existing, "config_value", None),
                    "new_value": request.value,
                    "description": request.description,
                },
                created_at=now,
                updated_at=now,
            )
            await session.commit()
        return self._to_config_response(config)

    async def list_system_config_history(
        self,
        *,
        config_key: str | None = None,
        updated_by: str | None = None,
    ) -> SystemConfigHistoryListResponse:
        from app.db.session import async_session_factory

        async with async_session_factory() as session:
            items, _ = await AuditLogRepository().list_logs(
                session,
                scene="system_config",
                action="system_config_updated",
            )

        history_items = self._build_system_config_history_items(items, config_key=config_key, updated_by=updated_by)
        return SystemConfigHistoryListResponse(items=history_items, total=len(history_items))

    async def create_review_task(self, request: ReviewTaskCreateRequest) -> ReviewTaskResponse:
        now = datetime.now(timezone.utc).isoformat()
        from app.db.session import async_session_factory

        async with async_session_factory() as session:
            task = await ReviewTaskRepository().create_task(
                session,
                entity_type=request.entity_type,
                entity_id=request.entity_id,
                source_scene=request.source_scene,
                priority=request.priority,
                status="pending",
                submitted_content=request.submitted_content,
                reviewer_name=None,
                decision_note=None,
                created_at=now,
                updated_at=now,
            )
            await AuditLogRepository().create_log(
                session,
                trace_id=None,
                scene="content_review",
                action="review_task_created",
                payload={"review_id": task.id, "entity_type": task.entity_type, "entity_id": task.entity_id},
                created_at=now,
                updated_at=now,
            )
            await session.commit()
        return self._to_review_response(task)

    async def list_review_tasks(
        self,
        *,
        status: str | None = None,
        entity_type: str | None = None,
        priority: str | None = None,
        source_scene: str | None = None,
        reviewer_name: str | None = None,
        keyword: str | None = None,
    ) -> ReviewTaskListResponse:
        from app.db.session import async_session_factory

        try:
            async with async_session_factory() as session:
                items, total = await ReviewTaskRepository().list_tasks(
                    session,
                    status=status,
                    entity_type=entity_type,
                    priority=priority,
                    source_scene=source_scene,
                    reviewer_name=reviewer_name,
                    keyword=keyword,
                )
        except (SQLAlchemyError, OSError) as exc:
            if should_use_admin_demo_data(exc):
                return AdminDemoStore.list_reviews(status=status)
            raise
        return ReviewTaskListResponse(items=[self._to_review_response(item) for item in items], total=total)

    async def get_review_task(self, review_id: int) -> ReviewTaskResponse:
        from app.db.session import async_session_factory

        async with async_session_factory() as session:
            task = await ReviewTaskRepository().get_task(session, review_id)
            if task is None:
                raise HTTPException(status_code=404, detail="review task not found")
        return self._to_review_response(task)

    async def get_review_task_history(self, review_id: int) -> ReviewTaskHistoryListResponse:
        from app.db.session import async_session_factory

        async with async_session_factory() as session:
            task = await ReviewTaskRepository().get_task(session, review_id)
            if task is None:
                raise HTTPException(status_code=404, detail="review task not found")
            logs, _ = await AuditLogRepository().list_logs(session, scene="content_review")
        items = self._build_review_task_history_items(logs, review_id=review_id)
        return ReviewTaskHistoryListResponse(items=items, total=len(items))

    async def approve_review_task(
        self,
        review_id: int,
        request: ReviewTaskDecisionRequest,
    ) -> ReviewTaskResponse:
        return await self._update_review_task(review_id, request, status="approved", action="review_task_approved")

    async def reject_review_task(
        self,
        review_id: int,
        request: ReviewTaskDecisionRequest,
    ) -> ReviewTaskResponse:
        return await self._update_review_task(review_id, request, status="rejected", action="review_task_rejected")

    async def approve_review_tasks(
        self,
        request: ReviewTaskBatchDecisionRequest,
    ) -> ReviewTaskBatchDecisionResponse:
        return await self._batch_update_review_tasks(
            request,
            status="approved",
            action="review_task_batch_approved",
        )

    async def reject_review_tasks(
        self,
        request: ReviewTaskBatchDecisionRequest,
    ) -> ReviewTaskBatchDecisionResponse:
        return await self._batch_update_review_tasks(
            request,
            status="rejected",
            action="review_task_batch_rejected",
        )

    async def list_audit_logs(
        self,
        *,
        scene: str | None = None,
        action: str | None = None,
    ) -> AuditLogListResponse:
        from app.db.session import async_session_factory

        async with async_session_factory() as session:
            items, total = await AuditLogRepository().list_logs(session, scene=scene, action=action)
        return AuditLogListResponse(items=[self._to_log_response(item) for item in items], total=total)

    async def list_agent_status(self) -> AgentStatusListResponse:
        from app.db.session import async_session_factory

        discovered_agents = AgentRegistryService.discover()

        try:
            async with async_session_factory() as session:
                logs, _ = await AgentRuntimeRepository().list_logs(session)
        except (SQLAlchemyError, OSError) as exc:
            if should_use_admin_demo_data(exc):
                return AdminDemoStore.list_agent_status()
            raise

        grouped: dict[str, AgentStatusResponse] = {}
        for log in logs:
            current = grouped.get(log.agent_name)
            if current is None:
                grouped[log.agent_name] = AgentStatusResponse(
                    agent_name=log.agent_name,
                    latest_status=log.status,
                    latest_message=self._normalize_agent_message(log.agent_name, log.message),
                    error_count=1 if log.level == "error" else 0,
                    updated_at=log.updated_at,
                    status_source="runtime",
                )
                continue
            if log.level == "error":
                current.error_count += 1
        items: list[AgentStatusResponse] = []
        seen_names: set[str] = set()

        for agent in discovered_agents:
            runtime_item = grouped.get(agent["agent_name"])
            if runtime_item is None:
                items.append(
                    AgentStatusResponse(
                        agent_name=agent["agent_name"],
                        latest_status="unreported",
                        latest_message="尚未收到该智能体的运行时状态上报",
                        error_count=0,
                        updated_at=None,
                        display_name=agent["display_name"],
                        category=agent["category"],
                        source_path=agent["source_path"],
                        status_source="registry",
                    )
                )
            else:
                runtime_item.display_name = agent["display_name"]
                runtime_item.category = agent["category"]
                runtime_item.source_path = agent["source_path"]
                items.append(runtime_item)
            seen_names.add(agent["agent_name"])

        for agent_name, runtime_item in grouped.items():
            if agent_name in seen_names:
                continue
            runtime_item.display_name = AgentRegistryService.humanize(agent_name)
            runtime_item.category = "runtime"
            runtime_item.status_source = "runtime"
            items.append(runtime_item)

        items.sort(key=lambda item: (0 if item.status_source == "runtime" else 1, item.category or "", item.agent_name))
        return AgentStatusListResponse(items=items, total=len(items))

    async def list_agent_runtime_logs(
        self,
        *,
        agent_name: str | None = None,
        level: str | None = None,
    ) -> AgentRuntimeLogListResponse:
        from app.db.session import async_session_factory

        try:
            async with async_session_factory() as session:
                items, total = await AgentRuntimeRepository().list_logs(session, agent_name=agent_name, level=level)
        except (SQLAlchemyError, OSError) as exc:
            if should_use_admin_demo_data(exc):
                return AdminDemoStore.list_agent_logs()
            raise
        return AgentRuntimeLogListResponse(items=[self._to_agent_log_response(item) for item in items], total=total)

    async def list_admin_users(
        self,
        *,
        risk_level: str | None = None,
        course_code: str | None = None,
        user_status: str | None = None,
    ) -> AdminUserOverviewListResponse:
        from app.db.session import async_session_factory

        try:
            async with async_session_factory() as session:
                payload = await AdminUserOverviewRepository().list_user_overview(session)
        except (SQLAlchemyError, OSError) as exc:
            if should_use_admin_demo_data(exc):
                return AdminDemoStore.list_users(
                    risk_level=risk_level,
                    course_code=course_code,
                    user_status=user_status,
                )
            raise
        items = self._build_admin_user_overview_items(payload)
        if risk_level:
            items = [item for item in items if item.risk_level == risk_level]
        if course_code:
            items = [item for item in items if item.course_code == course_code]
        if user_status:
            items = [item for item in items if item.user_status == user_status]
        return AdminUserOverviewListResponse(items=items, total=len(items))

    async def get_admin_user_detail(self, user_id: int) -> AdminUserDetailResponse:
        from app.db.session import async_session_factory

        async with async_session_factory() as session:
            payload = await AdminUserOverviewRepository().list_user_overview(session)

        profiles = payload["profiles"]
        plans = payload["plans"]
        evaluations = payload["evaluations"]
        tickets = payload["tickets"]
        progress_items = payload["progress_items"]
        overview = {item.user_id: item for item in self._build_admin_user_overview_items(payload)}.get(user_id)
        if overview is None:
            raise HTTPException(status_code=404, detail="admin user not found")

        latest_profile = max((item for item in profiles if item.user_id == user_id), key=lambda item: item.id, default=None)
        latest_plan = max((item for item in plans if item.user_id == user_id), key=lambda item: item.id, default=None)
        latest_evaluation = max((item for item in evaluations if item.user_id == user_id), key=lambda item: item.id, default=None)
        user_tickets = sorted(
            [item for item in tickets if item.user_id == user_id],
            key=lambda item: (item.updated_at or "", item.id),
            reverse=True,
        )
        plan_progress_items = []
        if latest_plan is not None:
            plan_progress_items = sorted(
                [item for item in progress_items if item.plan_id == latest_plan.id],
                key=lambda item: (item.updated_at or "", item.id),
                reverse=True,
            )

        return AdminUserDetailResponse(
            user_id=overview.user_id,
            course_code=overview.course_code,
            profile_version=overview.profile_version,
            risk_level=overview.risk_level,
            completion_rate=overview.completion_rate,
            latest_score=overview.latest_score,
            mastery_level=overview.mastery_level,
            user_status=overview.user_status,
            status_reason=overview.status_reason,
            status_updated_by=overview.status_updated_by,
            status_updated_at=overview.status_updated_at,
            last_activity_at=overview.last_activity_at,
            latest_plan_id=overview.latest_plan_id,
            latest_plan_status=overview.latest_plan_status,
            open_ticket_count=overview.open_ticket_count,
            profile_snapshot=getattr(latest_profile, "snapshot_data", None),
            latest_plan_data=getattr(latest_plan, "plan_data", None),
            latest_evaluation_result=getattr(latest_evaluation, "result_data", None),
            progress_items=[
                AdminUserPlanProgressResponse(
                    step_id=item.step_id,
                    title=item.step_title,
                    status=item.status,
                    started_at=item.started_at,
                    completed_at=item.completed_at,
                    updated_at=item.updated_at,
                )
                for item in plan_progress_items
            ],
            tickets=[
                AdminUserTicketResponse(
                    ticket_id=item.id,
                    session_id=item.session_id,
                    status=item.status,
                    question=item.question,
                    latest_reply=item.latest_reply,
                    updated_at=item.updated_at,
                )
                for item in user_tickets
            ],
        )

    async def update_admin_user_status(self, user_id: int, request: AdminUserStatusUpdateRequest) -> AdminUserStatusResponse:
        normalized_status = request.status.strip().lower()
        if normalized_status not in self.ALLOWED_USER_STATUS:
            raise HTTPException(status_code=400, detail="invalid admin user status")

        now = datetime.now(timezone.utc).isoformat()
        from app.db.session import async_session_factory

        try:
            async with async_session_factory() as session:
                payload = await AdminUserOverviewRepository().list_user_overview(session)
                overview_by_user_id = {item.user_id: item for item in self._build_admin_user_overview_items(payload)}
                if user_id not in overview_by_user_id:
                    raise HTTPException(status_code=404, detail="admin user not found")

                control = await AdminUserControlRepository().upsert_user_control(
                    session,
                    user_id=user_id,
                    status=normalized_status,
                    reason=request.reason,
                    updated_by=request.updated_by,
                    created_at=now,
                    updated_at=now,
                )
                await AuditLogRepository().create_log(
                    session,
                    trace_id=None,
                    scene="admin_user",
                    action="admin_user_status_updated",
                    payload={
                        "user_id": user_id,
                        "status": normalized_status,
                        "reason": request.reason,
                        "updated_by": request.updated_by,
                    },
                    created_at=now,
                    updated_at=now,
                )
                await session.commit()
        except (SQLAlchemyError, OSError) as exc:
            if should_use_admin_demo_data(exc):
                return AdminDemoStore.update_user_status(
                    user_id,
                    status=normalized_status,
                    reason=request.reason,
                    updated_by=request.updated_by,
                )
            raise

        return AdminUserStatusResponse(
            user_id=user_id,
            status=control.status,
            reason=control.reason,
            updated_by=control.updated_by,
            updated_at=control.updated_at,
        )

    def _build_admin_user_overview_items(self, payload: dict) -> list[AdminUserOverviewResponse]:
        profiles = payload["profiles"]
        plans = payload["plans"]
        evaluations = payload["evaluations"]
        tickets = payload["tickets"]
        progress_items = payload["progress_items"]
        controls = payload.get("controls", [])

        user_ids = {
            *(item.user_id for item in profiles),
            *(item.user_id for item in plans),
            *(item.user_id for item in evaluations),
            *(item.user_id for item in tickets),
        }

        progress_by_plan: dict[int, list] = {}
        for item in progress_items:
            progress_by_plan.setdefault(item.plan_id, []).append(item)
        control_by_user_id = {item.user_id: item for item in controls}

        items: list[AdminUserOverviewResponse] = []
        for user_id in sorted(user_ids):
            latest_profile = max((item for item in profiles if item.user_id == user_id), key=lambda item: item.id, default=None)
            latest_plan = max((item for item in plans if item.user_id == user_id), key=lambda item: item.id, default=None)
            latest_evaluation = max((item for item in evaluations if item.user_id == user_id), key=lambda item: item.id, default=None)
            user_tickets = [item for item in tickets if item.user_id == user_id]
            open_ticket_count = sum(1 for item in user_tickets if item.status not in {"resolved", "closed"})

            completion_rate = 0.0
            if latest_plan is not None:
                plan_progress_items = progress_by_plan.get(latest_plan.id, [])
                total_steps = len(plan_progress_items)
                completed_steps = sum(1 for item in plan_progress_items if item.status == "completed")
                if total_steps > 0:
                    completion_rate = round((completed_steps / total_steps) * 100, 2)
                else:
                    completion_rate = float(latest_plan.plan_data.get("completion_rate", 0.0) or 0.0)

            latest_score = None
            mastery_level = None
            course_code = None
            if latest_evaluation is not None:
                latest_score = latest_evaluation.result_data.get("overall_score")
                mastery_level = latest_evaluation.result_data.get("mastery_level")
                course_code = latest_evaluation.course_code
            if course_code is None and latest_plan is not None:
                course_code = latest_plan.course_code

            # 风险等级优先参考未处理工单，其次参考学习完成度。
            risk_level = "normal"
            if open_ticket_count >= 2 or completion_rate < 40:
                risk_level = "high"
            elif open_ticket_count >= 1 or completion_rate < 70:
                risk_level = "medium"

            last_activity_candidates = [
                getattr(latest_profile, "updated_at", None),
                getattr(latest_plan, "updated_at", None),
                getattr(latest_evaluation, "updated_at", None),
            ] + [item.updated_at for item in user_tickets if getattr(item, "updated_at", None)]
            last_activity_at = max((item for item in last_activity_candidates if item), default=None)
            control = control_by_user_id.get(user_id)

            items.append(
                AdminUserOverviewResponse(
                    user_id=user_id,
                    course_code=course_code,
                    profile_version=getattr(latest_profile, "version", None),
                    latest_plan_id=getattr(latest_plan, "id", None),
                    latest_plan_status=getattr(latest_plan, "status", None),
                    completion_rate=completion_rate,
                    latest_score=latest_score,
                    mastery_level=mastery_level,
                    open_ticket_count=open_ticket_count,
                    risk_level=risk_level,
                    user_status=getattr(control, "status", "active") or "active",
                    status_reason=getattr(control, "reason", None),
                    status_updated_by=getattr(control, "updated_by", None),
                    status_updated_at=getattr(control, "updated_at", None),
                    last_activity_at=last_activity_at,
                )
            )
        return items

    @staticmethod
    def _build_system_config_history_items(
        logs: list,
        *,
        config_key: str | None = None,
        updated_by: str | None = None,
        sensitive_only: bool = False,
    ) -> list[SystemConfigHistoryResponse]:
        items: list[SystemConfigHistoryResponse] = []
        for log in logs:
            payload = log.payload or {}
            log_config_key = payload.get("config_key")
            log_updated_by = payload.get("updated_by")
            is_sensitive = AdminService._is_sensitive_config_key(log_config_key)
            if config_key and log_config_key != config_key:
                continue
            if updated_by and log_updated_by != updated_by:
                continue
            # 变更历史单独透出新值，便于后台直接展示最近一次配置内容。
            items.append(
                SystemConfigHistoryResponse(
                    config_key=log_config_key or "",
                    updated_by=log_updated_by,
                    value=(
                        AdminService._mask_config_value(payload.get("new_value"))
                        if AdminService._is_sensitive_config_key(log_config_key)
                        else payload.get("new_value")
                    ),
                    is_sensitive=AdminService._is_sensitive_config_key(log_config_key),
                    action=log.action,
                    payload=AdminService._mask_config_payload(
                        payload,
                        is_sensitive=AdminService._is_sensitive_config_key(log_config_key),
                    ),
                    created_at=log.created_at,
                )
            )
        return items

    @staticmethod
    def _build_review_task_history_items(
        logs: list,
        *,
        review_id: int,
    ) -> list[ReviewTaskHistoryResponse]:
        items: list[ReviewTaskHistoryResponse] = []
        for log in logs:
            payload = log.payload or {}
            related_review_id = payload.get("review_id")
            related_review_ids = payload.get("review_ids") or []
            if related_review_id != review_id and review_id not in related_review_ids:
                continue
            items.append(
                ReviewTaskHistoryResponse(
                    review_id=review_id,
                    action=log.action,
                    reviewer_name=payload.get("reviewer_name"),
                    status=payload.get("status"),
                    payload=payload,
                    created_at=log.created_at,
                )
            )
        return items

    async def _update_review_task(
        self,
        review_id: int,
        request: ReviewTaskDecisionRequest,
        *,
        status: str,
        action: str,
    ) -> ReviewTaskResponse:
        now = datetime.now(timezone.utc).isoformat()
        from app.db.session import async_session_factory

        try:
            async with async_session_factory() as session:
                repo = ReviewTaskRepository()
                task = await repo.get_task(session, review_id)
                if task is None:
                    raise HTTPException(status_code=404, detail="review task not found")
                task.status = status
                task.reviewer_name = request.reviewer_name
                task.decision_note = request.decision_note
                task.updated_at = now
                await AuditLogRepository().create_log(
                    session,
                    trace_id=None,
                    scene="content_review",
                    action=action,
                    payload={"review_id": task.id, "reviewer_name": request.reviewer_name, "status": status},
                    created_at=now,
                    updated_at=now,
                )
                await session.commit()
        except (SQLAlchemyError, OSError) as exc:
            if should_use_admin_demo_data(exc):
                return AdminDemoStore.update_review(
                    review_id,
                    status=status,
                    reviewer_name=request.reviewer_name,
                    decision_note=request.decision_note,
                )
            raise
        return self._to_review_response(task)

    async def _batch_update_review_tasks(
        self,
        request: ReviewTaskBatchDecisionRequest,
        *,
        status: str,
        action: str,
    ) -> ReviewTaskBatchDecisionResponse:
        if not request.review_ids:
            return ReviewTaskBatchDecisionResponse(items=[], total=0)

        now = datetime.now(timezone.utc).isoformat()
        from app.db.session import async_session_factory

        async with async_session_factory() as session:
            repo = ReviewTaskRepository()
            tasks = await repo.list_tasks_by_ids(session, request.review_ids)
            updated_items = []
            for task in tasks:
                if task.status != "pending":
                    continue
                task.status = status
                task.reviewer_name = request.reviewer_name
                task.decision_note = request.decision_note
                task.updated_at = now
                updated_items.append(task)

            await AuditLogRepository().create_log(
                session,
                trace_id=None,
                scene="content_review",
                action=action,
                payload={
                    "review_ids": request.review_ids,
                    "reviewer_name": request.reviewer_name,
                    "status": status,
                    "updated_count": len(updated_items),
                },
                created_at=now,
                updated_at=now,
            )
            await session.commit()

        return ReviewTaskBatchDecisionResponse(
            items=[self._to_review_response(task) for task in updated_items],
            total=len(updated_items),
        )

    @staticmethod
    def _to_review_response(task) -> ReviewTaskResponse:
        return ReviewTaskResponse(
            review_id=task.id,
            entity_type=task.entity_type,
            entity_id=task.entity_id,
            source_scene=task.source_scene,
            priority=task.priority,
            status=task.status,
            submitted_content=task.submitted_content,
            reviewer_name=task.reviewer_name,
            decision_note=task.decision_note,
            created_at=task.created_at,
            updated_at=task.updated_at,
        )

    @staticmethod
    def _to_log_response(log) -> AuditLogResponse:
        return AuditLogResponse(
            log_id=log.id,
            trace_id=log.trace_id,
            scene=log.scene,
            action=log.action,
            payload=log.payload,
            created_at=log.created_at,
            updated_at=log.updated_at,
        )

    @staticmethod
    def _to_config_response(config) -> SystemConfigResponse:
        is_sensitive = AdminService._is_sensitive_config_key(config.config_key)
        return SystemConfigResponse(
            config_key=config.config_key,
            config_value=AdminService._mask_config_value(config.config_value) if is_sensitive else config.config_value,
            is_sensitive=is_sensitive,
            description=config.description,
            updated_by=config.updated_by,
            created_at=config.created_at,
            updated_at=config.updated_at,
        )

    @classmethod
    def _is_sensitive_config_key(cls, config_key: str | None) -> bool:
        normalized_key = (config_key or "").lower()
        return any(keyword in normalized_key for keyword in cls.SENSITIVE_CONFIG_KEYWORDS)

    @staticmethod
    def _mask_config_value(value: str | None) -> str | None:
        if value is None:
            return None
        # 敏感配置统一返回固定掩码，避免暴露真实长度与局部内容
        return "******"

    @classmethod
    def _mask_config_payload(cls, payload: dict | None, *, is_sensitive: bool) -> dict | None:
        if payload is None:
            return None
        if not is_sensitive:
            return payload
        masked_payload = dict(payload)
        for field in ("old_value", "new_value"):
            masked_payload[field] = cls._mask_config_value(masked_payload.get(field))
        return masked_payload

    @staticmethod
    def _to_agent_log_response(log) -> AgentRuntimeLogResponse:
        return AgentRuntimeLogResponse(
            log_id=log.id,
            agent_name=log.agent_name,
            level=log.level,
            status=log.status,
            message=AdminService._normalize_agent_message(log.agent_name, log.message),
            payload=AdminService._normalize_agent_payload(log.agent_name, log.payload),
            created_at=log.created_at,
            updated_at=log.updated_at,
        )

    @staticmethod
    def _normalize_agent_message(agent_name: str | None, message: str | None) -> str | None:
        if not message:
            return message
        if agent_name == "profile_agent":
            return "学习画像链路可用"
        if agent_name == "resource_agent":
            return "资源包推荐完成，已返回讲义、练习和案例组合。"
        if agent_name == "planner_agent":
            return "学习路径已生成，并同步到今日任务编排。"
        if agent_name == "evaluator_agent":
            return "阶段测评生成耗时偏高，已切换到降级模板输出。"
        return message

    @staticmethod
    def _normalize_agent_payload(agent_name: str | None, payload: dict | None) -> dict | None:
        if payload is None:
            return None
        normalized_payload = dict(payload)
        if agent_name == "resource_agent" and "topic" in normalized_payload:
            normalized_payload["topic"] = "模型评估与过拟合"
        return normalized_payload
