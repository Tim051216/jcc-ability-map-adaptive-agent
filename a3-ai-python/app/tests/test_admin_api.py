from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

from app.api.v1 import admin
from app.services.admin_dashboard_service import AdminDashboardService
from app.services.agent_runtime_summary_service import AgentRuntimeSummaryService
from app.services.admin_service import AdminService
from app.services.admin_user_status_history_service import AdminUserStatusHistoryService
from app.services.audit_log_summary_service import AuditLogSummaryService
from app.services.llm_health_service import LLMHealthService
from app.services.review_task_summary_service import ReviewTaskSummaryService
from app.services.system_config_summary_service import SystemConfigSummaryService
from app.services.system_config_history_summary_service import SystemConfigHistorySummaryService


app = FastAPI()
app.include_router(admin.router, prefix="/api/v1/admin")
client = TestClient(app)


def test_approve_review_tasks_endpoint_returns_batch_result(monkeypatch) -> None:
    async def fake_approve_review_tasks(self, request):
        assert request.review_ids == [101, 102]
        assert request.reviewer_name == "adminA"
        assert request.decision_note == "batch approved"
        return {
            "items": [
                {
                    "review_id": 101,
                    "entity_type": "resource",
                    "entity_id": 55,
                    "source_scene": "manual_submit",
                    "priority": "high",
                    "status": "approved",
                    "submitted_content": "resource A",
                    "reviewer_name": "adminA",
                    "decision_note": "batch approved",
                    "created_at": "2026-05-09T12:00:00+00:00",
                    "updated_at": "2026-05-09T12:05:00+00:00",
                }
            ],
            "total": 1,
        }

    monkeypatch.setattr(AdminService, "approve_review_tasks", fake_approve_review_tasks)

    response = client.post(
        "/api/v1/admin/reviews/batch/approve",
        json={
            "review_ids": [101, 102],
            "reviewer_name": "adminA",
            "decision_note": "batch approved",
        },
    )

    assert response.status_code == 200
    assert response.json()["total"] == 1
    assert response.json()["items"][0]["status"] == "approved"


def test_get_admin_dashboard_summary_returns_payload(monkeypatch) -> None:
    async def fake_get_summary(self):
        return {
            "total_users": 12,
            "high_risk_users": 3,
            "suspended_users": 1,
            "open_ticket_count": 5,
            "pending_review_count": 4,
            "degraded_agent_count": 1,
            "sensitive_config_count": 2,
            "latest_activity_at": "2026-05-09T20:15:00+00:00",
        }

    monkeypatch.setattr(AdminDashboardService, "get_summary", fake_get_summary)

    response = client.get("/api/v1/admin/dashboard/summary")

    assert response.status_code == 200
    assert response.json()["high_risk_users"] == 3


def test_ping_llm_endpoint_returns_health_payload(monkeypatch) -> None:
    async def fake_ping(self):
        return {
            "status": "not_configured",
            "provider": "openai_compat",
            "model": "gpt-test",
            "message": "未配置可用的 LLM 连接信息。",
        }

    monkeypatch.setattr(LLMHealthService, "ping", fake_ping)

    response = client.get("/api/v1/admin/llm/ping")

    assert response.status_code == 200
    assert response.json()["status"] == "not_configured"
    assert response.json()["provider"] == "openai_compat"


def test_reject_review_tasks_endpoint_returns_batch_result(monkeypatch) -> None:
    async def fake_reject_review_tasks(self, request):
        assert request.review_ids == [201]
        assert request.reviewer_name == "adminB"
        assert request.decision_note == "need revise"
        return {
            "items": [
                {
                    "review_id": 201,
                    "entity_type": "plan",
                    "entity_id": 88,
                    "source_scene": "system_scan",
                    "priority": "normal",
                    "status": "rejected",
                    "submitted_content": "plan content",
                    "reviewer_name": "adminB",
                    "decision_note": "need revise",
                    "created_at": "2026-05-09T12:00:00+00:00",
                    "updated_at": "2026-05-09T12:08:00+00:00",
                }
            ],
            "total": 1,
        }

    monkeypatch.setattr(AdminService, "reject_review_tasks", fake_reject_review_tasks)

    response = client.post(
        "/api/v1/admin/reviews/batch/reject",
        json={
            "review_ids": [201],
            "reviewer_name": "adminB",
            "decision_note": "need revise",
        },
    )

    assert response.status_code == 200
    assert response.json()["items"][0]["status"] == "rejected"
    assert response.json()["items"][0]["reviewer_name"] == "adminB"


