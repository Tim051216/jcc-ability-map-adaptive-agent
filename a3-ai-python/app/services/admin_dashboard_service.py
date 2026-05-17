from sqlalchemy.exc import SQLAlchemyError

from app.db.repositories.admin_repository import (
    AdminUserOverviewRepository,
    AgentRuntimeRepository,
    ReviewTaskRepository,
    SystemConfigRepository,
)
from app.db.session import async_session_factory
from app.schemas.admin import AdminDashboardSummaryResponse
from app.services.admin_demo_data import AdminDemoStore, should_use_admin_demo_data
from app.services.admin_service import AdminService


class AdminDashboardService:
    async def get_summary(self) -> AdminDashboardSummaryResponse:
        try:
            async with async_session_factory() as session:
                overview_payload = await AdminUserOverviewRepository().list_user_overview(session)
                review_items, _ = await ReviewTaskRepository().list_tasks(session, status="pending")
                configs = await SystemConfigRepository().list_configs(session)
                runtime_logs, _ = await AgentRuntimeRepository().list_logs(session)
        except (SQLAlchemyError, OSError) as exc:
            if should_use_admin_demo_data(exc):
                return AdminDemoStore.get_dashboard_summary()
            raise

        admin_service = AdminService()
        user_items = admin_service._build_admin_user_overview_items(overview_payload)

        total_users = len(user_items)
        high_risk_users = sum(1 for item in user_items if item.risk_level == "high")
        suspended_users = sum(1 for item in user_items if item.user_status == "suspended")
        open_ticket_count = sum(item.open_ticket_count for item in user_items)
        degraded_agent_count = self._count_degraded_agents(runtime_logs)
        sensitive_config_count = sum(1 for item in configs if admin_service._is_sensitive_config_key(item.config_key))
        latest_activity_at = max(
            [
                *(item.last_activity_at for item in user_items if item.last_activity_at),
                *(item.updated_at for item in review_items if getattr(item, "updated_at", None)),
                *(item.updated_at for item in configs if getattr(item, "updated_at", None)),
                *(item.created_at for item in runtime_logs if getattr(item, "created_at", None)),
            ],
            default=None,
        )

        return AdminDashboardSummaryResponse(
            total_users=total_users,
            high_risk_users=high_risk_users,
            suspended_users=suspended_users,
            open_ticket_count=open_ticket_count,
            pending_review_count=len(review_items),
            degraded_agent_count=degraded_agent_count,
            sensitive_config_count=sensitive_config_count,
            latest_activity_at=latest_activity_at,
        )

    @staticmethod
    def _count_degraded_agents(runtime_logs: list) -> int:
        if not runtime_logs:
            return 0
        latest_by_agent: dict[str, str] = {}
        for log in runtime_logs:
            if log.agent_name not in latest_by_agent:
                latest_by_agent[log.agent_name] = log.status
        return sum(1 for status in latest_by_agent.values() if status != "ok")
