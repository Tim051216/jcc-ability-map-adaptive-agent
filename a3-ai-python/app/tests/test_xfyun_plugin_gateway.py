from fastapi.testclient import TestClient

from xfyun_agent import plugin_gateway


def test_job_learning_gateway_caches_successful_upstream_response(monkeypatch) -> None:
    payload = {
        "user_id": 1001,
        "course_id": 401,
        "course_code": "SE-401",
        "course_name": "软件工程与实践（第4版）",
        "professional_group": "软件技术专业群",
        "job_name": "software developer",
        "student_goal": "完成岗位实训",
        "goal_scene": "training",
        "assessment_id": "assessment-18",
        "assessment_updated_at": "2026-09-11T10:00:00+08:00",
        "ability_dimensions": [
            {
                "code": "software_testing",
                "label": "软件测试",
                "score": 62,
                "benchmark": 70,
                "assessment_status": "measured",
                "evidence": ["最近一次岗位诊断"],
            }
        ],
        "weak_abilities": [
            {
                "code": "software_testing",
                "label": "软件测试",
                "score": 62,
                "reason": "未达到岗位基准",
                "recommended_action": "补做测试用例设计",
            }
        ],
        "recommended_path": [
            {
                "step_id": "testing-drill",
                "title": "测试用例设计实训",
                "status": "pending",
                "duration_minutes": 45,
            }
        ],
        "recommended_resources": [],
        "citations": [],
        "safety_notices": [],
        "ai_generated": True,
        "next_action": {
            "action_type": "continue_plan",
            "label": "继续训练",
            "route": "/path?courseId=401",
            "reason": "优先补齐薄弱能力",
        },
    }

    class FakeResponse:
        status_code = 200

        @staticmethod
        def json() -> dict:
            return payload

    class FakeAsyncClient:
        calls = 0

        def __init__(self, **kwargs) -> None:
            self.kwargs = kwargs
            assert kwargs["trust_env"] is False

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, traceback) -> None:
            return None

        async def get(self, url: str, *, params: dict[str, int]):
            self.__class__.calls += 1
            assert url.endswith("/api/v1/student-portal/job-learning")
            assert params == {"user_id": 1001, "course_id": 401}
            return FakeResponse()

    plugin_gateway._response_cache.clear()
    monkeypatch.setattr(plugin_gateway.httpx, "AsyncClient", FakeAsyncClient)

    with TestClient(plugin_gateway.app) as client:
        first = client.get(
            "/api/v1/student-portal/job-learning",
            params={"user_id": 1001, "course_id": 401},
        )
        second = client.get(
            "/api/v1/student-portal/job-learning",
            params={"user_id": 1001, "course_id": 401},
        )

    assert first.status_code == 200
    assert first.json() == payload
    assert first.headers["x-plugin-cache"] == "miss"
    assert second.status_code == 200
    assert second.headers["x-plugin-cache"] == "hit"
    assert FakeAsyncClient.calls == 1

    route_expectations = {
        "/api/v1/xa/industry-analysis": ("industry_analysis", "competency_benchmarks"),
        "/api/v1/xa/ability-map": ("ability_map", "ability_dimensions"),
        "/api/v1/xa/task-cards": ("task_cards", "task_cards"),
        "/api/v1/xa/adaptive-recommendations": (
            "adaptive_recommendations",
            "recommended_path",
        ),
    }
    with TestClient(plugin_gateway.app) as client:
        for route, (route_name, expected_field) in route_expectations.items():
            response = client.get(route, params={"user_id": 1001, "course_id": 401})
            assert response.status_code == 200
            assert response.json()["route"] == route_name
            assert expected_field in response.json()
            assert response.headers["x-plugin-cache"] == "hit"

        compatibility = client.get(
            "/api/v1/xa-competition/industry/jobs-analysis",
            params={
                "professional_group": "软件技术专业群",
                "core_job": "软件开发工程师",
            },
        )
        assert compatibility.status_code == 200
        assert compatibility.json()["collection_mode"] == "student-assessment-projection"
        assert compatibility.json()["sample_count"] == 1
        assert compatibility.json()["skills"][0]["name"] == "软件测试"
        assert compatibility.json()["alerts"][0]["title"] == "软件测试低于岗位基准"
        assert compatibility.headers["x-plugin-cache"] == "hit"

    assert FakeAsyncClient.calls == 1