def test_list_review_tasks_endpoint_passes_query_filters(monkeypatch) -> None:
    async def fake_list_review_tasks(
        self,
        *,
        status=None,
        entity_type=None,
        priority=None,
        source_scene=None,
        reviewer_name=None,
        keyword=None,
    ):
        assert status == "pending"
        assert entity_type == "resource"
        assert priority == "high"
        assert source_scene == "manual_submit"
        assert reviewer_name == "adminA"
        assert keyword == "algebra"
        return {
            "items": [
                {
                    "review_id": 101,
                    "entity_type": "resource",
                    "entity_id": 55,
                    "source_scene": "manual_submit",
                    "priority": "high",
                    "status": "pending",
                    "submitted_content": "algebra note",
                    "reviewer_name": "adminA",
                    "decision_note": None,
                    "created_at": "2026-05-09T12:00:00+00:00",
                    "updated_at": "2026-05-09T12:01:00+00:00",
                }
            ],
            "total": 1,
        }

    monkeypatch.setattr(AdminService, "list_review_tasks", fake_list_review_tasks)

    response = client.get(
        "/api/v1/admin/reviews",
        params={
            "status": "pending",
            "entity_type": "resource",
            "priority": "high",
            "source_scene": "manual_submit",
            "reviewer_name": "adminA",
            "keyword": "algebra",
        },
    )

    assert response.status_code == 200
    assert response.json()["total"] == 1
    assert response.json()["items"][0]["submitted_content"] == "algebra note"


def test_get_review_task_summary_returns_payload(monkeypatch) -> None:
    async def fake_get_summary(self):
        return {
            "total": 6,
            "pending_count": 3,
            "by_status": {"pending": 3, "approved": 2, "rejected": 1},
            "by_priority": {"high": 4, "normal": 2},
            "by_source_scene": {"manual_submit": 5, "system_scan": 1},
            "latest_review_at": "2026-05-09T22:00:00+00:00",
        }

    monkeypatch.setattr(ReviewTaskSummaryService, "get_summary", fake_get_summary)

    response = client.get("/api/v1/admin/reviews/summary")

    assert response.status_code == 200
    assert response.json()["pending_count"] == 3


def test_get_audit_log_summary_returns_payload(monkeypatch) -> None:
    async def fake_get_summary(self, *, scene=None, action=None):
        assert scene == "content_review"
        assert action is None
        return {
            "total": 4,
            "by_scene": {"content_review": 4},
            "by_action": {"review_task_created": 2, "review_task_approved": 2},
            "latest_log_at": "2026-05-09T23:00:00+00:00",
        }

    monkeypatch.setattr(AuditLogSummaryService, "get_summary", fake_get_summary)

    response = client.get("/api/v1/admin/logs/summary", params={"scene": "content_review"})

    assert response.status_code == 200
    assert response.json()["total"] == 4


def test_get_agent_runtime_summary_returns_payload(monkeypatch) -> None:
    async def fake_get_summary(self, *, agent_name=None, level=None):
        assert agent_name == "planner_agent"
        assert level == "info"
        return {
            "total": 2,
            "error_count": 0,
            "degraded_agent_count": 0,
            "by_agent": {"planner_agent": 2},
            "by_level": {"info": 2},
            "latest_log_at": "2026-05-10T00:00:00+00:00",
        }

    monkeypatch.setattr(AgentRuntimeSummaryService, "get_summary", fake_get_summary)

    response = client.get(
        "/api/v1/admin/agents/logs/summary",
        params={"agent_name": "planner_agent", "level": "info"},
    )

    assert response.status_code == 200
    assert response.json()["total"] == 2


def test_get_system_config_summary_returns_payload(monkeypatch) -> None:
    async def fake_get_summary(self):
        return {
            "total": 5,
            "sensitive_count": 2,
            "by_prefix": {"llm": 3, "rag": 2},
            "latest_updated_at": "2026-05-10T00:30:00+00:00",
        }

    monkeypatch.setattr(SystemConfigSummaryService, "get_summary", fake_get_summary)

    response = client.get("/api/v1/admin/configs/summary")

    assert response.status_code == 200
    assert response.json()["sensitive_count"] == 2


