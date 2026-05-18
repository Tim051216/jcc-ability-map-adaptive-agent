from pydantic import BaseModel, Field


class ReviewTaskCreateRequest(BaseModel):
    entity_type: str
    entity_id: int
    submitted_content: str
    source_scene: str = "manual_submit"
    priority: str = "normal"


class ReviewTaskDecisionRequest(BaseModel):
    reviewer_name: str
    decision_note: str | None = None


class ReviewTaskBatchDecisionRequest(BaseModel):
    review_ids: list[int] = Field(default_factory=list)
    reviewer_name: str
    decision_note: str | None = None


class ReviewTaskResponse(BaseModel):
    review_id: int
    entity_type: str
    entity_id: int
    source_scene: str
    priority: str
    status: str
    submitted_content: str
    reviewer_name: str | None = None
    decision_note: str | None = None
    created_at: str | None = None
    updated_at: str | None = None


class ReviewTaskListResponse(BaseModel):
    items: list[ReviewTaskResponse] = Field(default_factory=list)
    total: int = 0


class ReviewTaskBatchDecisionResponse(BaseModel):
    items: list[ReviewTaskResponse] = Field(default_factory=list)
    total: int = 0


class ReviewTaskHistoryResponse(BaseModel):
    review_id: int
    action: str
    reviewer_name: str | None = None
    status: str | None = None
    payload: dict | None = None
    created_at: str | None = None


class ReviewTaskHistoryListResponse(BaseModel):
    items: list[ReviewTaskHistoryResponse] = Field(default_factory=list)
    total: int = 0


class ReviewTaskSummaryResponse(BaseModel):
    total: int = 0
    pending_count: int = 0
    by_status: dict[str, int] = Field(default_factory=dict)
    by_priority: dict[str, int] = Field(default_factory=dict)
    by_source_scene: dict[str, int] = Field(default_factory=dict)
    latest_review_at: str | None = None


class AdminNotificationResponse(BaseModel):
    notification_id: str
    category: str
    title: str
    detail: str
    tone: str
    target_view: str | None = None
    target_label: str | None = None
    status: str = "new"
    unread: bool = True
    count: int = 0
    fingerprint: str
    generated_at: str | None = None
    updated_at: str | None = None
    updated_by: str | None = None


class AdminNotificationListResponse(BaseModel):
    items: list[AdminNotificationResponse] = Field(default_factory=list)
    total: int = 0
    unread_count: int = 0
    open_count: int = 0
    resolved_count: int = 0


class AdminNotificationActionRequest(BaseModel):
    updated_by: str = "codex-admin"


class AdminSessionEnvironmentResponse(BaseModel):
    environment_id: str
    label: str
    description: str
    app_env: str
    llm_mode: str
    embedding_mode: str
    risk_level: str
    config_profile: dict[str, str] = Field(default_factory=dict)
    is_active: bool = False


class AdminSessionHistoryResponse(BaseModel):
    action: str
    actor: str
    environment_id: str | None = None
    created_at: str | None = None
    detail: str | None = None


class AdminSessionResponse(BaseModel):
    username: str
    display_name: str
    role: str
    active_environment_id: str
    active_environment_label: str
    login_state: str = "active"
    logged_in_at: str | None = None
    last_seen_at: str | None = None


class AdminSessionStateResponse(BaseModel):
    session: AdminSessionResponse | None = None
    environments: list[AdminSessionEnvironmentResponse] = Field(default_factory=list)
    history: list[AdminSessionHistoryResponse] = Field(default_factory=list)


class AdminSessionLoginRequest(BaseModel):
    username: str
    password: str
    environment_id: str = "local-live"


class AdminSessionSwitchEnvironmentRequest(BaseModel):
    environment_id: str


class AuditLogResponse(BaseModel):
    log_id: int
    trace_id: str | None = None
    scene: str
    action: str
    payload: dict | None = None
    created_at: str | None = None
    updated_at: str | None = None


class AuditLogListResponse(BaseModel):
    items: list[AuditLogResponse] = Field(default_factory=list)
    total: int = 0


class AuditLogSummaryResponse(BaseModel):
    total: int = 0
    by_scene: dict[str, int] = Field(default_factory=dict)
    by_action: dict[str, int] = Field(default_factory=dict)
    latest_log_at: str | None = None


class SystemConfigUpdateRequest(BaseModel):
    value: str
    description: str | None = None
    updated_by: str = "admin"


class SystemConfigResponse(BaseModel):
    config_key: str
    config_value: str
    is_sensitive: bool = False
    description: str | None = None
    updated_by: str | None = None
    created_at: str | None = None
    updated_at: str | None = None


class SystemConfigListResponse(BaseModel):
    items: list[SystemConfigResponse] = Field(default_factory=list)
    total: int = 0


class SystemConfigSummaryResponse(BaseModel):
    total: int = 0
    sensitive_count: int = 0
    by_prefix: dict[str, int] = Field(default_factory=dict)
    latest_updated_at: str | None = None


class SystemConfigHistoryResponse(BaseModel):
    config_key: str
    updated_by: str | None = None
    value: str | None = None
    is_sensitive: bool = False
    action: str
    payload: dict | None = None
    created_at: str | None = None


class SystemConfigHistoryListResponse(BaseModel):
    items: list[SystemConfigHistoryResponse] = Field(default_factory=list)
    total: int = 0


class SystemConfigHistorySummaryResponse(BaseModel):
    total: int = 0
    by_config_key: dict[str, int] = Field(default_factory=dict)
    by_updated_by: dict[str, int] = Field(default_factory=dict)
    latest_created_at: str | None = None


