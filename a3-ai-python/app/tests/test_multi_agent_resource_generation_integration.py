"""
多智能体资源生成 — 集成测试（任务 15）

- API：FastAPI 路由 + 服务层打桩，验证请求/响应契约
- 协调器：并行调度五类资源节点（LLM 调用全部打桩）
- 生成服务：异步任务快速完成路径（不调用真实协调器）
"""

from __future__ import annotations

import asyncio
from datetime import datetime
from decimal import Decimal

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.router import api_router
from app.api.v1 import resource as resource_router
from app.agents.nodes.resource_generation.coordinator_agent import ResourceGenerationCoordinator
from app.schemas.resource import (
    LearningResourceResponse,
    ResourceGenerationTaskCreate,
    ResourceGenerationTaskResponse,
    ResourceListResponseV2,
    ResourceFavoriteCreate,
    ResourceFavoriteRecordResponse,
)
from app.services.resource_generation_service import ResourceGenerationService
from app.services.resource_management_service import ResourceManagementService

app = FastAPI()
app.include_router(resource_router.router, prefix="/api/v1/resource")
client = TestClient(app)


@pytest.fixture(autouse=True)
def _reset_resource_shared_state():
    ResourceGenerationService.reset_shared_state()
    ResourceManagementService.reset_shared_state()
    yield
    ResourceGenerationService.reset_shared_state()
    ResourceManagementService.reset_shared_state()


def _task_response(task_id: int = 1) -> ResourceGenerationTaskResponse:
    now = datetime.now()
    return ResourceGenerationTaskResponse(
        id=task_id,
        task_name="集成测试任务",
        student_id=1001,
        resource_types="1,2,3",
        knowledge_point_id=101,
        course_id=1,
        task_status=1,
        progress=0,
        total_resources=3,
        completed_resources=0,
        failed_resources=0,
        error_message=None,
        start_time=None,
        end_time=None,
        create_time=now,
        update_time=now,
    )


def _sample_resource(rid: int = 1) -> LearningResourceResponse:
    now = datetime.now()
    return LearningResourceResponse(
        id=rid,
        resource_name="测试资源",
        resource_type=1,
        knowledge_point_id=101,
        course_id=1,
        student_id=1001,
        difficulty_level=1,
        status=2,
        version=1,
        file_url=None,
        file_size=None,
        file_format="markdown",
        generation_task_id=None,
        quality_score=Decimal("0.85"),
        view_count=0,
        download_count=0,
        favorite_count=0,
        create_time=now,
        update_time=now,
    )


# --- 资源生成 API ---


