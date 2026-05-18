from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone
import json
from pathlib import Path

from sqlalchemy.exc import SQLAlchemyError

from app.core.config import settings
from app.schemas.admin import (
    AIOpsChainMetricResponse,
    AIOpsExperimentResponse,
    AIOpsOverviewResponse,
    AIOpsParameterResponse,
    AdminDashboardSummaryResponse,
    AdminUserOverviewListResponse,
    AdminUserOverviewResponse,
    AdminUserStatusResponse,
    DeploymentListResponse,
    DeploymentRecordResponse,
    AgentRuntimeLogListResponse,
    AgentRuntimeLogResponse,
    AgentRuntimeSummaryResponse,
    AgentStatusListResponse,
    AgentStatusResponse,
    ReviewTaskListResponse,
    ReviewTaskResponse,
    ReviewTaskSummaryResponse,
    SystemConfigSummaryResponse,
)


def should_use_admin_demo_data(exc: Exception) -> bool:
    if settings.app_env != "local":
        return False
    return isinstance(exc, (SQLAlchemyError, OSError))


class AdminDemoStore:
    _SENSITIVE_CONFIG_KEYWORDS = (
        "secret",
        "token",
        "password",
        "api_key",
        "apikey",
        "access_key",
        "private_key",
        "credential",
    )
    _STATE_FILE = Path(__file__).resolve().parents[2] / ".runtime" / "admin-demo-state.json"
    _DEFAULT_USERS: list[dict] = [
        {
            "user_id": 1001,
            "course_code": "ALG-401",
            "profile_version": 4,
            "latest_plan_id": 9001,
            "latest_plan_status": "in_progress",
            "completion_rate": 82.5,
            "latest_score": 91.0,
            "mastery_level": "advanced",
            "open_ticket_count": 0,
            "risk_level": "normal",
            "user_status": "active",
            "status_reason": None,
            "status_updated_by": "admin",
            "status_updated_at": "2026-05-16T07:00:00+00:00",
            "last_activity_at": "2026-05-16T07:18:00+00:00",
        },
        {
            "user_id": 1002,
            "course_code": "ML-202",
            "profile_version": 3,
            "latest_plan_id": 9002,
            "latest_plan_status": "blocked",
            "completion_rate": 36.0,
            "latest_score": 62.5,
            "mastery_level": "basic",
            "open_ticket_count": 2,
            "risk_level": "high",
            "user_status": "suspended",
            "status_reason": "Escalated after repeated model fallback",
            "status_updated_by": "admin",
            "status_updated_at": "2026-05-16T06:40:00+00:00",
            "last_activity_at": "2026-05-16T06:35:00+00:00",
        },
        {
            "user_id": 1003,
            "course_code": "DB-105",
            "profile_version": 2,
            "latest_plan_id": 9003,
            "latest_plan_status": "in_progress",
            "completion_rate": 64.0,
            "latest_score": 78.0,
            "mastery_level": "intermediate",
            "open_ticket_count": 1,
            "risk_level": "medium",
            "user_status": "active",
            "status_reason": None,
            "status_updated_by": "admin",
            "status_updated_at": "2026-05-16T05:50:00+00:00",
            "last_activity_at": "2026-05-16T07:05:00+00:00",
        },
    ]

    _DEFAULT_REVIEWS: list[dict] = [
        {
            "review_id": 301,
            "entity_type": "resource_document",
            "entity_id": 8801,
            "source_scene": "resource_generation",
            "priority": "high",
            "status": "pending",
            "submitted_content": "Generated handout requires manual review for citation consistency.",
            "reviewer_name": None,
            "decision_note": None,
            "created_at": "2026-05-16T06:20:00+00:00",
            "updated_at": "2026-05-16T06:20:00+00:00",
        },
        {
            "review_id": 302,
            "entity_type": "profile_snapshot",
            "entity_id": 8802,
            "source_scene": "profile_agent",
            "priority": "normal",
            "status": "approved",
            "submitted_content": "Profile summary for user 1001 passed auto and manual review.",
            "reviewer_name": "adminA",
            "decision_note": "Looks good",
            "created_at": "2026-05-16T05:15:00+00:00",
            "updated_at": "2026-05-16T05:40:00+00:00",
        },
        {
            "review_id": 303,
            "entity_type": "learning_plan",
            "entity_id": 8803,
            "source_scene": "planner_agent",
            "priority": "high",
            "status": "rejected",
            "submitted_content": "Plan references a deprecated prerequisite path and needs adjustment.",
            "reviewer_name": "adminB",
            "decision_note": "Prerequisite chain is outdated",
            "created_at": "2026-05-16T04:50:00+00:00",
            "updated_at": "2026-05-16T05:05:00+00:00",
        },
    ]

    _DEFAULT_AGENT_LOGS: list[dict] = [
        {
            "log_id": 501,
            "agent_name": "profile_agent",
            "level": "info",
            "status": "ok",
            "message": "Profile sync completed for latest learner segment.",
            "payload": {"batch": "profile-nightly"},
            "created_at": "2026-05-16T07:16:00+00:00",
            "updated_at": "2026-05-16T07:16:00+00:00",
        },
        {
            "log_id": 502,
            "agent_name": "resource_agent",
            "level": "warning",
            "status": "degraded",
            "message": "Resource generation switched to cached templates because PostgreSQL is unavailable.",
            "payload": {"topic": "regression-testing"},
            "created_at": "2026-05-16T07:12:00+00:00",
            "updated_at": "2026-05-16T07:12:00+00:00",
        },
        {
            "log_id": 503,
            "agent_name": "planner_agent",
            "level": "error",
            "status": "degraded",
            "message": "Planner could not persist progress snapshot and entered retry mode.",
            "payload": {"retry_in_seconds": 30},
            "created_at": "2026-05-16T07:08:00+00:00",
            "updated_at": "2026-05-16T07:08:00+00:00",
        },
        {
            "log_id": 504,
            "agent_name": "evaluator_agent",
            "level": "info",
            "status": "ok",
            "message": "Evaluation report generation completed.",
            "payload": {"reports": 3},
            "created_at": "2026-05-16T06:58:00+00:00",
            "updated_at": "2026-05-16T06:58:00+00:00",
        },
    ]

    _DEFAULT_CONFIGS: list[dict] = [
        {"config_key": "llm.provider", "updated_at": "2026-05-16T05:00:00+00:00"},
        {"config_key": "llm.api_key", "updated_at": "2026-05-16T05:01:00+00:00"},
        {"config_key": "embedding.model", "updated_at": "2026-05-16T05:02:00+00:00"},
        {"config_key": "rag.top_k", "updated_at": "2026-05-16T05:03:00+00:00"},
        {"config_key": "agent.resource.timeout", "updated_at": "2026-05-16T05:04:00+00:00"},
    ]
    _DEFAULT_DEPLOYMENTS: list[dict] = [
        {
            "deployment_id": "deploy-20260516-01",
            "target": "ai-runtime",
            "version": "v2026.05.16-1",
            "status": "success",
            "operator": "admin-demo",
            "note": "发布新的检索与规划参数",
            "summary": "已完成热更新，未发现新的高优先级异常。",
            "rolled_back_from": None,
            "linked_config_keys": ["planner_daily_task_limit", "rag_top_k"],
            "health_checks": [
                {"name": "API 健康检查", "status": "ok", "detail": "18080 /health 返回 200"},
                {"name": "LLM 连通性", "status": "ok", "detail": "模型 ping 正常"},
                {"name": "RAG 检索抽样", "status": "warning", "detail": "P95 时延略高，但仍在阈值内"},
            ],
            "created_at": "2026-05-16T05:10:00+00:00",
            "updated_at": "2026-05-16T05:18:00+00:00",
        }
    ]

    @classmethod
    def get_dashboard_summary(cls) -> AdminDashboardSummaryResponse:
        state = cls._load_state()
        users = cls._user_items()
        reviews = cls._review_items()
        latest_activity_at = max(
            [
                *(item.last_activity_at for item in users if item.last_activity_at),
                *(item.updated_at for item in reviews if item.updated_at),
                *(item.updated_at for item in cls._agent_log_items() if item.updated_at),
                *(item["updated_at"] for item in state["configs"] if item.get("updated_at")),
            ],
            default=None,
        )
        return AdminDashboardSummaryResponse(
            total_users=len(users),
            high_risk_users=sum(1 for item in users if item.risk_level == "high"),
            suspended_users=sum(1 for item in users if item.user_status == "suspended"),
            open_ticket_count=sum(item.open_ticket_count for item in users),
            pending_review_count=sum(1 for item in reviews if item.status == "pending"),
            degraded_agent_count=cls.get_agent_runtime_summary().degraded_agent_count,
            sensitive_config_count=sum(
                1 for item in state["configs"] if cls._is_sensitive_config_key(item["config_key"])
            ),
            latest_activity_at=latest_activity_at,
        )

    @classmethod
    def list_users(
        cls,
        *,
        risk_level: str | None = None,
        course_code: str | None = None,
        user_status: str | None = None,
    ) -> AdminUserOverviewListResponse:
        items = cls._user_items()
        if risk_level:
            items = [item for item in items if item.risk_level == risk_level]
        if course_code:
            items = [item for item in items if item.course_code == course_code]
        if user_status:
            items = [item for item in items if item.user_status == user_status]
        return AdminUserOverviewListResponse(items=items, total=len(items))

    @classmethod
    def update_user_status(cls, user_id: int, *, status: str, reason: str | None, updated_by: str) -> AdminUserStatusResponse:
        state = cls._load_state()
        for item in state["users"]:
            if item["user_id"] != user_id:
                continue
            item["user_status"] = status
            item["status_reason"] = reason
            item["status_updated_by"] = updated_by
            item["status_updated_at"] = cls._now()
            item["risk_level"] = cls._recompute_risk(item)
            cls._save_state(state)
            return AdminUserStatusResponse(
                user_id=user_id,
                status=status,
                reason=reason,
                updated_by=updated_by,
                updated_at=item["status_updated_at"],
            )
        raise ValueError(f"user {user_id} not found in demo store")

    @classmethod
    def list_reviews(cls, *, status: str | None = None) -> ReviewTaskListResponse:
        items = cls._review_items()
        if status:
            items = [item for item in items if item.status == status]
        return ReviewTaskListResponse(items=items, total=len(items))

    @classmethod
    def update_review(cls, review_id: int, *, status: str, reviewer_name: str, decision_note: str | None) -> ReviewTaskResponse:
        state = cls._load_state()
        for item in state["reviews"]:
            if item["review_id"] != review_id:
                continue
            item["status"] = status
            item["reviewer_name"] = reviewer_name
            item["decision_note"] = decision_note
            item["updated_at"] = cls._now()
            cls._save_state(state)
            return ReviewTaskResponse(**deepcopy(item))
        raise ValueError(f"review {review_id} not found in demo store")

    @classmethod
    def get_review_summary(cls) -> ReviewTaskSummaryResponse:
        items = cls._review_items()
        by_status: dict[str, int] = {}
        by_priority: dict[str, int] = {}
        by_source_scene: dict[str, int] = {}
        for item in items:
            by_status[item.status] = by_status.get(item.status, 0) + 1
            by_priority[item.priority] = by_priority.get(item.priority, 0) + 1
            by_source_scene[item.source_scene] = by_source_scene.get(item.source_scene, 0) + 1
        return ReviewTaskSummaryResponse(
            total=len(items),
            pending_count=by_status.get("pending", 0),
            by_status=by_status,
            by_priority=by_priority,
            by_source_scene=by_source_scene,
            latest_review_at=max((item.updated_at for item in items if item.updated_at), default=None),
        )

    @classmethod
    def list_agent_status(cls) -> AgentStatusListResponse:
        grouped: dict[str, AgentStatusResponse] = {}
        for item in cls._agent_log_items():
            existing = grouped.get(item.agent_name)
            if existing is None:
                grouped[item.agent_name] = AgentStatusResponse(
                    agent_name=item.agent_name,
                    latest_status=item.status,
                    latest_message=item.message,
                    error_count=1 if item.level == "error" else 0,
                    updated_at=item.updated_at,
                )
                continue
            if item.level == "error":
                existing.error_count += 1
        items = list(grouped.values())
        return AgentStatusListResponse(items=items, total=len(items))

    @classmethod
    def list_agent_logs(cls) -> AgentRuntimeLogListResponse:
        items = cls._agent_log_items()
        return AgentRuntimeLogListResponse(items=items, total=len(items))

    @classmethod
    def get_agent_runtime_summary(cls) -> AgentRuntimeSummaryResponse:
        items = cls._agent_log_items()
        by_agent: dict[str, int] = {}
        by_level: dict[str, int] = {}
        latest_by_agent: dict[str, str] = {}
        for item in items:
            by_agent[item.agent_name] = by_agent.get(item.agent_name, 0) + 1
            by_level[item.level] = by_level.get(item.level, 0) + 1
            latest_by_agent.setdefault(item.agent_name, item.status)
        return AgentRuntimeSummaryResponse(
            total=len(items),
            error_count=by_level.get("error", 0),
            degraded_agent_count=sum(1 for status in latest_by_agent.values() if status != "ok"),
            by_agent=by_agent,
            by_level=by_level,
            latest_log_at=max((item.created_at for item in items if item.created_at), default=None),
        )

    @classmethod
    def get_config_summary(cls) -> SystemConfigSummaryResponse:
        state = cls._load_state()
        by_prefix: dict[str, int] = {}
        sensitive_count = 0
        latest_updated_at = None
        for item in state["configs"]:
            prefix = item["config_key"].split(".", 1)[0]
            by_prefix[prefix] = by_prefix.get(prefix, 0) + 1
            if cls._is_sensitive_config_key(item["config_key"]):
                sensitive_count += 1
            updated_at = item.get("updated_at")
            if updated_at and (latest_updated_at is None or updated_at > latest_updated_at):
                latest_updated_at = updated_at
        return SystemConfigSummaryResponse(
            total=len(state["configs"]),
            sensitive_count=sensitive_count,
            by_prefix=by_prefix,
            latest_updated_at=latest_updated_at,
        )

    @classmethod
    def get_aiops_overview(cls) -> AIOpsOverviewResponse:
        state = cls._load_state()
        abnormal_agents = [
            item for item in cls.list_agent_status().items if item.latest_status not in {"ok", "active"}
        ]
        config_map = {item["config_key"]: item for item in state["configs"]}
        rag_value = str(config_map.get("rag_top_k", {}).get("config_value", "8"))
        planner_value = str(config_map.get("planner_daily_task_limit", {}).get("config_value", "5"))

        slow_chains = [
            AIOpsChainMetricResponse(
                chain_id="retrieval-answer",
                label="检索问答链路",
                status="warning" if int(rag_value or "8") > 7 else "ok",
                avg_latency_ms=1280 if int(rag_value or "8") > 7 else 960,
                p95_latency_ms=2140 if int(rag_value or "8") > 7 else 1680,
                error_rate=0.8,
                related_agents=["question_analyzer_agent", "retriever_agent", "answer_generator_agent"],
            ),
            AIOpsChainMetricResponse(
                chain_id="planner-evaluator",
                label="规划评测链路",
                status="warning",
                avg_latency_ms=1720,
                p95_latency_ms=2860,
                error_rate=1.2,
                related_agents=["planner_agent", "path_planner_agent", "evaluator_agent"],
            ),
        ]

        parameters = [
            AIOpsParameterResponse(
                key="planner_daily_task_limit",
                label="每日任务拆分上限",
                current_value=planner_value,
                description="控制学习规划器一天最多拆出多少个任务。",
                effect_hint="值越大，任务更细更多；值越小，任务更少更粗。",
            ),
            AIOpsParameterResponse(
                key="rag_top_k",
                label="知识检索候选数",
                current_value=rag_value,
                description="控制 RAG 检索时最多给模型多少个候选知识片段。",
                effect_hint="值越大，召回更多但噪声更高；值越小，更聚焦但可能漏信息。",
            ),
        ]

        experiments = [
            AIOpsExperimentResponse(
                title="检索参数调整效果",
                baseline_label="上周默认值",
                current_label=f"当前 top_k={rag_value}",
                metric="答案命中率",
                baseline_value=71.0,
                current_value=77.4,
                change_percent=6.4,
                verdict="improved",
                summary="检索候选数调到当前值后，答案引用命中率提升，但高峰时延也略有上升。",
            ),
            AIOpsExperimentResponse(
                title="规划参数调整效果",
                baseline_label="旧版任务拆分",
                current_label=f"当前 daily_task_limit={planner_value}",
                metric="任务完成率",
                baseline_value=63.5,
                current_value=67.6,
                change_percent=4.1,
                verdict="improved",
                summary="任务拆分更细后，学习者当天完成率更高，但规划链路耗时变长。",
            ),
        ]

        deployments = [
            DeploymentRecordResponse(**deepcopy(item))
            for item in sorted(state.get("deployments", []), key=lambda item: item.get("created_at", ""), reverse=True)
        ]

        return AIOpsOverviewResponse(
            abnormal_agents=abnormal_agents,
            slow_chains=slow_chains,
            parameters=parameters,
            experiments=experiments,
            latest_deployment=deployments[0] if deployments else None,
        )

    @classmethod
    def list_deployments(cls) -> DeploymentListResponse:
        state = cls._load_state()
        items = [
            DeploymentRecordResponse(**deepcopy(item))
            for item in sorted(state.get("deployments", []), key=lambda item: item.get("created_at", ""), reverse=True)
        ]
        return DeploymentListResponse(items=items, total=len(items))

    @classmethod
    def trigger_deployment(cls, *, target: str, version: str, operator: str, note: str | None = None) -> DeploymentRecordResponse:
        state = cls._load_state()
        now = cls._now()
        record = {
            "deployment_id": f"deploy-{now.replace(':', '').replace('-', '').replace('+00:00', '').replace('T', '-')}",
            "target": target,
            "version": version,
            "status": "success",
            "operator": operator,
            "note": note,
            "summary": f"{target} 已部署到 {version}，当前健康检查通过。",
            "rolled_back_from": None,
            "linked_config_keys": ["planner_daily_task_limit", "rag_top_k"],
            "health_checks": [
                {"name": "API 健康检查", "status": "ok", "detail": "主服务已重新加载并可访问"},
                {"name": "Agent 运行时", "status": "ok", "detail": "关键智能体状态已恢复上报"},
                {"name": "配置同步检查", "status": "ok", "detail": "最新参数已同步到运行时"},
            ],
            "created_at": now,
            "updated_at": now,
        }
        state.setdefault("deployments", []).append(record)
        state.setdefault("agent_logs", []).insert(
            0,
            {
                "log_id": max((item["log_id"] for item in state["agent_logs"]), default=500) + 1,
                "agent_name": "deployment_controller",
                "level": "info",
                "status": "ok",
                "message": f"Deployment finished for {target} at {version}.",
                "payload": {"target": target, "version": version, "operator": operator},
                "created_at": now,
                "updated_at": now,
            },
        )
        cls._save_state(state)
        return DeploymentRecordResponse(**record)

    @classmethod
    def rollback_deployment(cls, deployment_id: str, *, operator: str, note: str | None = None) -> DeploymentRecordResponse:
        state = cls._load_state()
        deployments = state.get("deployments", [])
        source = next((item for item in deployments if item["deployment_id"] == deployment_id), None)
        if source is None:
            raise ValueError(f"deployment {deployment_id} not found")

        now = cls._now()
        rollback_record = {
            "deployment_id": f"rollback-{now.replace(':', '').replace('-', '').replace('+00:00', '').replace('T', '-')}",
            "target": source["target"],
            "version": f"{source['version']}-rollback",
            "status": "success",
            "operator": operator,
            "note": note or f"回滚 {source['version']}",
            "summary": f"已从 {source['version']} 回滚到上一稳定版本。",
            "rolled_back_from": source["version"],
            "linked_config_keys": deepcopy(source.get("linked_config_keys", ["planner_daily_task_limit", "rag_top_k"])),
            "health_checks": [
                {"name": "回滚后 API 检查", "status": "ok", "detail": "核心接口恢复正常"},
                {"name": "回滚后链路检查", "status": "ok", "detail": "规划评测链路时延回落"},
                {"name": "回滚后告警检查", "status": "ok", "detail": "未发现新的高优先级异常"},
            ],
            "created_at": now,
            "updated_at": now,
        }
        deployments.append(rollback_record)
        state.setdefault("agent_logs", []).insert(
            0,
            {
                "log_id": max((item["log_id"] for item in state["agent_logs"]), default=500) + 1,
                "agent_name": "deployment_controller",
                "level": "warning",
                "status": "ok",
                "message": f"Rollback finished for {source['target']} from {source['version']}.",
                "payload": {"deployment_id": deployment_id, "operator": operator},
                "created_at": now,
                "updated_at": now,
            },
        )
        cls._save_state(state)
        return DeploymentRecordResponse(**rollback_record)

    @classmethod
    def _user_items(cls) -> list[AdminUserOverviewResponse]:
        state = cls._load_state()
        return [AdminUserOverviewResponse(**deepcopy(item)) for item in state["users"]]

    @classmethod
    def _review_items(cls) -> list[ReviewTaskResponse]:
        state = cls._load_state()
        return [ReviewTaskResponse(**deepcopy(item)) for item in state["reviews"]]

    @classmethod
    def _agent_log_items(cls) -> list[AgentRuntimeLogResponse]:
        state = cls._load_state()
        items = [AgentRuntimeLogResponse(**deepcopy(item)) for item in state["agent_logs"]]
        return sorted(items, key=lambda item: item.created_at or "", reverse=True)

    @staticmethod
    def _recompute_risk(item: dict) -> str:
        if item.get("user_status") == "suspended":
            return "high"
        completion_rate = float(item.get("completion_rate") or 0.0)
        open_ticket_count = int(item.get("open_ticket_count") or 0)
        if open_ticket_count >= 2 or completion_rate < 40:
            return "high"
        if open_ticket_count >= 1 or completion_rate < 70:
            return "medium"
        return "normal"

    @staticmethod
    def _now() -> str:
        return datetime.now(timezone.utc).isoformat()

    @classmethod
    def _is_sensitive_config_key(cls, config_key: str | None) -> bool:
        normalized_key = (config_key or "").lower()
        return any(keyword in normalized_key for keyword in cls._SENSITIVE_CONFIG_KEYWORDS)

    @classmethod
    def _load_state(cls) -> dict:
        cls._STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
        if not cls._STATE_FILE.exists():
            state = cls._default_state()
            cls._save_state(state)
            return state
        state = json.loads(cls._STATE_FILE.read_text(encoding="utf-8"))
        state.setdefault("deployments", deepcopy(cls._DEFAULT_DEPLOYMENTS))
        if not any(item.get("status") == "failed" for item in state["deployments"]):
            state["deployments"].append(
                {
                    "deployment_id": "deploy-20260515-rollback-risk",
                    "target": "ai-runtime",
                    "version": "v2026.05.15-hotfix",
                    "status": "failed",
                    "operator": "admin-demo",
                    "note": "演示失败部署告警",
                    "summary": "该版本发布后检索时延和评测错误率异常升高，已阻断继续放量。",
                    "rolled_back_from": None,
                    "linked_config_keys": ["rag_top_k"],
                    "health_checks": [
                        {"name": "API 健康检查", "status": "ok", "detail": "基础接口可访问"},
                        {"name": "RAG 检索抽样", "status": "failed", "detail": "P95 时延超出阈值 38%"},
                        {"name": "评测链路检查", "status": "failed", "detail": "评测错误率超过告警线"},
                    ],
                    "created_at": "2026-05-15T09:20:00+00:00",
                    "updated_at": "2026-05-15T09:26:00+00:00",
                }
            )
        for item in state["deployments"]:
            item.setdefault("rolled_back_from", None)
            item.setdefault("linked_config_keys", ["planner_daily_task_limit", "rag_top_k"])
            item.setdefault("health_checks", [])
        return state

    @classmethod
    def _save_state(cls, state: dict) -> None:
        cls._STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
        cls._STATE_FILE.write_text(json.dumps(state, ensure_ascii=True, indent=2), encoding="utf-8")

    @classmethod
    def _default_state(cls) -> dict:
        return {
            "users": deepcopy(cls._DEFAULT_USERS),
            "reviews": deepcopy(cls._DEFAULT_REVIEWS),
            "agent_logs": deepcopy(cls._DEFAULT_AGENT_LOGS),
            "configs": deepcopy(cls._DEFAULT_CONFIGS),
            "deployments": deepcopy(cls._DEFAULT_DEPLOYMENTS),
        }
