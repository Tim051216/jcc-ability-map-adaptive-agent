from types import SimpleNamespace

import pytest

from app.agents.nodes.answer_generator_agent import AnswerGeneratorAgent


def _compat_response(text: str) -> SimpleNamespace:
    return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=text))])


@pytest.mark.asyncio
async def test_generate_answer_uses_realtime_weather_and_persona_stream(monkeypatch) -> None:
    agent = AnswerGeneratorAgent()
    emitted: list[str] = []

    async def _fake_lookup(question_text: str):
        assert question_text == "今天南京天气怎么样"
        return {
            "tool": "weather",
            "location": "南京",
            "location_label": "中国 江苏 南京",
            "day_label": "今天",
            "date": "2026-06-02",
            "weather_text": "多云",
            "current_temp": 28.4,
            "high_temp": 31.0,
            "low_temp": 23.0,
            "precipitation_probability": 20,
            "reference_sources": [
                {
                    "source_type": "web",
                    "title": "Open-Meteo Weather Forecast",
                    "url": "https://open-meteo.com/",
                    "excerpt": "南京今天多云，当前 28.4°C。",
                }
            ],
        }

    async def _fake_stream(**kwargs):
        prompt = kwargs["messages"][0]["content"]
        assert "实时天气数据" in prompt
        assert "今天南京天气怎么样" in prompt
        for chunk in ["南京今天多云，", "现在 28 度左右。", "出门不用太紧张，带把伞更稳妥。"]:
            yield chunk

    async def _fake_completion(**kwargs):
        return _compat_response("南京今天多云，现在 28 度左右。出门不用太紧张，带把伞更稳妥。")

    monkeypatch.setattr(agent.realtime_tool_service, "lookup", _fake_lookup)
    monkeypatch.setattr(agent.llm_client, "chat_completion_stream", _fake_stream)
    monkeypatch.setattr(agent.llm_client, "chat_completion", _fake_completion)

    result = await agent.generate_answer(
        "今天南京天气怎么样",
        {"question_type": "通用问答", "knowledge_points": [], "difficulty_level": 1},
        persona="haibara",
        on_answer_chunk=emitted.append,
    )

    assert "南京" in result["answer_text"]
    assert "多云" in result["answer_text"]
    assert result["reference_sources"][0]["source_type"] == "web"
    assert emitted
    assert "".join(emitted) == result["answer_text"]
