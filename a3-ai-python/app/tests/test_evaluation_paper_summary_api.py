from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.v1 import evaluation
from app.services.evaluation_paper_summary_service import EvaluationPaperSummaryService


app = FastAPI()
app.include_router(evaluation.router, prefix="/api/v1/evaluation")
client = TestClient(app)


def test_get_paper_summary_returns_payload(monkeypatch) -> None:
    async def fake_get_summary(self, *, user_id: int, course_code: str | None = None, limit: int = 10):
        assert user_id == 1001
        assert course_code == "PYTHON-AI"
        assert limit == 5
        return {
            "user_id": 1001,
            "course_code": "PYTHON-AI",
            "total": 2,
            "total_questions": 3,
            "by_paper_type": {"diagnostic": 1, "practice": 1},
            "by_question_type": {"single_choice": 2, "short_answer": 1},
            "by_knowledge_point": {"asyncio": 2, "event_loop": 1},
            "latest_paper_at": "2026-05-10T05:00:00+00:00",
        }

    monkeypatch.setattr(EvaluationPaperSummaryService, "get_summary", fake_get_summary)

    response = client.get(
        "/api/v1/evaluation/papers/summary",
        params={"user_id": 1001, "course_code": "PYTHON-AI", "limit": 5},
    )

    assert response.status_code == 200
    assert response.json()["total_questions"] == 3
