export class ApiError extends Error {
  status: number;
  detail: string;

  constructor(message: string, status = 500, detail = "") {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

export function describeError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.detail.includes("ConnectionRefusedError")) {
      return "后端服务已连通，但数据库连接被拒绝。请先启动数据库或检查 a3-ai-python 的连接配置。";
    }

    return error.detail || error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "发生未知错误";
}

export interface DashboardSummary {
  total_users: number;
  high_risk_users: number;
  suspended_users: number;
  open_ticket_count: number;
  pending_review_count: number;
  degraded_agent_count: number;
  sensitive_config_count: number;
  latest_activity_at: string | null;
}

export interface AdminUserOverview {
  user_id: number;
  course_code: string | null;
  profile_version: number | null;
  latest_plan_id: number | null;
  latest_plan_status: string | null;
  completion_rate: number;
  latest_score: number | null;
  mastery_level: string | null;
  open_ticket_count: number;
  risk_level: string;
  user_status: string;
  status_reason: string | null;
  status_updated_by: string | null;
  status_updated_at: string | null;
  last_activity_at: string | null;
}

export interface ReviewTask {
  review_id: number;
  entity_type: string;
  entity_id: number;
  source_scene: string;
  priority: string;
  status: string;
  submitted_content: string;
  reviewer_name: string | null;
  decision_note: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface ReviewTaskSummary {
  total: number;
  pending_count: number;
  by_status: Record<string, number>;
  by_priority: Record<string, number>;
  by_source_scene: Record<string, number>;
  latest_review_at: string | null;
}

export interface AdminNotificationItem {
  notification_id: string;
  category: string;
  title: string;
  detail: string;
  tone: string;
  target_view: string | null;
  target_label: string | null;
  status: string;
  unread: boolean;
  count: number;
  fingerprint: string;
  generated_at: string | null;
  updated_at: string | null;
  updated_by: string | null;
}

export interface AdminNotificationList {
  items: AdminNotificationItem[];
  total: number;
  unread_count: number;
  open_count: number;
  resolved_count: number;
}

export interface AdminSessionEnvironment {
  environment_id: string;
  label: string;
  description: string;
  app_env: string;
  llm_mode: string;
  embedding_mode: string;
  risk_level: string;
  config_profile: Record<string, string>;
  is_active: boolean;
}

export interface AdminSessionHistoryItem {
  action: string;
  actor: string;
  environment_id: string | null;
  created_at: string | null;
  detail: string | null;
}

export interface AdminSession {
  username: string;
  display_name: string;
  role: string;
  active_environment_id: string;
  active_environment_label: string;
  login_state: string;
  logged_in_at: string | null;
  last_seen_at: string | null;
}

export interface AdminSessionState {
  session: AdminSession | null;
  environments: AdminSessionEnvironment[];
  history: AdminSessionHistoryItem[];
}

export interface ReviewTaskDraft {
  entity_type: string;
  entity_id: number;
  submitted_content: string;
  source_scene?: string;
  priority?: string;
}

export interface AuditLogItem {
  log_id: number;
  trace_id: string | null;
  scene: string;
  action: string;
  payload: Record<string, unknown> | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface AuditLogSummary {
  total: number;
  by_scene: Record<string, number>;
  by_action: Record<string, number>;
  latest_log_at: string | null;
}

export interface AgentStatusItem {
  agent_name: string;
  latest_status: string;
  latest_message: string | null;
  error_count: number;
  updated_at: string | null;
  display_name?: string | null;
  category?: string | null;
  source_path?: string | null;
  status_source?: string | null;
}

export interface AgentRuntimeLog {
  log_id: number;
  agent_name: string;
  level: string;
  status: string;
  message: string;
  payload: Record<string, unknown> | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface AgentRuntimeSummary {
  total: number;
  error_count: number;
  degraded_agent_count: number;
  by_agent: Record<string, number>;
  by_level: Record<string, number>;
  latest_log_at: string | null;
}

export interface AIOpsChainMetric {
  chain_id: string;
  label: string;
  status: string;
  avg_latency_ms: number;
  p95_latency_ms: number;
  error_rate: number;
  related_agents: string[];
}

export interface AIOpsParameter {
  key: string;
  label: string;
  current_value: string;
  description: string;
  effect_hint: string;
}

export interface AIOpsExperiment {
  title: string;
  baseline_label: string;
  current_label: string;
  metric: string;
  baseline_value: number;
  current_value: number;
  change_percent: number;
  verdict: string;
  summary: string;
}

export interface DeploymentHealthCheck {
  name: string;
  status: string;
  detail: string;
}

export interface DeploymentRecord {
  deployment_id: string;
  target: string;
  version: string;
  status: string;
  operator: string;
  note: string | null;
  summary: string | null;
  rolled_back_from: string | null;
  health_checks: DeploymentHealthCheck[];
  created_at: string | null;
  updated_at: string | null;
}

export interface AIOpsOverview {
  abnormal_agents: AgentStatusItem[];
  slow_chains: AIOpsChainMetric[];
  parameters: AIOpsParameter[];
  experiments: AIOpsExperiment[];
  latest_deployment: DeploymentRecord | null;
}

export interface SystemConfigSummary {
  total: number;
  sensitive_count: number;
  by_prefix: Record<string, number>;
  latest_updated_at: string | null;
}

export interface SystemConfigItem {
  config_key: string;
  config_value: string;
  is_sensitive: boolean;
  description: string | null;
  updated_by: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface SystemConfigHistorySummary {
  total: number;
  by_config_key: Record<string, number>;
  by_updated_by: Record<string, number>;
  latest_created_at: string | null;
}

export interface SystemConfigHistoryItem {
  config_key: string;
  updated_by: string | null;
  value: string | null;
  is_sensitive: boolean;
  action: string;
  payload: Record<string, unknown> | null;
  created_at: string | null;
}

export interface AdminUserStatusHistoryItem {
  user_id: number;
  status: string;
  reason: string | null;
  updated_by: string | null;
  created_at: string | null;
}

export interface HealthPayload {
  status: string;
  service?: string;
  provider?: string;
  model?: string;
  message?: string;
}

interface ListResponse<T> {
  items: T[];
  total: number;
}

const GET_RESPONSE_TTL_MS = 1000;
const inflightGetRequests = new Map<string, Promise<unknown>>();
const recentGetResponses = new Map<string, { expiresAt: number; value: unknown }>();
let currentAdminActor = "codex-admin";

export function setAdminActor(actor: string | null | undefined) {
  currentAdminActor = actor?.trim() || "codex-admin";
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const method = (init?.method ?? "GET").toUpperCase();
  const cacheKey = `${method}:${path}`;

  const run = async () => {
    const response = await fetch(path, {
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
      ...init,
    });

    const text = await response.text();
    const data = text ? JSON.parse(text) : null;

    if (!response.ok) {
      const detail =
        typeof data?.detail === "string"
          ? data.detail
          : typeof data?.message === "string"
            ? data.message
            : text;
      throw new ApiError(`Request failed: ${path}`, response.status, detail);
    }

    return data as T;
  };

  if (method !== "GET") {
    const value = await run();
    recentGetResponses.clear();
    inflightGetRequests.clear();
    return value;
  }

  const cached = recentGetResponses.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value as T;
  }

