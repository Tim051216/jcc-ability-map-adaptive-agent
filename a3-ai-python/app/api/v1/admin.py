from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from app.core.config import settings
from app.rag.ingest.pipelines import KnowledgeIngestPipeline
from app.schemas.admin import (
    AIOpsOverviewResponse,
    AdminNotificationActionRequest,
    AdminNotificationListResponse,
    AdminNotificationResponse,
    AdminSessionLoginRequest,
    AdminSessionStateResponse,
    AdminSessionSwitchEnvironmentRequest,
    AdminDashboardSummaryResponse,
    AdminUserOverviewListResponse,
    AdminUserDetailResponse,
    AdminUserStatusHistoryListResponse,
    AdminUserStatusResponse,
    AdminUserStatusUpdateRequest,
    AgentRuntimeLogListResponse,
    AgentRuntimeSummaryResponse,
    AgentStatusListResponse,
    AuditLogListResponse,
    AuditLogSummaryResponse,
    DeploymentListResponse,
    DeploymentRollbackRequest,
    DeploymentRecordResponse,
    DeploymentTriggerRequest,
    ReviewTaskBatchDecisionRequest,
    ReviewTaskBatchDecisionResponse,
    ReviewTaskCreateRequest,
    ReviewTaskDecisionRequest,
    ReviewTaskHistoryListResponse,
    ReviewTaskListResponse,
    ReviewTaskResponse,
    ReviewTaskSummaryResponse,
    SystemConfigListResponse,
    SystemConfigSummaryResponse,
    SystemConfigHistoryListResponse,
    SystemConfigHistorySummaryResponse,
    SystemConfigResponse,
    SystemConfigUpdateRequest,
)
from app.services.admin_demo_data import AdminDemoStore
from app.services.admin_dashboard_service import AdminDashboardService
from app.services.admin_notification_service import AdminNotificationService
from app.services.admin_session_service import AdminSessionService
from app.services.agent_runtime_summary_service import AgentRuntimeSummaryService
from app.services.admin_export_service import AdminExportService
from app.services.admin_service import AdminService
from app.services.admin_user_status_history_service import AdminUserStatusHistoryService
from app.services.audit_log_summary_service import AuditLogSummaryService
from app.services.embedding_service import EmbeddingService
from app.services.llm_health_service import LLMHealthService
from app.services.review_task_summary_service import ReviewTaskSummaryService
from app.services.system_config_summary_service import SystemConfigSummaryService
from app.services.system_config_history_summary_service import SystemConfigHistorySummaryService

router = APIRouter()


@router.get("/ping")
async def ping() -> dict[str, str]:
    return {"message": "admin ok"}


@router.get("/dashboard/summary", response_model=AdminDashboardSummaryResponse)
async def get_admin_dashboard_summary() -> AdminDashboardSummaryResponse:
    service = AdminDashboardService()
    return await service.get_summary()


@router.get("/session", response_model=AdminSessionStateResponse)
async def get_admin_session_state() -> AdminSessionStateResponse:
    service = AdminSessionService()
    return service.get_state()


@router.post("/session/login", response_model=AdminSessionStateResponse)
async def login_admin_session(request: AdminSessionLoginRequest) -> AdminSessionStateResponse:
    service = AdminSessionService()
    return service.login(request)


@router.post("/session/logout", response_model=AdminSessionStateResponse)
async def logout_admin_session() -> AdminSessionStateResponse:
    service = AdminSessionService()
    return service.logout()


@router.post("/session/environment", response_model=AdminSessionStateResponse)
async def switch_admin_environment(request: AdminSessionSwitchEnvironmentRequest) -> AdminSessionStateResponse:
    service = AdminSessionService()
    return service.switch_environment(request)


@router.get("/notifications", response_model=AdminNotificationListResponse)
async def list_admin_notifications() -> AdminNotificationListResponse:
    service = AdminNotificationService()
    return await service.list_notifications()


@router.post("/notifications/{notification_id}/read", response_model=AdminNotificationResponse)
async def mark_admin_notification_as_read(
    notification_id: str,
    request: AdminNotificationActionRequest,
) -> AdminNotificationResponse:
    service = AdminNotificationService()
    return await service.mark_as_read(notification_id, request)


@router.post("/notifications/{notification_id}/resolve", response_model=AdminNotificationResponse)
async def resolve_admin_notification(
    notification_id: str,
    request: AdminNotificationActionRequest,
) -> AdminNotificationResponse:
    service = AdminNotificationService()
    return await service.resolve_notification(notification_id, request)


