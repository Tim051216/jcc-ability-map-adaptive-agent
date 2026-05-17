from __future__ import annotations

from datetime import datetime, timezone

from fastapi import HTTPException

from app.schemas.admin import (
    AdminNotificationActionRequest,
    AdminNotificationListResponse,
    AdminNotificationResponse,
)
from app.services.admin_dashboard_service import AdminDashboardService
from app.services.agent_runtime_summary_service import AgentRuntimeSummaryService
from app.services.local_runtime_store import LocalRuntimeStore
from app.services.review_task_summary_service import ReviewTaskSummaryService
from app.services.system_config_summary_service import SystemConfigSummaryService


class AdminNotificationService:
    async def list_notifications(self) -> AdminNotificationListResponse:
        items = await self._build_notifications()
        unread_count = sum(1 for item in items if item.unread and item.status != "resolved")
        open_count = sum(1 for item in items if item.status != "resolved")
        resolved_count = sum(1 for item in items if item.status == "resolved")
        return AdminNotificationListResponse(
            items=items,
            total=len(items),
            unread_count=unread_count,
            open_count=open_count,
            resolved_count=resolved_count,
        )

    async def mark_as_read(self, notification_id: str, request: AdminNotificationActionRequest) -> AdminNotificationResponse:
        return await self._update_notification_status(notification_id, request, status="read")

    async def resolve_notification(
        self,
        notification_id: str,
        request: AdminNotificationActionRequest,
    ) -> AdminNotificationResponse:
        return await self._update_notification_status(notification_id, request, status="resolved")

    async def reopen_notification(
        self,
        notification_id: str,
        request: AdminNotificationActionRequest,
    ) -> AdminNotificationResponse:
        return await self._update_notification_status(notification_id, request, status="new")

    async def _update_notification_status(
        self,
        notification_id: str,
        request: AdminNotificationActionRequest,
        *,
        status: str,
    ) -> AdminNotificationResponse:
        notifications = await self._build_notifications()
        item = next((entry for entry in notifications if entry.notification_id == notification_id), None)
        if item is None:
            raise HTTPException(status_code=404, detail="notification not found")

        store = LocalRuntimeStore.load_notification_store()
        updated_at = self._now()
        store.setdefault("items", {})[notification_id] = {
            "status": status,
            "fingerprint": item.fingerprint,
            "updated_at": updated_at,
            "updated_by": request.updated_by,
        }
        LocalRuntimeStore.save_notification_store(store)
        item.status = status
        item.unread = status == "new"
        item.updated_at = updated_at
        item.updated_by = request.updated_by
        return item

    async def _build_notifications(self) -> list[AdminNotificationResponse]:
        dashboard_summary, review_summary, agent_summary, config_summary = await self._load_sources()
        generated_at = self._now()
        store = LocalRuntimeStore.load_notification_store().get("items", {})
        items: list[AdminNotificationResponse] = []

        if review_summary.pending_count > 0:
            items.append(
                self._merge_state(
                    AdminNotificationResponse(
                        notification_id="pending-reviews",
                        category="content_review",
                        title="待审核内容需要处理",
                        detail=f"当前共有 {review_summary.pending_count} 条待处理审核任务，建议优先进入内容审核页处理。",
                        tone="warning",
                        target_view="compliance",
                        target_label="打开内容审核",
                        status="new",
                        unread=True,
                        count=review_summary.pending_count,
                        fingerprint=f"pending:{review_summary.pending_count}:{review_summary.latest_review_at}",
                        generated_at=generated_at,
                    ),
                    store,
                )
            )

        if dashboard_summary.high_risk_users > 0:
            items.append(
                self._merge_state(
                    AdminNotificationResponse(
                        notification_id="high-risk-users",
                        category="user_governance",
                        title="高风险用户需要跟进",
                        detail=f"当前有 {dashboard_summary.high_risk_users} 位高风险用户，建议复核状态、工单和最近学习活动。",
                        tone="danger",
                        target_view="governance",
                        target_label="打开用户治理",
                        status="new",
                        unread=True,
                        count=dashboard_summary.high_risk_users,
                        fingerprint=f"risk:{dashboard_summary.high_risk_users}:{dashboard_summary.latest_activity_at}",
                        generated_at=generated_at,
                    ),
                    store,
                )
            )

        agent_issue_count = agent_summary.error_count + agent_summary.degraded_agent_count
        if agent_issue_count > 0:
            items.append(
                self._merge_state(
                    AdminNotificationResponse(
                        notification_id="agent-runtime-issues",
                        category="agent_runtime",
                        title="Agent 运行存在异常",
                        detail=(
                            f"当前共有 {agent_summary.error_count} 条错误日志，"
                            f"{agent_summary.degraded_agent_count} 个智能体处于降级状态。"
                        ),
                        tone="danger",
                        target_view="monitoring",
                        target_label="打开 AI 监控",
                        status="new",
                        unread=True,
                        count=agent_issue_count,
                        fingerprint=f"agent:{agent_summary.error_count}:{agent_summary.degraded_agent_count}:{agent_summary.latest_log_at}",
                        generated_at=generated_at,
                    ),
                    store,
                )
            )

        if config_summary.sensitive_count > 0:
            items.append(
                self._merge_state(
                    AdminNotificationResponse(
                        notification_id="sensitive-configs",
                        category="system_config",
                        title="敏感配置需要复核",
                        detail=f"系统中存在 {config_summary.sensitive_count} 项敏感配置，变更前建议再次确认环境和访问权限。",
                        tone="warning",
                        target_view="management",
                        target_label="打开系统管理",
                        status="new",
                        unread=True,
                        count=config_summary.sensitive_count,
                        fingerprint=f"config:{config_summary.sensitive_count}:{config_summary.latest_updated_at}",
                        generated_at=generated_at,
                    ),
                    store,
                )
            )

        return items

    async def _load_sources(self):
        return await AdminDashboardService().get_summary(), await ReviewTaskSummaryService().get_summary(), await AgentRuntimeSummaryService().get_summary(), await SystemConfigSummaryService().get_summary()

    def _merge_state(self, item: AdminNotificationResponse, store: dict[str, dict]) -> AdminNotificationResponse:
        saved = store.get(item.notification_id)
        if not saved:
            return item

        if saved.get("fingerprint") != item.fingerprint:
            return item

        item.status = saved.get("status") or "new"
        item.unread = item.status == "new"
        item.updated_at = saved.get("updated_at")
        item.updated_by = saved.get("updated_by")
        return item

    @staticmethod
    def _now() -> str:
        return datetime.now(timezone.utc).isoformat()