def test_get_system_config_history_summary_returns_payload(monkeypatch) -> None:
    async def fake_get_summary(self, *, config_key=None, updated_by=None):
        assert config_key == "llm.provider"
        assert updated_by == "adminA"
        return {
            "total": 2,
            "by_config_key": {"llm.provider": 2},
            "by_updated_by": {"adminA": 2},
            "latest_created_at": "2026-05-10T06:00:00+00:00",
        }

    monkeypatch.setattr(SystemConfigHistorySummaryService, "get_summary", fake_get_summary)

    response = client.get(
        "/api/v1/admin/configs/history/summary",
        params={"config_key": "llm.provider", "updated_by": "adminA"},
    )

    assert response.status_code == 200
    assert response.json()["total"] == 2


def test_get_review_task_history_endpoint_returns_history(monkeypatch) -> None:
    async def fake_get_review_task_history(self, review_id: int):
        assert review_id == 101
        return {
            "items": [
                {
                    "review_id": 101,
                    "action": "review_task_created",
                    "reviewer_name": None,
                    "status": None,
                    "payload": {"review_id": 101, "entity_type": "resource"},
                    "created_at": "2026-05-09T12:00:00+00:00",
                },
                {
                    "review_id": 101,
                    "action": "review_task_batch_approved",
                    "reviewer_name": "adminA",
                    "status": "approved",
                    "payload": {"review_ids": [100, 101], "reviewer_name": "adminA"},
                    "created_at": "2026-05-09T12:05:00+00:00",
                },
            ],
            "total": 2,
        }

    monkeypatch.setattr(AdminService, "get_review_task_history", fake_get_review_task_history)

    response = client.get("/api/v1/admin/reviews/101/history")

    assert response.status_code == 200
    assert response.json()["total"] == 2
    assert response.json()["items"][1]["action"] == "review_task_batch_approved"


def test_approve_review_task_endpoint_returns_detail(monkeypatch) -> None:
    async def fake_approve_review_task(self, review_id: int, request):
        assert review_id == 301
        assert request.reviewer_name == "adminC"
        assert request.decision_note == "approved directly"
        return {
            "review_id": 301,
            "entity_type": "resource",
            "entity_id": 73,
            "source_scene": "manual_submit",
            "priority": "normal",
            "status": "approved",
            "submitted_content": "chapter 1 summary",
            "reviewer_name": "adminC",
            "decision_note": "approved directly",
            "created_at": "2026-05-09T12:00:00+00:00",
            "updated_at": "2026-05-09T12:07:00+00:00",
        }

    monkeypatch.setattr(AdminService, "approve_review_task", fake_approve_review_task)

    response = client.post(
        "/api/v1/admin/reviews/301/approve",
        json={"reviewer_name": "adminC", "decision_note": "approved directly"},
    )

    assert response.status_code == 200
    assert response.json()["status"] == "approved"
    assert response.json()["reviewer_name"] == "adminC"


def test_reject_review_task_endpoint_returns_detail(monkeypatch) -> None:
    async def fake_reject_review_task(self, review_id: int, request):
        assert review_id == 302
        assert request.reviewer_name == "adminD"
        assert request.decision_note == "contains issue"
        return {
            "review_id": 302,
            "entity_type": "resource",
            "entity_id": 74,
            "source_scene": "manual_submit",
            "priority": "normal",
            "status": "rejected",
            "submitted_content": "chapter 2 summary",
            "reviewer_name": "adminD",
            "decision_note": "contains issue",
            "created_at": "2026-05-09T12:00:00+00:00",
            "updated_at": "2026-05-09T12:09:00+00:00",
        }

    monkeypatch.setattr(AdminService, "reject_review_task", fake_reject_review_task)

    response = client.post(
        "/api/v1/admin/reviews/302/reject",
        json={"reviewer_name": "adminD", "decision_note": "contains issue"},
    )

    assert response.status_code == 200
    assert response.json()["status"] == "rejected"
    assert response.json()["decision_note"] == "contains issue"