@router.post("/notifications/{notification_id}/reopen", response_model=AdminNotificationResponse)
async def reopen_admin_notification(
    notification_id: str,
    request: AdminNotificationActionRequest,
) -> AdminNotificationResponse:
    service = AdminNotificationService()
    return await service.reopen_notification(notification_id, request)


@router.get("/overview")
async def get_admin_overview() -> dict:
    return await AdminService().get_overview()


@router.post("/knowledge/{course_code}/ingest")
async def ingest_knowledge(course_code: str) -> dict:
    if not settings.milvus_enabled:
        raise HTTPException(status_code=503, detail="Milvus is disabled in this deployment.")
    pipeline = KnowledgeIngestPipeline()
    return await pipeline.run(course_code)


@router.get("/llm/ping")
async def ping_llm() -> dict:
    return await LLMHealthService().ping()


@router.get("/embedding/ping")
async def ping_embedding() -> dict:
    return await EmbeddingService().ping()


@router.get("/aiops/overview", response_model=AIOpsOverviewResponse)
async def get_aiops_overview() -> AIOpsOverviewResponse:
    return AdminDemoStore.get_aiops_overview()


@router.get("/deployments", response_model=DeploymentListResponse)
async def list_deployments() -> DeploymentListResponse:
    return AdminDemoStore.list_deployments()


@router.post("/deployments", response_model=DeploymentRecordResponse)
async def trigger_deployment(request: DeploymentTriggerRequest) -> DeploymentRecordResponse:
    return AdminDemoStore.trigger_deployment(
        target=request.target,
        version=request.version,
        operator=request.operator,
        note=request.note,
    )


@router.post("/deployments/{deployment_id}/rollback", response_model=DeploymentRecordResponse)
async def rollback_deployment(deployment_id: str, request: DeploymentRollbackRequest) -> DeploymentRecordResponse:
    return AdminDemoStore.rollback_deployment(
        deployment_id,
        operator=request.operator,
        note=request.note,
    )


@router.get("/configs", response_model=SystemConfigListResponse)
async def list_system_configs(
    sensitive_only: bool = False,
) -> SystemConfigListResponse:
    service = AdminService()
    return await service.list_system_configs(sensitive_only=sensitive_only)


@router.get("/configs/summary", response_model=SystemConfigSummaryResponse)
async def get_system_config_summary() -> SystemConfigSummaryResponse:
    service = SystemConfigSummaryService()
    return await service.get_summary()


@router.put("/configs/{config_key}", response_model=SystemConfigResponse)
async def update_system_config(
    config_key: str,
    request: SystemConfigUpdateRequest,
) -> SystemConfigResponse:
    service = AdminService()
    return await service.update_system_config(config_key, request)


@router.get("/configs/history", response_model=SystemConfigHistoryListResponse)
async def list_system_config_history(
    config_key: str | None = None,
    updated_by: str | None = None,
) -> SystemConfigHistoryListResponse:
    service = AdminService()
    return await service.list_system_config_history(config_key=config_key, updated_by=updated_by)


@router.get("/configs/history/summary", response_model=SystemConfigHistorySummaryResponse)
async def get_system_config_history_summary(
    config_key: str | None = None,
    updated_by: str | None = None,
) -> SystemConfigHistorySummaryResponse:
    service = SystemConfigHistorySummaryService()
    return await service.get_summary(config_key=config_key, updated_by=updated_by)


@router.post("/reviews", response_model=ReviewTaskResponse)
async def create_review_task(request: ReviewTaskCreateRequest) -> ReviewTaskResponse:
    service = AdminService()
    return await service.create_review_task(request)


@router.get("/reviews", response_model=ReviewTaskListResponse)
async def list_review_tasks(
    status: str | None = None,
    entity_type: str | None = None,
    priority: str | None = None,
    source_scene: str | None = None,
    reviewer_name: str | None = None,
    keyword: str | None = None,
) -> ReviewTaskListResponse:
    service = AdminService()
    return await service.list_review_tasks(
        status=status,
        entity_type=entity_type,
        priority=priority,
        source_scene=source_scene,
        reviewer_name=reviewer_name,
        keyword=keyword,
    )


@router.get("/reviews/summary", response_model=ReviewTaskSummaryResponse)
async def get_review_task_summary() -> ReviewTaskSummaryResponse:
    service = ReviewTaskSummaryService()
    return await service.get_summary()


@router.post("/reviews/batch/approve", response_model=ReviewTaskBatchDecisionResponse)
async def approve_review_tasks(request: ReviewTaskBatchDecisionRequest) -> ReviewTaskBatchDecisionResponse:
    service = AdminService()
    return await service.approve_review_tasks(request)


