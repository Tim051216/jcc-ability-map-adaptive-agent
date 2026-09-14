from types import SimpleNamespace

import pytest

from app.services.admin_service import AdminService


def test_build_admin_user_overview_items_marks_high_risk_when_completion_low() -> None:
    service = AdminService()
    payload = {
        "profiles": [
            SimpleNamespace(user_id=1001, id=1, version=2, updated_at="2026-05-09T10:00:00+00:00"),
        ],
        "plans": [
            SimpleNamespace(
                user_id=1001,
                id=11,
                course_code="JAVA-CORE",
                status="active",
                plan_data={},
                updated_at="2026-05-09T10:05:00+00:00",
            ),
        ],
        "evaluations": [],
        "tickets": [],
        "progress_items": [
            SimpleNamespace(plan_id=11, status="completed"),
            SimpleNamespace(plan_id=11, status="pending"),
            SimpleNamespace(plan_id=11, status="pending"),
        ],
        "controls": [],
    }

    items = service._build_admin_user_overview_items(payload)

    assert len(items) == 1
    assert items[0].user_id == 1001
    assert items[0].completion_rate == 33.33
    assert items[0].risk_level == "high"
    assert items[0].course_code == "JAVA-CORE"


def test_build_admin_user_overview_items_marks_medium_risk_when_open_ticket_exists() -> None:
    service = AdminService()
    payload = {
        "profiles": [],
        "plans": [
            SimpleNamespace(
                user_id=1002,
                id=12,
                course_code="PYTHON-AI",
                status="active",
                plan_data={"completion_rate": 90},
                updated_at="2026-05-09T10:10:00+00:00",
            ),
        ],
        "evaluations": [
            SimpleNamespace(
                user_id=1002,
                id=21,
                course_code="PYTHON-AI",
                result_data={"overall_score": 88.5, "mastery_level": "good"},
                updated_at="2026-05-09T10:12:00+00:00",
            ),
        ],
        "tickets": [
            SimpleNamespace(user_id=1002, status="open", updated_at="2026-05-09T10:15:00+00:00"),
        ],
        "progress_items": [],
        "controls": [],
    }

    items = service._build_admin_user_overview_items(payload)

    assert len(items) == 1
    assert items[0].user_id == 1002
    assert items[0].open_ticket_count == 1
    assert items[0].risk_level == "medium"
    assert items[0].latest_score == 88.5
    assert items[0].mastery_level == "good"


def test_build_admin_user_overview_items_uses_admin_control_status() -> None:
    service = AdminService()
    payload = {
        "profiles": [
            SimpleNamespace(user_id=1003, id=1, version=1, updated_at="2026-05-09T10:00:00+00:00"),
        ],
        "plans": [],
        "evaluations": [],
        "tickets": [],
        "progress_items": [],
        "controls": [
            SimpleNamespace(
                user_id=1003,
                status="suspended",
                reason="多次异常请求",
                updated_by="adminA",
                updated_at="2026-05-09T10:20:00+00:00",
            ),
        ],
    }

    items = service._build_admin_user_overview_items(payload)

    assert len(items) == 1
    assert items[0].user_id == 1003
    assert items[0].user_status == "suspended"
    assert items[0].status_reason == "多次异常请求"
    assert items[0].status_updated_by == "adminA"


def test_build_admin_user_overview_items_defaults_user_status_to_active() -> None:
    service = AdminService()
    payload = {
        "profiles": [
            SimpleNamespace(user_id=1004, id=1, version=1, updated_at="2026-05-09T10:00:00+00:00"),
        ],
        "plans": [],
        "evaluations": [],
        "tickets": [],
        "progress_items": [],
        "controls": [],
    }

    items = service._build_admin_user_overview_items(payload)

    assert len(items) == 1
    assert items[0].user_status == "active"


def test_build_system_config_history_items_filters_and_extracts_new_value() -> None:
    service = AdminService()
    logs = [
        SimpleNamespace(
            action="system_config_updated",
            payload={
                "config_key": "llm.provider",
                "updated_by": "adminA",
                "old_value": "mock",
                "new_value": "dashscope",
            },
            created_at="2026-05-09T11:00:00+00:00",
        ),
        SimpleNamespace(
            action="system_config_updated",
            payload={
                "config_key": "rag.top_k",
                "updated_by": "adminB",
                "old_value": "3",
                "new_value": "5",
            },
            created_at="2026-05-09T11:05:00+00:00",
        ),
    ]

    items = service._build_system_config_history_items(logs, config_key="llm.provider", updated_by="adminA")

    assert len(items) == 1
    assert items[0].config_key == "llm.provider"
    assert items[0].updated_by == "adminA"
    assert items[0].value == "dashscope"


def test_build_system_config_history_items_masks_sensitive_values() -> None:
    service = AdminService()
    logs = [
        SimpleNamespace(
            action="system_config_updated",
            payload={
                "config_key": "llm.api_key",
                "updated_by": "adminA",
                "old_value": "old-secret",
                "new_value": "new-secret",
            },
            created_at="2026-05-09T11:00:00+00:00",
        ),
    ]

    items = service._build_system_config_history_items(logs)

    assert len(items) == 1
    assert items[0].config_key == "llm.api_key"
    assert items[0].is_sensitive is True
    assert items[0].value == "******"
    assert items[0].payload == {
        "config_key": "llm.api_key",
        "updated_by": "adminA",
        "old_value": "******",
        "new_value": "******",
    }


