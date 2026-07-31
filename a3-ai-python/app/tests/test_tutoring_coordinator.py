import pytest

from app.agents.tutoring_coordinator import TutoringCoordinator


def test_realtime_query_detects_actual_time_question() -> None:
    assert TutoringCoordinator._looks_like_realtime_query("现在几点了？", None) is True


def test_realtime_query_skips_learning_plan_language() -> None:
    assert TutoringCoordinator._looks_like_realtime_query("请给我一个本章复习顺序。", None) is False
    assert TutoringCoordinator._looks_like_realtime_query("现在我应该先复习哪一章？", None) is False


@pytest.mark.asyncio
async def test_coordinator_forwards_conversation_context_to_answer_generator(monkeypatch) -> None:
    coordinator = TutoringCoordinator()
    captured = {}

    async def fake_generate(*_args, **kwargs):
        captured.update(kwargs)
        return {"answer_text": "你好。", "reference_sources": [], "confidence_score": 95}

    monkeypatch.setattr(coordinator._answer_gen, "generate_answer", fake_generate)
    result = await coordinator.run(
        question_text="你好",
        question_images=None,
        course_id=None,
        conversation_context="用户上一轮正在询问需求分析。",
    )

    assert result["answer_text"] == "你好。"
    assert captured["conversation_context"] == "用户上一轮正在询问需求分析。"