@router.post("/reviews/batch/reject", response_model=ReviewTaskBatchDecisionResponse)
async def reject_review_tasks(request: ReviewTaskBatchDecisionRequest) -> ReviewTaskBatchDecisionResponse:
    service = AdminService()
    return await service.reject_review_tasks(request)


@router.get("/reviews/{review_id}", response_model=ReviewTaskResponse)
async def get_review_task(review_id: int) -> ReviewTaskResponse:
    service = AdminService()
    return await service.get_review_task(review_id)


@router.get("/reviews/{review_id}/history", response_model=ReviewTaskHistoryListResponse)
async def get_review_task_history(review_id: int) -> ReviewTaskHistoryListResponse:
    service = AdminService()
    return await service.get_review_task_history(review_id)


@router.post("/reviews/{review_id}/approve", response_model=ReviewTaskResponse)
async def approve_review_task(
    review_id: int,
    request: ReviewTaskDecisionRequest,
) -> ReviewTaskResponse:
    service = AdminService()
    return await service.approve_review_task(review_id, request)


@router.post("/reviews/{review_id}/reject", response_model=ReviewTaskResponse)
async def reject_review_task(
    review_id: int,
    request: ReviewTaskDecisionRequest,
) -> ReviewTaskResponse:
    service = AdminService()
    return await service.reject_review_task(review_id, request)


@router.get("/logs", response_model=AuditLogListResponse)
async def list_audit_logs(
    scene: str | None = None,
    action: str | None = None,
) -> AuditLogListResponse:
    service = AdminService()
    return await service.list_audit_logs(scene=scene, action=action)


@router.get("/logs/summary", response_model=AuditLogSummaryResponse)
async def get_audit_log_summary(
    scene: str | None = None,
    action: str | None = None,
) -> AuditLogSummaryResponse:
    service = AuditLogSummaryService()
    return await service.get_summary(scene=scene, action=action)


@router.get("/logs/export")
async def export_audit_logs(
    scene: str | None = None,
    action: str | None = None,
) -> StreamingResponse:
    content = await AdminExportService().export_audit_logs_csv(scene=scene, action=action)
    return StreamingResponse(
        iter([content.encode("utf-8-sig")]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="audit-logs.csv"'},
    )


@router.get("/agents/status", response_model=AgentStatusListResponse)
async def list_agent_status() -> AgentStatusListResponse:
    service = AdminService()
    return await service.list_agent_status()


@router.get("/agents/logs", response_model=AgentRuntimeLogListResponse)
async def list_agent_runtime_logs(
    agent_name: str | None = None,
    level: str | None = None,
) -> AgentRuntimeLogListResponse:
    service = AdminService()
    return await service.list_agent_runtime_logs(agent_name=agent_name, level=level)


@router.get("/agents/logs/summary", response_model=AgentRuntimeSummaryResponse)
async def get_agent_runtime_summary(
    agent_name: str | None = None,
    level: str | None = None,
) -> AgentRuntimeSummaryResponse:
    service = AgentRuntimeSummaryService()
    return await service.get_summary(agent_name=agent_name, level=level)


@router.get("/agents/logs/export")
async def export_agent_runtime_logs(
    agent_name: str | None = None,
    level: str | None = None,
) -> StreamingResponse:
    content = await AdminExportService().export_agent_runtime_logs_csv(agent_name=agent_name, level=level)
    return StreamingResponse(
        iter([content.encode("utf-8-sig")]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="agent-runtime-logs.csv"'},
    )


@router.get("/users", response_model=AdminUserOverviewListResponse)
async def list_admin_users(
    risk_level: str | None = None,
    course_code: str | None = None,
    user_status: str | None = None,
) -> AdminUserOverviewListResponse:
    service = AdminService()
    return await service.list_admin_users(risk_level=risk_level, course_code=course_code, user_status=user_status)


@router.get("/users/status-history", response_model=AdminUserStatusHistoryListResponse)
async def list_admin_user_status_history(
    user_id: int | None = None,
    status: str | None = None,
    updated_by: str | None = None,
) -> AdminUserStatusHistoryListResponse:
    service = AdminUserStatusHistoryService()
    return await service.list_history(user_id=user_id, status=status, updated_by=updated_by)


@router.get("/users/{user_id}", response_model=AdminUserDetailResponse)
async def get_admin_user_detail(user_id: int) -> AdminUserDetailResponse:
    service = AdminService()
    return await service.get_admin_user_detail(user_id)


@router.put("/users/{user_id}/status", response_model=AdminUserStatusResponse)
async def update_admin_user_status(
    user_id: int,
    request: AdminUserStatusUpdateRequest,
) -> AdminUserStatusResponse:
    service = AdminService()
    return await service.update_admin_user_status(user_id, request)