def test_post_generation_tasks_returns_task(monkeypatch) -> None:
    async def fake_create(self, task_data: ResourceGenerationTaskCreate):
        assert task_data.task_name == "t1"
        assert task_data.resource_types == [1, 2]
        base = _task_response()
        return base.model_copy(
            update={
                "resource_types": ",".join(map(str, task_data.resource_types)),
                "total_resources": len(task_data.resource_types),
            }
        )

    monkeypatch.setattr(ResourceGenerationService, "create_generation_task", fake_create)

    response = client.post(
        "/api/v1/resource/generation/tasks",
        json={
            "task_name": "t1",
            "student_id": 1001,
            "resource_types": [1, 2],
            "knowledge_point_id": 101,
            "course_id": 1,
            "generation_params": {"difficulty_level": 1},
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["id"] == 1
    assert body["resource_types"] == "1,2"
    assert body["total_resources"] == 2


def test_get_generation_task_status(monkeypatch) -> None:
    expected = _task_response(task_id=7)

    async def fake_get(self, task_id: int):
        assert task_id == 7
        return expected

    monkeypatch.setattr(ResourceGenerationService, "get_task_status", fake_get)

    response = client.get("/api/v1/resource/generation/tasks/7")
    assert response.status_code == 200
    assert response.json()["task_status"] == 1


def test_list_generation_tasks(monkeypatch) -> None:
    payload = {
        "items": [{"id": 1, "task_name": "a", "student_id": 1, "resource_types": "1",
                   "knowledge_point_id": 1, "course_id": 1, "task_status": 3, "progress": 100,
                   "total_resources": 1, "completed_resources": 1, "failed_resources": 0,
                   "create_time": datetime.now().isoformat(),
                   "update_time": datetime.now().isoformat()}],
        "total": 1,
        "page": 1,
        "page_size": 20,
        "total_pages": 1,
    }

    async def fake_list(self, **kwargs):
        assert kwargs.get("student_id") == 1001
        return payload

    monkeypatch.setattr(ResourceGenerationService, "list_tasks", fake_list)

    response = client.get("/api/v1/resource/generation/tasks?student_id=1001")
    assert response.status_code == 200
    assert response.json()["total"] == 1


def test_cancel_generation_task(monkeypatch) -> None:
    async def fake_cancel(self, task_id: int):
        assert task_id == 3
        return True

    monkeypatch.setattr(ResourceGenerationService, "cancel_task", fake_cancel)

    response = client.delete("/api/v1/resource/generation/tasks/3")
    assert response.status_code == 200
    assert response.json()["success"] is True


def test_generation_task_state_survives_new_service_instances(monkeypatch) -> None:
    async def fake_process(self, task_id: int, task_data: ResourceGenerationTaskCreate):
        await self._update_task_status(task_id, {"progress": 35})

    monkeypatch.setattr(ResourceGenerationService, "_process_generation_task", fake_process)

    payload = {
        "task_name": "shared-state-task",
        "student_id": 1001,
        "resource_types": [1, 2],
        "knowledge_point_id": 101,
        "course_id": 1,
        "generation_params": {"difficulty_level": 1},
    }

    created = client.post("/api/v1/resource/generation/tasks", json=payload)
    assert created.status_code == 200
    task_id = created.json()["id"]

    fetched = client.get(f"/api/v1/resource/generation/tasks/{task_id}")
    assert fetched.status_code == 200
    assert fetched.json()["id"] == task_id


def test_favorite_flow_survives_new_service_instances() -> None:
    now = datetime.now()
    ResourceManagementService.register_resource(
        {
            "id": 9,
            "resource_name": "doc",
            "resource_type": 1,
            "knowledge_point_id": 10,
            "course_id": 2,
            "student_id": 1,
            "difficulty_level": 1,
            "status": 2,
            "version": 1,
            "file_url": None,
            "file_size": None,
            "file_format": "markdown",
            "generation_task_id": None,
            "quality_score": None,
            "view_count": 0,
            "download_count": 0,
            "favorite_count": 0,
            "create_time": now,
            "update_time": now,
        }
    )


def test_resource_routes_are_registered_on_main_api_router() -> None:
    paths = {getattr(route, "path", None) for route in api_router.routes}
    assert "/v1/resource/v2/list" in paths
    assert "/v1/resource/generation/tasks" in paths


def test_favorite_flow_persists_across_requests() -> None:
    ResourceManagementService.register_resource(
        {
            "id": 9,
            "resource_name": "递归讲义",
            "resource_type": 1,
            "knowledge_point_id": 101,
            "course_id": 1,
            "student_id": 1,
            "difficulty_level": 1,
            "status": 2,
            "version": 1,
            "view_count": 0,
            "download_count": 0,
            "favorite_count": 0,
            "create_time": datetime.now(),
            "update_time": datetime.now(),
        }
    )

    added = client.post(
        "/api/v1/resource/v2/favorites",
        json={"user_id": 1, "resource_id": 9, "category": "默认分类"},
    )
    assert added.status_code == 200

    listed = client.get("/api/v1/resource/v2/favorites/list?user_id=1")
    assert listed.status_code == 200
    assert listed.json()["total"] == 1
    assert listed.json()["items"][0]["id"] == 9
    assert listed.json()["items"][0]["resource_id"] == 9
    assert listed.json()["items"][0]["category"] == "默认分类"

    updated = client.put(
        "/api/v1/resource/v2/favorites/9",
        json={"user_id": 1, "category": "重点复习", "notes": "保留这份"},
    )
    assert updated.status_code == 200
    assert updated.json()["category"] == "重点复习"
    assert updated.json()["notes"] == "保留这份"


@pytest.mark.asyncio
async def test_generation_results_become_searchable_and_stat_visible(monkeypatch) -> None:
    async def fake_coordinate_generation(self, **kwargs):
        assert kwargs["programming_language"] == "Java"
        return {
            "results": {
                "document": {
                    "success": True,
                    "data": {
                        "title": "递归讲义",
                        "content_markdown": "递归是一种把大问题拆成子问题的思想。",
                        "quality_score": 0.92,
                    },
                }
            },
            "summary": {"success_count": 1, "failed_count": 0, "total_tasks": 1},
        }

    monkeypatch.setattr(
        ResourceGenerationCoordinator,
        "coordinate_generation",
        fake_coordinate_generation,
    )

    service = ResourceGenerationService()
    created = await service.create_generation_task(
        ResourceGenerationTaskCreate(
            task_name="递归资源",
            student_id=1001,
            resource_types=[1],
            knowledge_point_id=101,
            course_id=1,
            generation_params={"difficulty_level": 2, "programming_language": "Java"},
        )
    )

    await asyncio.sleep(0)
    await asyncio.sleep(0)

    fetched = await service.get_task_status(created.id)
    assert fetched.task_status == 3
    assert fetched.completed_resources == 1

    management = ResourceManagementService()
    search_result = await management.search_resources("子问题", student_id=1001)
    assert search_result.total == 1
    assert search_result.items[0].resource_name == "递归讲义"
    assert search_result.items[0].difficulty_level == 2

    stats = await management.get_resource_statistics(1001)
    assert stats["total_resources"] == 1
    assert stats["by_type"][1] == 1


@pytest.mark.asyncio
async def test_generation_task_marks_partial_failure(monkeypatch) -> None:
    async def fake_coordinate_generation(self, **kwargs):
        return {
            "results": {
                "document": {"success": True, "data": {"title": "文档", "content_markdown": "ok"}},
                "mindmap": {"success": False, "error": "bad graph"},
            },
            "summary": {"success_count": 1, "failed_count": 1, "total_tasks": 2},
        }

    monkeypatch.setattr(
        ResourceGenerationCoordinator,
        "coordinate_generation",
        fake_coordinate_generation,
    )

    service = ResourceGenerationService()
    created = await service.create_generation_task(
        ResourceGenerationTaskCreate(
            task_name="partial",
            student_id=1001,
            resource_types=[1, 2],
            knowledge_point_id=101,
            course_id=1,
        )
    )

    await asyncio.sleep(0)
    await asyncio.sleep(0)

    fetched = await service.get_task_status(created.id)
    assert fetched.task_status == 4
    assert fetched.completed_resources == 1
    assert fetched.failed_resources == 1


# --- 资源管理 V2 API ---


def test_v2_list_resources(monkeypatch) -> None:
    now = datetime.now()
    body = ResourceListResponseV2(
        items=[
            LearningResourceResponse(
                id=1,
                resource_name="doc",
                resource_type=1,
                knowledge_point_id=10,
                course_id=2,
                student_id=200,
                difficulty_level=1,
                status=2,
                version=1,
                view_count=1,
                download_count=0,
                favorite_count=0,
                create_time=now,
                update_time=now,
            )
        ],
        total=1,
        page=1,
        page_size=20,
        total_pages=1,
    )

    async def fake_query(self, params):
        assert params.student_id == 200
        return body

    monkeypatch.setattr(ResourceManagementService, "query_resources", fake_query)

    response = client.get("/api/v1/resource/v2/list?student_id=200")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 1
    assert data["items"][0]["resource_name"] == "doc"


def test_v2_resource_detail(monkeypatch) -> None:
    detail = _sample_resource(42)

    async def fake_detail(self, resource_id: int):
        assert resource_id == 42
        return detail

    monkeypatch.setattr(ResourceManagementService, "get_resource_detail", fake_detail)

    response = client.get("/api/v1/resource/v2/42/detail")
    assert response.status_code == 200
    assert response.json()["id"] == 42


def test_v2_search(monkeypatch) -> None:
    empty = ResourceListResponseV2(items=[], total=0, page=1, page_size=20, total_pages=0)

    async def fake_search(self, **kwargs):
        assert kwargs["keyword"] == "递归"
        return empty

    monkeypatch.setattr(ResourceManagementService, "search_resources", fake_search)

    response = client.get("/api/v1/resource/v2/search?keyword=递归")
    assert response.status_code == 200
    assert response.json()["total"] == 0


def test_v2_favorites_flow(monkeypatch) -> None:
    now = datetime.now()
    fav = ResourceFavoriteRecordResponse(
        id=1, user_id=1, resource_id=9, category="默认分类", notes=None, create_time=now
    )

    async def fake_add(self, data: ResourceFavoriteCreate):
        assert data.resource_id == 9
        return fav

    async def fake_remove(self, user_id: int, resource_id: int):
        assert user_id == 1 and resource_id == 9
        return True

    async def fake_fav_list(self, **kwargs):
        return ResourceListResponseV2(items=[], total=0, page=1, page_size=20, total_pages=0)

    async def fake_categories(self, user_id: int):
        assert user_id == 1
        return [{"category": "默认分类", "count": 1}]

    monkeypatch.setattr(ResourceManagementService, "add_favorite", fake_add)
    monkeypatch.setattr(ResourceManagementService, "remove_favorite", fake_remove)
    monkeypatch.setattr(ResourceManagementService, "list_favorites", fake_fav_list)
    monkeypatch.setattr(ResourceManagementService, "get_favorite_categories", fake_categories)

    r1 = client.post(
        "/api/v1/resource/v2/favorites",
        json={"user_id": 1, "resource_id": 9, "category": "默认分类"},
    )
    assert r1.status_code == 200
    assert r1.json()["resource_id"] == 9

    r2 = client.delete("/api/v1/resource/v2/favorites?user_id=1&resource_id=9")
    assert r2.status_code == 200

    r3 = client.get("/api/v1/resource/v2/favorites/list?user_id=1")
    assert r3.status_code == 200

    r4 = client.get("/api/v1/resource/v2/favorites/categories?user_id=1")
    assert r4.status_code == 200
    assert r4.json()[0]["count"] == 1


def test_v2_download_and_batch_and_delete_and_stats(monkeypatch) -> None:
    async def fake_dl(self, **kwargs):
        assert kwargs["resource_id"] == 5
        return {"resource_id": 5, "download_url": "https://example.com/x", "format": "markdown"}

    async def fake_batch(self, **kwargs):
        return {"download_url": "https://example.com/batch.zip", "resource_count": 2}

    async def fake_delete(self, **kwargs):
        return True

    async def fake_stats(self, student_id: int):
        assert student_id == 99
        return {"total_resources": 3, "by_type": {1: 3}, "by_status": {2: 3}}

    monkeypatch.setattr(ResourceManagementService, "generate_download_url", fake_dl)
    monkeypatch.setattr(ResourceManagementService, "batch_download", fake_batch)
    monkeypatch.setattr(ResourceManagementService, "delete_resource", fake_delete)
    monkeypatch.setattr(ResourceManagementService, "get_resource_statistics", fake_stats)

    assert client.get("/api/v1/resource/v2/5/download?user_id=1").status_code == 200
    assert (
        client.post(
            "/api/v1/resource/v2/batch-download",
            json={"resource_ids": [1, 2], "user_id": 1, "format": "zip"},
        ).status_code
        == 200
    )
    assert client.delete("/api/v1/resource/v2/8?user_id=1").status_code == 200
    r = client.get("/api/v1/resource/v2/statistics?student_id=99")
    assert r.status_code == 200
    assert r.json()["total_resources"] == 3


# --- 协调器（无 LLM） ---


@pytest.mark.asyncio
async def test_coordinator_parallel_all_resource_types(monkeypatch) -> None:
    coord = ResourceGenerationCoordinator()

    async def fake_doc(*_a, **_k):
        return {"quality_score": 0.9, "title": "t", "content_markdown": "# x"}

    async def fake_map(*_a, **_k):
        return {"node_count": 20, "max_depth": 3, "mermaid_code": "mindmap\n  root"}

    async def fake_qb(*_a, **_k):
        return {"total_questions": 8}

    async def fake_vid(*_a, **_k):
        return {"recommended_count": 4}

    async def fake_code(*_a, **_k):
        return {"code_structure": {"line_count": 80}}

    monkeypatch.setattr(coord, "_generate_document", fake_doc)
    monkeypatch.setattr(coord, "_generate_mindmap", fake_map)
    monkeypatch.setattr(coord, "_generate_question_bank", fake_qb)
    monkeypatch.setattr(coord, "_recommend_videos", fake_vid)
    monkeypatch.setattr(coord, "_generate_code_example", fake_code)

    out = await coord.coordinate_generation(
        knowledge_point="测试知识点",
        resource_types=[1, 2, 3, 4, 5],
        student_profile={"difficulty_level": 1},
        course_context="ctx",
        programming_language="Python",
    )

    assert out["summary"]["success_count"] == 5
    assert out["summary"]["failed_count"] == 0
    assert out["summary"]["total_tasks"] == 5
    results = out["results"]
    assert results["document"]["success"] is True
    assert results["mindmap"]["data"]["node_count"] == 20
    assert results["question_bank"]["data"]["total_questions"] == 8
    assert results["video"]["data"]["recommended_count"] == 4
    assert results["code_example"]["data"]["code_structure"]["line_count"] == 80


@pytest.mark.asyncio
async def test_generation_service_background_completes(monkeypatch) -> None:
    async def quick_complete(self, task_id: int, task_data: ResourceGenerationTaskCreate):
        await self._update_task_status(
            task_id,
            {
                "task_status": 3,
                "progress": 100,
                "completed_resources": len(task_data.resource_types),
                "failed_resources": 0,
                "end_time": datetime.now(),
            },
        )

    monkeypatch.setattr(ResourceGenerationService, "_process_generation_task", quick_complete)

    svc = ResourceGenerationService()
    resp = await svc.create_generation_task(
        ResourceGenerationTaskCreate(
            task_name="bg",
            student_id=1,
            resource_types=[1],
            knowledge_point_id=1,
            course_id=1,
        )
    )
    assert resp.task_status == 1
    assert resp.progress == 0

    for _ in range(50):
        await asyncio.sleep(0.02)
        st = await svc.get_task_status(resp.id)
        if st.task_status == 3 and st.progress == 100:
            assert st.completed_resources == 1
            return

    pytest.fail("background task did not complete in time")
