from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.v1 import evaluation
from app.services.evaluation_history_service import EvaluationHistoryService


app = FastAPI()
app.include_router(evaluation.router, prefix="/api/v1/evaluation")
client = TestClient(app)


def test_get_evaluation_history_returns_payload(monkeypatch) -> None:
    async def fake_list_history(self, *, user_id: int, course_code: str, evaluation_type=None, limit: int = 10):
        assert user_id == 1001
        assert course_code == "PYTHON-AI"
        assert evaluation_type == "diagnostic"
        assert limit == 5
        return {
            "items": [
                {
                    "record_id": 801,
                    "paper_id": None,
                    "course_code": "PYTHON-AI",
                    "evaluation_type": "diagnostic",
                    "overall_score": 76.0,
                    "mastery_level": "developing",
                    "report_summary": "baseline",
                    "weak_points": ["asyncio"],
                    "knowledge_points": ["event_loop"],
                    "created_at": "2026-05-09T18:00:00+00:00",
                }
            ],
            "total": 1,
        }

    monkeypatch.setattr(EvaluationHistoryService, "list_history", fake_list_history)

    response = client.get(
        "/api/v1/evaluation/history",
        params={"user_id": 1001, "course_code": "PYTHON-AI", "evaluation_type": "diagnostic", "limit": 5},
    )

    assert response.status_code == 200
    assert response.json()["items"][0]["record_id"] == 801


def test_get_evaluation_trend_returns_payload(monkeypatch) -> None:
    async def fake_get_trend(self, *, user_id: int, course_code: str, evaluation_type=None, limit: int = 10):
        assert user_id == 1001
        assert course_code == "PYTHON-AI"
        assert evaluation_type is None
        assert limit == 10
        return {
            "user_id": 1001,
            "course_code": "PYTHON-AI",
            "total": 2,
            "latest_score": 88.0,
            "average_score": 82.0,
            "best_score": 88.0,
            "improvement": 12.0,
            "latest_mastery_level": "good",
            "focus_knowledge_points": ["asyncio", "project"],
        }

    monkeypatch.setattr(EvaluationHistoryService, "get_trend", fake_get_trend)

    response = client.get(
        "/api/v1/evaluation/trend",
        params={"user_id": 1001, "course_code": "PYTHON-AI"},
    )

    assert response.status_code == 200
    assert response.json()["average_score"] == 82.0
