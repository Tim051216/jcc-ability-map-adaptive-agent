from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.v1 import evaluation
from app.services.wrong_question_summary_service import WrongQuestionSummaryService


app = FastAPI()
app.include_router(evaluation.router, prefix="/api/v1/evaluation")
client = TestClient(app)


def test_get_wrong_question_summary_returns_payload(monkeypatch) -> None:
    async def fake_get_summary(self, record_id: int):
        assert record_id == 801
        return {
            "record_id": 801,
            "paper_id": 501,
            "total": 3,
            "by_knowledge_point": {"asyncio": 2, "event_loop": 1},
            "by_question_type": {"single_choice": 2, "short_answer": 1},
        }

    monkeypatch.setattr(WrongQuestionSummaryService, "get_summary", fake_get_summary)

    response = client.get("/api/v1/evaluation/results/801/wrong-questions/summary")

    assert response.status_code == 200
    assert response.json()["total"] == 3