def test_get_review_task_history_endpoint_propagates_not_found(monkeypatch) -> None:
    async def fake_get_review_task_history(self, review_id: int):
        raise HTTPException(status_code=404, detail=f"review task {review_id} not found")

    monkeypatch.setattr(AdminService, "get_review_task_history", fake_get_review_task_history)

    response = client.get("/api/v1/admin/reviews/999/history")

    assert response.status_code == 404
    assert response.json()["detail"] == "review task 999 not found"


def test_batch_approve_endpoint_validates_required_reviewer_name() -> None:
    response = client.post(
        "/api/v1/admin/reviews/batch/approve",
        json={"review_ids": [101, 102]},
    )

    assert response.status_code == 422


def test_update_admin_user_status_endpoint_returns_status_payload(monkeypatch) -> None:
    async def fake_update_admin_user_status(self, user_id: int, request):
        assert user_id == 1003
        assert request.status == "suspended"
        assert request.updated_by == "adminA"
        assert request.reason == "manual hold"
        return {
            "user_id": 1003,
            "status": "suspended",
            "reason": "manual hold",
            "updated_by": "adminA",
            "updated_at": "2026-05-09T13:00:00+00:00",
        }

    monkeypatch.setattr(AdminService, "update_admin_user_status", fake_update_admin_user_status)

    response = client.put(
        "/api/v1/admin/users/1003/status",
        json={
            "status": "suspended",
            "updated_by": "adminA",
            "reason": "manual hold",
        },
    )

    assert response.status_code == 200
    assert response.json()["status"] == "suspended"
    assert response.json()["updated_by"] == "adminA"


def test_list_admin_user_status_history_endpoint_passes_filters(monkeypatch) -> None:
    async def fake_list_history(self, *, user_id=None, status=None, updated_by=None):
        assert user_id == 1003
        assert status == "suspended"
        assert updated_by == "adminA"
        return {
            "items": [
                {
                    "user_id": 1003,
                    "status": "suspended",
                    "reason": "manual hold",
                    "updated_by": "adminA",
                    "created_at": "2026-05-09T21:00:00+00:00",
                }
            ],
            "total": 1,
        }

    monkeypatch.setattr(AdminUserStatusHistoryService, "list_history", fake_list_history)

    response = client.get(
        "/api/v1/admin/users/status-history",
        params={"user_id": 1003, "status": "suspended", "updated_by": "adminA"},
    )

    assert response.status_code == 200
    assert response.json()["total"] == 1
    assert response.json()["items"][0]["status"] == "suspended"


def test_list_agent_runtime_logs_endpoint_passes_filters(monkeypatch) -> None:
    async def fake_list_agent_runtime_logs(self, *, agent_name=None, level=None):
        assert agent_name == "planner_agent"
        assert level == "info"
        return {
            "items": [
                {
                    "log_id": 2,
                    "agent_name": "planner_agent",
                    "level": "info",
                    "status": "ok",
                    "message": "plan ready",
                    "payload": {"plan_id": 9},
                    "created_at": "2026-05-09T13:10:00+00:00",
                    "updated_at": "2026-05-09T13:11:00+00:00",
                }
            ],
            "total": 1,
        }

    monkeypatch.setattr(AdminService, "list_agent_runtime_logs", fake_list_agent_runtime_logs)

    response = client.get(
        "/api/v1/admin/agents/logs",
        params={"agent_name": "planner_agent", "level": "info"},
    )

    assert response.status_code == 200
    assert response.json()["total"] == 1
    assert response.json()["items"][0]["agent_name"] == "planner_agent"


def test_list_agent_status_endpoint_returns_items(monkeypatch) -> None:
    async def fake_list_agent_status(self):
        return {
            "items": [
                {
                    "agent_name": "resource_agent",
                    "latest_status": "ok",
                    "latest_message": "resources ready",
                    "error_count": 0,
                    "updated_at": "2026-05-09T13:12:00+00:00",
                }
            ],
            "total": 1,
        }

    monkeypatch.setattr(AdminService, "list_agent_status", fake_list_agent_status)

    response = client.get("/api/v1/admin/agents/status")

    assert response.status_code == 200
    assert response.json()["total"] == 1
    assert response.json()["items"][0]["latest_status"] == "ok"
