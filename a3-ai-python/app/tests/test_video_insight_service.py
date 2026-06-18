import pytest

from app.schemas.resource import VideoInsightAskRequest
from app.services.video_insight_service import VideoInsightService


class _FailingLLMClient:
    async def chat_completion(self, *args, **kwargs):
        raise RuntimeError("simulated llm failure")


class _StructuredLLMClient:
    async def chat_completion(self, *args, **kwargs):
        prompt = kwargs.get("messages", [{}])[0].get("content", "")
        if "严格 JSON" in prompt:
            return type(
                "Resp",
                (),
                {
                    "content": """{
                      "title": "真实视频理解标题",
                      "topic": "真实视频主题",
                      "summary": {
                        "minute": "真实 1 分钟总结",
                        "three_minute": "真实 3 分钟总结",
                        "deep_dive": ["真实深度点 1", "真实深度点 2"]
                      },
                      "timeline": [
                        {"time": 12, "label": "背景", "detail": "真实背景说明"},
                        {"time": 88, "label": "演示", "detail": "真实演示说明"}
                      ],
                      "terms": [
                        {"term": "真实术语", "time": 45, "alias": "Real Term", "explanation": "真实解释", "background": "真实背景"}
                      ],
                      "subtitles": [
                        {"start": 0, "end": 20, "zh": "真实字幕", "en": "Real subtitle", "corrected": "real term"}
                      ],
                      "article_pack": {
                        "article": ["真实图文段落"],
                        "notes": ["真实笔记"],
                        "mindmap": ["真实脑图"]
                      },
                      "formula_hint": "真实公式提示"
                    }"""
                },
            )()
        return type("Resp", (), {"content": "这段主要在讲真实演示步骤和判断依据。"})()


@pytest.mark.asyncio
async def test_video_insight_returns_fallback_when_llm_fails() -> None:
    service = VideoInsightService()
    service.llm_client = _FailingLLMClient()

    insight = await service.get_insight(
        resource_id=1,
        file_id=901,
        resource_title="测试视频",
        file_name="project-demo.mp4",
    )
    reply = await service.ask(
        VideoInsightAskRequest(
            resource_id=1,
            file_id=901,
            question="这段在讲什么",
            current_time=78,
            resource_title="测试视频",
            file_name="project-demo.mp4",
        )
    )

    assert insight.file_id == 901
    assert insight.summary.minute
    assert len(insight.timeline) >= 2
    assert "这一段" in reply.answer or "当前大约在" in reply.answer


@pytest.mark.asyncio
async def test_video_insight_prefers_llm_structured_output() -> None:
    service = VideoInsightService()
    service.llm_client = _StructuredLLMClient()

    insight = await service.get_insight(
        resource_id=1,
        file_id=901,
        resource_title="测试视频",
        file_name="project-demo.mp4",
    )
    reply = await service.ask(
        VideoInsightAskRequest(
            resource_id=1,
            file_id=901,
            question="这段在讲什么",
            current_time=88,
            resource_title="测试视频",
            file_name="project-demo.mp4",
        )
    )

    assert insight.title == "真实视频理解标题"
    assert insight.topic == "真实视频主题"
    assert insight.summary.minute == "真实 1 分钟总结"
    assert insight.timeline[0].label == "背景"
    assert insight.terms[0].term == "真实术语"
    assert reply.answer == "这段主要在讲真实演示步骤和判断依据。"


@pytest.mark.asyncio
async def test_video_insight_formula_question_uses_formula_fallback() -> None:
    service = VideoInsightService()
    service.llm_client = _FailingLLMClient()

    reply = await service.ask(
        VideoInsightAskRequest(
            resource_id=1,
            file_id=901,
            question="作者刚才提到的公式是什么",
            current_time=126,
            resource_title="测试视频",
            file_name="project-demo.mp4",
        )
    )

    assert reply.matched_time == 126
    assert "规则" in reply.answer or "公式" in reply.answer


@pytest.mark.asyncio
async def test_video_insight_term_question_uses_term_fallback() -> None:
    service = VideoInsightService()
    service.llm_client = _FailingLLMClient()

    reply = await service.ask(
        VideoInsightAskRequest(
            resource_id=1,
            file_id=901,
            question="这个术语什么意思",
            current_time=210,
            resource_title="测试视频",
            file_name="project-demo.mp4",
        )
    )

    assert reply.matched_time == 210
    assert "当前最相关的术语是" in reply.answer
