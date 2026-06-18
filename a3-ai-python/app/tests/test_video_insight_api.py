from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.v1 import resource
from app.schemas.resource import VideoInsightAskRequest
from app.services.resource_service import ResourceService
from app.services.video_insight_service import VideoInsightService


app = FastAPI()
app.include_router(resource.router, prefix="/api/v1/resource")
client = TestClient(app)


def test_get_video_insight_returns_payload(monkeypatch) -> None:
    async def fake_get_resource(self, resource_id: int):
        assert resource_id == 301
        return {
            "resource_id": 301,
            "resource_type": "video",
            "title": "测试视频资源",
            "summary": "测试摘要",
            "content_markdown": "",
            "source_titles": [],
            "study_suggestion": None,
            "source_file_count": 1,
            "source_files": [],
        }

    async def fake_get_insight(self, *, resource_id: int | None, file_id: int, resource_title: str | None = None, file_name: str | None = None):
        assert resource_id == 301
        assert file_id == 901
        assert resource_title == "测试视频资源"
        assert file_name == "project-demo.mp4"
        return {
            "resource_id": 301,
            "file_id": 901,
            "title": "真实视频理解标题",
            "topic": "真实视频主题",
            "summary": {
                "minute": "1 分钟总结",
                "three_minute": "3 分钟总结",
                "deep_dive": ["深度点 1"],
            },
            "timeline": [
                {"time": 12, "label": "背景", "detail": "背景说明"},
            ],
            "terms": [
                {"term": "术语 A", "time": 30, "alias": "Term A", "explanation": "解释", "background": "背景"},
            ],
            "subtitles": [
                {"start": 0, "end": 10, "zh": "字幕", "en": "subtitle", "corrected": "term"},
            ],
            "article_pack": {
                "article": ["图文版"],
                "notes": ["笔记版"],
                "mindmap": ["脑图版"],
            },
            "formula_hint": "公式提示",
        }

    monkeypatch.setattr(ResourceService, "get_resource", fake_get_resource)
    monkeypatch.setattr(VideoInsightService, "get_insight", fake_get_insight)

    response = client.get(
        "/api/v1/resource/301/video-insight",
        params={"file_id": 901, "file_name": "project-demo.mp4"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["file_id"] == 901
    assert body["title"] == "真实视频理解标题"
    assert body["summary"]["minute"] == "1 分钟总结"


def test_ask_video_insight_returns_payload(monkeypatch) -> None:
    async def fake_ask(self, request: VideoInsightAskRequest):
        assert request.resource_id == 301
        assert request.file_id == 901
        assert request.question == "这段在讲什么"
        assert int(request.current_time) == 78
        return {
            "answer": "这段主要在讲核心演示步骤。",
            "matched_time": 78,
        }

    monkeypatch.setattr(VideoInsightService, "ask", fake_ask)

    response = client.post(
        "/api/v1/resource/video-insight/ask",
        json={
            "resource_id": 301,
            "file_id": 901,
            "question": "这段在讲什么",
            "current_time": 78,
            "resource_title": "测试视频资源",
            "file_name": "project-demo.mp4",
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["answer"] == "这段主要在讲核心演示步骤。"
    assert body["matched_time"] == 78
