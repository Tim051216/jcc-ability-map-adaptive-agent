import csv
import io
import json

from app.db.repositories.admin_repository import AgentRuntimeRepository, AuditLogRepository


class AdminExportService:
    async def export_audit_logs_csv(
        self,
        *,
        scene: str | None = None,
        action: str | None = None,
    ) -> str:
        from app.db.session import async_session_factory

        async with async_session_factory() as session:
            items, _ = await AuditLogRepository().list_logs(session, scene=scene, action=action)
        return self._build_audit_log_csv(items)

    async def export_agent_runtime_logs_csv(
        self,
        *,
        agent_name: str | None = None,
        level: str | None = None,
    ) -> str:
        from app.db.session import async_session_factory

        async with async_session_factory() as session:
            items, _ = await AgentRuntimeRepository().list_logs(session, agent_name=agent_name, level=level)
        return self._build_agent_runtime_csv(items)

    @staticmethod
    def _build_audit_log_csv(items: list) -> str:
        buffer = io.StringIO()
        writer = csv.writer(buffer)
        writer.writerow(["log_id", "trace_id", "scene", "action", "payload", "created_at", "updated_at"])
        for item in items:
            # 统一把结构化 payload 转成字符串，便于后台直接导出下载。
            writer.writerow(
                [
                    item.id,
                    item.trace_id or "",
                    item.scene,
                    item.action,
                    json.dumps(item.payload, ensure_ascii=False) if item.payload is not None else "",
                    item.created_at or "",
                    item.updated_at or "",
                ]
            )
        return buffer.getvalue()

    @staticmethod
    def _build_agent_runtime_csv(items: list) -> str:
        buffer = io.StringIO()
        writer = csv.writer(buffer)
        writer.writerow(
            ["log_id", "agent_name", "level", "status", "message", "payload", "created_at", "updated_at"]
        )
        for item in items:
            writer.writerow(
                [
                    item.id,
                    item.agent_name,
                    item.level,
                    item.status,
                    item.message,
                    json.dumps(item.payload, ensure_ascii=False) if item.payload is not None else "",
                    item.created_at or "",
                    item.updated_at or "",
                ]
            )
        return buffer.getvalue()
