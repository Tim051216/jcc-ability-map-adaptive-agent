from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.v1 import profile
from app.services.profile_evolution_service import ProfileEvolutionService
from app.services.profile_tag_summary_service import ProfileTagSummaryService
from app.services.profile_service import ProfileService


app = FastAPI()
app.include_router(profile.router, prefix="/api/v1/profile")
client = TestClient(app)


def test_get_latest_profile_returns_404_when_missing(monkeypatch) -> None:
    async def fake_get_latest_profile(self, user_id: int):
        assert user_id == 1001
        return None

    monkeypatch.setattr(ProfileService, "get_latest_profile", fake_get_latest_profile)

    response = client.get("/api/v1/profile/latest", params={"user_id": 1001})

    assert response.status_code == 404
    assert response.json()["detail"] == "profile not found"


def test_get_profile_history_returns_payload(monkeypatch) -> None:
    async def fake_list_history(self, *, user_id: int, limit: int = 10):
        assert user_id == 1001
        assert limit == 5
        return {
            "items": [
                {
                    "snapshot_id": 3,
                    "user_id": 1001,
                    "version": 3,
                    "summary": "第三版画像",
                    "source_summary": "教师人工微调",
                    "profile_tags": ["稳定"],
                    "updated_at": "2026-05-09T18:00:00+00:00",
                }
            ],
            "total": 1,
        }

    monkeypatch.setattr(ProfileEvolutionService, "list_history", fake_list_history)

    response = client.get("/api/v1/profile/history", params={"user_id": 1001, "limit": 5})

    assert response.status_code == 200
    assert response.json()["total"] == 1
    assert response.json()["items"][0]["version"] == 3


def test_get_profile_tag_summary_returns_payload(monkeypatch) -> None:
    async def fake_get_summary(self, *, user_id: int, limit: int = 10):
        assert user_id == 1001
        assert limit == 5
        return {
            "user_id": 1001,
            "total_snapshots": 2,
            "by_tag": {"踏实": 2, "执行稳定": 1},
            "by_resource_type": {"quiz": 2, "note": 1},
            "latest_updated_at": "2026-05-10T03:00:00+00:00",
        }

    monkeypatch.setattr(ProfileTagSummaryService, "get_summary", fake_get_summary)

    response = client.get("/api/v1/profile/summary", params={"user_id": 1001, "limit": 5})

    assert response.status_code == 200
    assert response.json()["by_tag"]["踏实"] == 2


def test_tune_profile_returns_new_version(monkeypatch) -> None:
    async def fake_tune_profile(self, request):
        assert request.user_id == 1001
        assert request.summary == "增加表达训练"
        return {
            "user_id": 1001,
            "dimensions": {"logic": {"score": 0.7}, "confidence": {"score": 0.8}},
            "dimension_order": ["logic", "confidence"],
            "profile_tags": ["踏实", "表达提升"],
            "recommended_resource_types": ["note", "quiz"],
            "summary": "增加表达训练",
            "version": 3,
        }

    monkeypatch.setattr(ProfileEvolutionService, "tune_profile", fake_tune_profile)

    response = client.post(
        "/api/v1/profile/tune",
        json={
            "user_id": 1001,
            "dimensions_patch": {"confidence": {"score": 0.8}},
            "profile_tags": ["踏实", "表达提升"],
            "recommended_resource_types": ["note", "quiz"],
            "summary": "增加表达训练",
            "source_summary": "教师人工微调",
            "updated_by": "teacherA",
        },
    )

    assert response.status_code == 200
    assert response.json()["version"] == 3


def test_apply_behavior_feedback_returns_new_version(monkeypatch) -> None:
    async def fake_apply_behavior_feedback(self, request):
        assert request.user_id == 1001
        assert request.activity_type == "weekly_review"
        return {
            "user_id": 1001,
            "dimensions": {
                "logic": {"score": 0.7},
                "discipline": {"score": 0.85},
            },
            "dimension_order": ["logic", "discipline"],
            "profile_tags": ["踏实", "执行稳定"],
            "recommended_resource_types": ["note"],
            "summary": "最近一次weekly_review行为已回流画像；完成度 85%",
            "version": 4,
        }

    monkeypatch.setattr(ProfileEvolutionService, "apply_behavior_feedback", fake_apply_behavior_feedback)

    response = client.post(
        "/api/v1/profile/feedback",
        json={
            "user_id": 1001,
            "activity_type": "weekly_review",
            "course_code": "PYTHON-AI",
            "duration_minutes": 90,
            "completion_rate": 85,
            "resource_usage_count": 4,
            "weak_points": ["asyncio"],
            "note": "本周完成度明显提升",
            "updated_by": "system",
        },
    )

    assert response.status_code == 200
    assert response.json()["version"] == 4
