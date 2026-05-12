from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.v1 import resource
from app.services.resource_favorite_summary_service import ResourceFavoriteSummaryService


app = FastAPI()
app.include_router(resource.router, prefix="/api/v1/resource")
client = TestClient(app)


def test_get_favorite_summary_returns_payload(monkeypatch) -> None:
    async def fake_get_summary(self, *, user_id: int):
        assert user_id == 1001
        return {
            "user_id": 1001,
            "total": 3,
            "by_type": {"quiz_set": 2, "mind_map": 1},
            "latest_favorite_at": "2026-05-10T01:00:00+00:00",
        }

    monkeypatch.setattr(ResourceFavoriteSummaryService, "get_summary", fake_get_summary)

    response = client.get("/api/v1/resource/favorites/summary", params={"user_id": 1001})

    assert response.status_code == 200
    assert response.json()["total"] == 3
