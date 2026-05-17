from collections import Counter

from sqlalchemy.exc import SQLAlchemyError

from app.db.repositories.admin_repository import AgentRuntimeRepository
from app.db.session import async_session_factory
from app.schemas.admin import AgentRuntimeSummaryResponse
from app.services.admin_demo_data import AdminDemoStore, should_use_admin_demo_data


class AgentRuntimeSummaryService:
    async def get_summary(
        self,
        *,
        agent_name: str | None = None,
        level: str | None = None,
    ) -> AgentRuntimeSummaryResponse:
        try:
            async with async_session_factory() as session:
                items, total = await AgentRuntimeRepository().list_logs(
                    session,
                    agent_name=agent_name,
                    level=level,
                )
        except (SQLAlchemyError, OSError) as exc:
            if should_use_admin_demo_data(exc):
                return AdminDemoStore.get_agent_runtime_summary()
            raise

        by_agent = Counter(item.agent_name for item in items)
        by_level = Counter(item.level for item in items)
        error_count = by_level.get("error", 0)
        degraded_agents = self._count_degraded_agents(items)
        latest_log_at = max((item.created_at for item in items if item.created_at), default=None)

        return AgentRuntimeSummaryResponse(
            total=total,
            error_count=error_count,
            degraded_agent_count=degraded_agents,
            by_agent=dict(by_agent),
            by_level=dict(by_level),
            latest_log_at=latest_log_at,
        )

    @staticmethod
    def _count_degraded_agents(items: list) -> int:
        latest_by_agent: dict[str, str] = {}
        for item in items:
            if item.agent_name not in latest_by_agent:
                latest_by_agent[item.agent_name] = item.status
        return sum(1 for status in latest_by_agent.values() if status != "ok")