class AgentStatusResponse(BaseModel):
    agent_name: str
    latest_status: str
    latest_message: str | None = None
    error_count: int = 0
    updated_at: str | None = None
    display_name: str | None = None
    category: str | None = None
    source_path: str | None = None
    status_source: str | None = None


class AgentStatusListResponse(BaseModel):
    items: list[AgentStatusResponse] = Field(default_factory=list)
    total: int = 0


class AgentRuntimeLogResponse(BaseModel):
    log_id: int
    agent_name: str
    level: str
    status: str
    message: str
    payload: dict | None = None
    created_at: str | None = None
    updated_at: str | None = None


class AgentRuntimeLogListResponse(BaseModel):
    items: list[AgentRuntimeLogResponse] = Field(default_factory=list)
    total: int = 0


class AgentRuntimeSummaryResponse(BaseModel):
    total: int = 0
    error_count: int = 0
    degraded_agent_count: int = 0
    by_agent: dict[str, int] = Field(default_factory=dict)
    by_level: dict[str, int] = Field(default_factory=dict)
    latest_log_at: str | None = None


class AIOpsChainMetricResponse(BaseModel):
    chain_id: str
    label: str
    status: str
    avg_latency_ms: int
    p95_latency_ms: int
    error_rate: float = 0.0
    related_agents: list[str] = Field(default_factory=list)


class AIOpsParameterResponse(BaseModel):
    key: str
    label: str
    current_value: str
    description: str
    effect_hint: str


class AIOpsExperimentResponse(BaseModel):
    title: str
    baseline_label: str
    current_label: str
    metric: str
    baseline_value: float
    current_value: float
    change_percent: float
    verdict: str
    summary: str


class DeploymentHealthCheckResponse(BaseModel):
    name: str
    status: str
    detail: str


class DeploymentRecordResponse(BaseModel):
    deployment_id: str
    target: str
    version: str
    status: str
    operator: str
    note: str | None = None
    summary: str | None = None
    rolled_back_from: str | None = None
    linked_config_keys: list[str] = Field(default_factory=list)
    health_checks: list[DeploymentHealthCheckResponse] = Field(default_factory=list)
    created_at: str | None = None
    updated_at: str | None = None


class DeploymentListResponse(BaseModel):
    items: list[DeploymentRecordResponse] = Field(default_factory=list)
    total: int = 0


class DeploymentTriggerRequest(BaseModel):
    target: str
    version: str
    operator: str = "codex-admin"
    note: str | None = None


class DeploymentRollbackRequest(BaseModel):
    operator: str = "codex-admin"
    note: str | None = None


class AIOpsOverviewResponse(BaseModel):
    abnormal_agents: list[AgentStatusResponse] = Field(default_factory=list)
    slow_chains: list[AIOpsChainMetricResponse] = Field(default_factory=list)
    parameters: list[AIOpsParameterResponse] = Field(default_factory=list)
    experiments: list[AIOpsExperimentResponse] = Field(default_factory=list)
    latest_deployment: DeploymentRecordResponse | None = None


class AdminUserOverviewResponse(BaseModel):
    user_id: int
    course_code: str | None = None
    profile_version: int | None = None
    latest_plan_id: int | None = None
    latest_plan_status: str | None = None
    completion_rate: float = 0.0
    latest_score: float | None = None
    mastery_level: str | None = None
    open_ticket_count: int = 0
    risk_level: str = "normal"
    user_status: str = "active"
    status_reason: str | None = None
    status_updated_by: str | None = None
    status_updated_at: str | None = None
    last_activity_at: str | None = None


class AdminUserOverviewListResponse(BaseModel):
    items: list[AdminUserOverviewResponse] = Field(default_factory=list)
    total: int = 0


class AdminUserPlanProgressResponse(BaseModel):
    step_id: str
    title: str
    status: str
    started_at: str | None = None
    completed_at: str | None = None
    updated_at: str | None = None


class AdminUserTicketResponse(BaseModel):
    ticket_id: int
    session_id: int | None = None
    status: str
    question: str
    latest_reply: str | None = None
    updated_at: str | None = None


class AdminUserDetailResponse(BaseModel):
    user_id: int
    course_code: str | None = None
    profile_version: int | None = None
    risk_level: str = "normal"
    completion_rate: float = 0.0
    latest_score: float | None = None
    mastery_level: str | None = None
    user_status: str = "active"
    status_reason: str | None = None
    status_updated_by: str | None = None
    status_updated_at: str | None = None
    last_activity_at: str | None = None
    latest_plan_id: int | None = None
    latest_plan_status: str | None = None
    open_ticket_count: int = 0
    profile_snapshot: dict | None = None
    latest_plan_data: dict | None = None
    latest_evaluation_result: dict | None = None
    progress_items: list[AdminUserPlanProgressResponse] = Field(default_factory=list)
    tickets: list[AdminUserTicketResponse] = Field(default_factory=list)


class AdminUserStatusUpdateRequest(BaseModel):
    status: str
    updated_by: str = "admin"
    reason: str | None = None


class AdminUserStatusResponse(BaseModel):
    user_id: int
    status: str
    reason: str | None = None
    updated_by: str | None = None
    updated_at: str | None = None


class AdminUserStatusHistoryItem(BaseModel):
    user_id: int
    status: str
    reason: str | None = None
    updated_by: str | None = None
    created_at: str | None = None


class AdminUserStatusHistoryListResponse(BaseModel):
    items: list[AdminUserStatusHistoryItem] = Field(default_factory=list)
    total: int = 0


class AdminDashboardSummaryResponse(BaseModel):
    total_users: int = 0
    high_risk_users: int = 0
    suspended_users: int = 0
    open_ticket_count: int = 0
    pending_review_count: int = 0
    degraded_agent_count: int = 0
    sensitive_config_count: int = 0
    latest_activity_at: str | None = None