def test_to_config_response_masks_sensitive_config_value() -> None:
    config = SimpleNamespace(
        config_key="embedding.access_key",
        config_value="abc123",
        description="test",
        updated_by="adminA",
        created_at="2026-05-09T11:00:00+00:00",
        updated_at="2026-05-09T11:05:00+00:00",
    )

    item = AdminService._to_config_response(config)

    assert item.config_key == "embedding.access_key"
    assert item.is_sensitive is True
    assert item.config_value == "******"


def test_build_review_task_history_items_includes_single_and_batch_actions() -> None:
    service = AdminService()
    logs = [
        SimpleNamespace(
            action="review_task_created",
            payload={"review_id": 101, "entity_type": "resource", "entity_id": 55},
            created_at="2026-05-09T12:00:00+00:00",
        ),
        SimpleNamespace(
            action="review_task_batch_approved",
            payload={
                "review_ids": [99, 101],
                "reviewer_name": "adminA",
                "status": "approved",
                "updated_count": 2,
            },
            created_at="2026-05-09T12:05:00+00:00",
        ),
        SimpleNamespace(
            action="review_task_rejected",
            payload={"review_id": 202, "reviewer_name": "adminB", "status": "rejected"},
            created_at="2026-05-09T12:10:00+00:00",
        ),
    ]

    items = service._build_review_task_history_items(logs, review_id=101)

    assert len(items) == 2
    assert items[0].review_id == 101
    assert items[0].action == "review_task_created"
    assert items[1].action == "review_task_batch_approved"
    assert items[1].reviewer_name == "adminA"
    assert items[1].status == "approved"


def test_normalize_agent_message_returns_clean_demo_copy() -> None:
    message = AdminService._normalize_agent_message("planner_agent", "任意原始消息")

    assert message == "学习路径已生成，并同步到今日任务编排。"


def test_normalize_agent_payload_rewrites_demo_topic() -> None:
    payload = AdminService._normalize_agent_payload(
        "resource_agent",
        {"resource_count": 8, "topic": "脏数据", "source": "demo"},
    )

    assert payload == {
        "resource_count": 8,
        "topic": "模型评估与过拟合",
        "source": "demo",
    }


class _FakeSessionFactory:
    def __init__(self, session) -> None:
        self._session = session

    async def __aenter__(self):
        return self._session

    async def __aexit__(self, exc_type, exc, tb) -> bool:
        return False


def _patch_session_factory(monkeypatch, session) -> None:
    monkeypatch.setattr("app.db.session.async_session_factory", lambda: _FakeSessionFactory(session))


@pytest.mark.asyncio
async def test_list_agent_status_returns_empty_when_no_runtime_logs(monkeypatch) -> None:
    session = SimpleNamespace()
    _patch_session_factory(monkeypatch, session)

    class FakeAgentRuntimeRepository:
        async def list_logs(self, session_obj, **kwargs):
            assert session_obj is session
            return [], 0

    monkeypatch.setattr("app.services.admin_service.AgentRuntimeRepository", lambda: FakeAgentRuntimeRepository())
    monkeypatch.setattr("app.services.admin_service.AgentRegistryService.discover", lambda: [])

    response = await AdminService().list_agent_status()

    assert response.total == 0
    assert response.items == []


@pytest.mark.asyncio
async def test_list_agent_status_merges_registry_with_runtime_logs(monkeypatch) -> None:
    session = SimpleNamespace()
    _patch_session_factory(monkeypatch, session)

    class FakeAgentRuntimeRepository:
        async def list_logs(self, session_obj, **kwargs):
            assert session_obj is session
            return [
                SimpleNamespace(
                    agent_name="planner_agent",
                    status="ok",
                    message="ready",
                    level="info",
                    updated_at="2026-05-10T10:00:00+00:00",
                )
            ], 1

    monkeypatch.setattr("app.services.admin_service.AgentRuntimeRepository", lambda: FakeAgentRuntimeRepository())
    monkeypatch.setattr(
        "app.services.admin_service.AgentRegistryService.discover",
        lambda: [
            {
                "agent_name": "planner_agent",
                "display_name": "Planner Agent",
                "category": "general",
                "source_path": "agents/nodes/planner_agent.py",
            },
            {
                "agent_name": "profile_builder_agent",
                "display_name": "Profile Builder Agent",
                "category": "profile_conversation",
                "source_path": "agents/nodes/profile_conversation/profile_builder_agent.py",
            },
        ],
    )

    response = await AdminService().list_agent_status()

    assert response.total == 2
    assert response.items[0].agent_name == "learning_planning_agent"
    assert response.items[0].status_source == "runtime"
    assert response.items[0].source_path == "agents/nodes/planner_agent.py"
    assert response.items[1].agent_name == "profile_agent"
    assert response.items[1].latest_status == "unreported"
    assert response.items[1].status_source == "registry"


@pytest.mark.asyncio
async def test_list_agent_runtime_logs_returns_empty_when_no_runtime_logs(monkeypatch) -> None:
    session = SimpleNamespace()
    _patch_session_factory(monkeypatch, session)

    class FakeAgentRuntimeRepository:
        async def list_logs(self, session_obj, **kwargs):
            assert session_obj is session
            assert kwargs["agent_name"] == "planner_agent"
            return [], 0

    monkeypatch.setattr("app.services.admin_service.AgentRuntimeRepository", lambda: FakeAgentRuntimeRepository())

    response = await AdminService().list_agent_runtime_logs(agent_name="planner_agent")

    assert response.total == 0
    assert response.items == []