  const existing = inflightGetRequests.get(cacheKey);
  if (existing) {
    return existing as Promise<T>;
  }

  const promise = run()
    .then((value) => {
      recentGetResponses.set(cacheKey, {
        expiresAt: Date.now() + GET_RESPONSE_TTL_MS,
        value,
      });
      return value;
    })
    .finally(() => {
      inflightGetRequests.delete(cacheKey);
    });
  inflightGetRequests.set(cacheKey, promise);
  return promise;
}

export function getHealth() {
  return requestJson<HealthPayload>("/health");
}

export function getAdminPing() {
  return requestJson<HealthPayload>("/api/v1/admin/ping");
}

export function getAdminSessionState() {
  return requestJson<AdminSessionState>("/api/v1/admin/session");
}

export function loginAdminSession(username: string, password: string, environmentId: string) {
  return requestJson<AdminSessionState>("/api/v1/admin/session/login", {
    method: "POST",
    body: JSON.stringify({
      username,
      password,
      environment_id: environmentId,
    }),
  });
}

export function logoutAdminSession() {
  return requestJson<AdminSessionState>("/api/v1/admin/session/logout", {
    method: "POST",
  });
}

export function switchAdminEnvironment(environmentId: string) {
  return requestJson<AdminSessionState>("/api/v1/admin/session/environment", {
    method: "POST",
    body: JSON.stringify({
      environment_id: environmentId,
    }),
  });
}

export function getNotifications() {
  return requestJson<AdminNotificationList>("/api/v1/admin/notifications");
}

export function markNotificationRead(notificationId: string, updatedBy?: string) {
  return requestJson<AdminNotificationItem>(`/api/v1/admin/notifications/${encodeURIComponent(notificationId)}/read`, {
    method: "POST",
    body: JSON.stringify({ updated_by: updatedBy || currentAdminActor }),
  });
}

export function resolveNotification(notificationId: string, updatedBy?: string) {
  return requestJson<AdminNotificationItem>(`/api/v1/admin/notifications/${encodeURIComponent(notificationId)}/resolve`, {
    method: "POST",
    body: JSON.stringify({ updated_by: updatedBy || currentAdminActor }),
  });
}

export function reopenNotification(notificationId: string, updatedBy?: string) {
  return requestJson<AdminNotificationItem>(`/api/v1/admin/notifications/${encodeURIComponent(notificationId)}/reopen`, {
    method: "POST",
    body: JSON.stringify({ updated_by: updatedBy || currentAdminActor }),
  });
}

export function getLlmPing() {
  return requestJson<HealthPayload>("/api/v1/admin/llm/ping");
}

export function getEmbeddingPing() {
  return requestJson<HealthPayload>("/api/v1/admin/embedding/ping");
}

export function getDashboardSummary() {
  return requestJson<DashboardSummary>("/api/v1/admin/dashboard/summary");
}

export async function getUsers() {
  const response = await requestJson<ListResponse<AdminUserOverview>>("/api/v1/admin/users");
  return response.items;
}

export function updateUserStatus(userId: number, status: string, reason?: string) {
  return requestJson(`/api/v1/admin/users/${userId}/status`, {
    method: "PUT",
    body: JSON.stringify({
      status,
      updated_by: currentAdminActor,
      reason: reason ?? null,
    }),
  });
}

export async function getReviews(status?: string) {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  const response = await requestJson<ListResponse<ReviewTask>>(`/api/v1/admin/reviews${query}`);
  return response.items;
}

export function getReviewSummary() {
  return requestJson<ReviewTaskSummary>("/api/v1/admin/reviews/summary");
}

export function approveReview(reviewId: number, decisionNote?: string) {
  return requestJson<ReviewTask>(`/api/v1/admin/reviews/${reviewId}/approve`, {
    method: "POST",
    body: JSON.stringify({
      reviewer_name: currentAdminActor,
      decision_note: decisionNote ?? "Approved in admin console",
    }),
  });
}

export function rejectReview(reviewId: number, decisionNote?: string) {
  return requestJson<ReviewTask>(`/api/v1/admin/reviews/${reviewId}/reject`, {
    method: "POST",
    body: JSON.stringify({
      reviewer_name: currentAdminActor,
      decision_note: decisionNote ?? "Rejected in admin console",
    }),
  });
}

export function createReviewTask(input: ReviewTaskDraft) {
  return requestJson<ReviewTask>("/api/v1/admin/reviews", {
    method: "POST",
    body: JSON.stringify({
      source_scene: "manual_submit",
      priority: "normal",
      ...input,
    }),
  });
}

export function ingestKnowledge(courseCode: string) {
  return requestJson<Record<string, unknown>>(`/api/v1/admin/knowledge/${encodeURIComponent(courseCode)}/ingest`, {
    method: "POST",
  });
}

export async function getAuditLogs(scene?: string, action?: string) {
  const params = new URLSearchParams();
  if (scene) {
    params.set("scene", scene);
  }
  if (action) {
    params.set("action", action);
  }
  const query = params.toString();
  const response = await requestJson<ListResponse<AuditLogItem>>(`/api/v1/admin/logs${query ? `?${query}` : ""}`);
  return response.items;
}

export function getAuditLogSummary(scene?: string, action?: string) {
  const params = new URLSearchParams();
  if (scene) {
    params.set("scene", scene);
  }
  if (action) {
    params.set("action", action);
  }
  const query = params.toString();
  return requestJson<AuditLogSummary>(`/api/v1/admin/logs/summary${query ? `?${query}` : ""}`);
}

export async function getAgentStatus() {
  const response = await requestJson<ListResponse<AgentStatusItem>>("/api/v1/admin/agents/status");
  return response.items;
}

export async function getAgentLogs(agentName?: string, level?: string) {
  const params = new URLSearchParams();
  if (agentName) {
    params.set("agent_name", agentName);
  }
  if (level) {
    params.set("level", level);
  }
  const query = params.toString();
  const response = await requestJson<ListResponse<AgentRuntimeLog>>(`/api/v1/admin/agents/logs${query ? `?${query}` : ""}`);
  return response.items;
}

export function getAgentRuntimeSummary(agentName?: string, level?: string) {
  const params = new URLSearchParams();
  if (agentName) {
    params.set("agent_name", agentName);
  }
  if (level) {
    params.set("level", level);
  }
  const query = params.toString();
  return requestJson<AgentRuntimeSummary>(`/api/v1/admin/agents/logs/summary${query ? `?${query}` : ""}`);
}

export function getAIOpsOverview() {
  return requestJson<AIOpsOverview>("/api/v1/admin/aiops/overview");
}

export async function getDeployments() {
  const response = await requestJson<ListResponse<DeploymentRecord>>("/api/v1/admin/deployments");
  return response.items;
}

export function triggerDeployment(target: string, version: string, note?: string, operator?: string) {
  return requestJson<DeploymentRecord>("/api/v1/admin/deployments", {
    method: "POST",
    body: JSON.stringify({
      target,
      version,
      note: note ?? null,
      operator: operator || currentAdminActor,
    }),
  });
}

export function rollbackDeployment(deploymentId: string, note?: string, operator?: string) {
  return requestJson<DeploymentRecord>(`/api/v1/admin/deployments/${encodeURIComponent(deploymentId)}/rollback`, {
    method: "POST",
    body: JSON.stringify({
      note: note ?? null,
      operator: operator || currentAdminActor,
    }),
  });
}

export function getConfigSummary() {
  return requestJson<SystemConfigSummary>("/api/v1/admin/configs/summary");
}

export async function getSystemConfigs(sensitiveOnly = false) {
  const query = sensitiveOnly ? "?sensitive_only=true" : "";
  const response = await requestJson<ListResponse<SystemConfigItem>>(`/api/v1/admin/configs${query}`);
  return response.items;
}

export function updateSystemConfig(configKey: string, value: string, description?: string | null, updatedBy?: string) {
  return requestJson<SystemConfigItem>(`/api/v1/admin/configs/${encodeURIComponent(configKey)}`, {
    method: "PUT",
    body: JSON.stringify({
      value,
      description: description ?? null,
      updated_by: updatedBy || currentAdminActor,
    }),
  });
}

export function getConfigHistorySummary(configKey?: string, updatedBy?: string) {
  const params = new URLSearchParams();
  if (configKey) {
    params.set("config_key", configKey);
  }
  if (updatedBy) {
    params.set("updated_by", updatedBy);
  }
  const query = params.toString();
  return requestJson<SystemConfigHistorySummary>(`/api/v1/admin/configs/history/summary${query ? `?${query}` : ""}`);
}

export async function getSystemConfigHistory(configKey?: string, updatedBy?: string) {
  const params = new URLSearchParams();
  if (configKey) {
    params.set("config_key", configKey);
  }
  if (updatedBy) {
    params.set("updated_by", updatedBy);
  }
  const query = params.toString();
  const response = await requestJson<ListResponse<SystemConfigHistoryItem>>(`/api/v1/admin/configs/history${query ? `?${query}` : ""}`);
  return response.items;
}

export async function getUserStatusHistory(userId?: number, status?: string, updatedBy?: string) {
  const params = new URLSearchParams();
  if (userId !== undefined) {
    params.set("user_id", String(userId));
  }
  if (status) {
    params.set("status", status);
  }
  if (updatedBy) {
    params.set("updated_by", updatedBy);
  }
  const query = params.toString();
  const response = await requestJson<ListResponse<AdminUserStatusHistoryItem>>(
    `/api/v1/admin/users/status-history${query ? `?${query}` : ""}`,
  );
  return response.items;
}
