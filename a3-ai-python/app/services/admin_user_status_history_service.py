from app.db.repositories.admin_repository import AuditLogRepository
from app.db.session import async_session_factory
from app.schemas.admin import AdminUserStatusHistoryItem, AdminUserStatusHistoryListResponse


class AdminUserStatusHistoryService:
    async def list_history(
        self,
        *,
        user_id: int | None = None,
        status: str | None = None,
        updated_by: str | None = None,
    ) -> AdminUserStatusHistoryListResponse:
        async with async_session_factory() as session:
            logs, _ = await AuditLogRepository().list_logs(
                session,
                scene="admin_user",
                action="admin_user_status_updated",
            )

        items: list[AdminUserStatusHistoryItem] = []
        for log in logs:
            payload = log.payload or {}
            log_user_id = payload.get("user_id")
            log_status = payload.get("status")
            log_updated_by = payload.get("updated_by")
            if user_id is not None and log_user_id != user_id:
                continue
            if status and log_status != status:
                continue
            if updated_by and log_updated_by != updated_by:
                continue
            items.append(
                AdminUserStatusHistoryItem(
                    user_id=log_user_id,
                    status=log_status or "",
                    reason=payload.get("reason"),
                    updated_by=log_updated_by,
                    created_at=log.created_at,
                )
            )
        return AdminUserStatusHistoryListResponse(items=items, total=len(items))
