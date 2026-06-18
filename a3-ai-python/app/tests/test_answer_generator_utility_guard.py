import pytest

from app.agents.nodes.answer_generator_agent import AnswerGeneratorAgent


@pytest.mark.asyncio
async def test_generate_answer_returns_time_only_for_explicit_time_question() -> None:
    agent = AnswerGeneratorAgent()

    result = await agent.generate_answer(
        "现在几点了？",
        {"question_type": "通用问答", "knowledge_points": [], "difficulty_level": 1},
        persona="haibara",
    )

    assert "现在是" in result["answer_text"]
    assert result["confidence_score"] == 99.0


def test_utility_question_detection_excludes_learning_planning_question() -> None:
    analysis = {"question_type": "通用问答", "knowledge_points": [], "difficulty_level": 1}

    assert not AnswerGeneratorAgent._is_utility_question("请给我一个本章复习顺序。", analysis)
    assert not AnswerGeneratorAgent._is_utility_question("现在我应该先复习哪一章？", analysis)


def test_fallback_answer_for_learning_planning_question_is_not_time() -> None:
    agent = AnswerGeneratorAgent()
    analysis = {"question_type": "通用问答", "knowledge_points": [], "difficulty_level": 1}

    result = agent._build_fallback_answer(
        "请给我一个本章复习顺序。",
        analysis,
        {"retrieved_chunks": []},
    )

    assert "现在是 " not in result
