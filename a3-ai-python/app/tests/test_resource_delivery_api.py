from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.v1 import resource
from app.services.resource_delivery_service import ResourceDeliveryService


app = FastAPI()
app.include_router(resource.router, prefix="/api/v1/resource")
client = TestClient(app)


def test_get_resource_preview_returns_payload(monkeypatch) -> None:
    async def fake_get_preview(self, resource_id: int):
        assert resource_id == 301
        return {
            "resource_id": 301,
            "title": "Asyncio Note",
            "resource_type": "lecture_note",
            "summary": "事件循环概览",
            "excerpt_markdown": "# Note\n\nline1",
            "source_titles": ["chapter-1"],
            "archived": False,
        }

    monkeypatch.setattr(ResourceDeliveryService, "get_preview", fake_get_preview)

    response = client.get("/api/v1/resource/301/preview")

    assert response.status_code == 200
    assert response.json()["resource_id"] == 301


def test_download_resource_returns_payload(monkeypatch) -> None:
    async def fake_download_resource(self, *, user_id: int, resource_id: int):
        assert user_id == 1001
        assert resource_id == 301
        return {
            "resource_id": 301,
            "user_id": 1001,
            "title": "Asyncio Note",
            "download_scope": "owner",
            "download_count": 3,
            "content_markdown": "# content",
        }

    monkeypatch.setattr(ResourceDeliveryService, "download_resource", fake_download_resource)

    response = client.post("/api/v1/resource/301/download", params={"user_id": 1001})

    assert response.status_code == 200
    assert response.json()["download_count"] == 3
