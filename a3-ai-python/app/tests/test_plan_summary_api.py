from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.v1 import plan
from app.services.plan_summary_service import PlanSummaryService


app = FastAPI()
app.include_router(plan.router, prefix="/api/v1/plan")
client = TestClient(app)


def test_get_plan_summary_returns_payload(monkeypatch) -> None:
    async def fake_get_summary(self, *, user_id: int):
        assert user_id == 1001
        return {
            "user_id": 1001,
            "total": 3,
            "average_completion_rate": 60.0,
            "by_status": {"active": 1, "completed": 1, "paused": 1},
            "by_course": {"PYTHON-AI": 2, "JAVA-CORE": 1},
            "latest_updated_at": "2026-05-10T02:00:00+00:00",
        }

    monkeypatch.setattr(PlanSummaryService, "get_summary", fake_get_summary)

    response = client.get("/api/v1/plan/summary", params={"user_id": 1001})

    assert response.status_code == 200
    assert response.json()["average_completion_rate"] == 60.0
