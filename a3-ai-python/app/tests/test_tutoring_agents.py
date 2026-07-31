from contextlib import asynccontextmanager
from types import SimpleNamespace

import pytest

from app.agents.nodes.answer_generator_agent import AnswerGeneratorAgent
from app.agents.nodes.diagram_generator_agent import DiagramGeneratorAgent
from app.agents.nodes.question_analyzer_agent import QuestionAnalyzerAgent
from app.services.intent_tree_service import INTENT_KNOWLEDGE_BASE_QA, IntentDecision


@pytest.mark.asyncio
async def test_question_analyzer_includes_image_ocr_context(monkeypatch) -> None:
    agent = QuestionAnalyzerAgent()

    async def fake_extract(question_images):
        assert question_images == ["https://example.com/q1.png"]
        return {
            "image_count": 1,
            "combined_text": "图1: x + y = 10",
            "ocr_texts": [{"url": question_images[0], "text": "x + y = 10", "visual_hints": ["formula"]}],
            "visual_hints": ["formula"],
        }

    def fake_understand(question_text, question_images=None):
        assert "x + y = 10" in question_text
        assert question_images == ["https://example.com/q1.png"]
        return {"intent": "解题方法", "core_concept": "方程", "has_formula": True}

    def fake_classify(question_text, understanding):
        assert understanding["core_concept"] == "方程"
        return {"question_type": "解题方法", "knowledge_points": ["方程"], "difficulty_level": 2}

    async def fake_expand(question_text, classification, course_id):
        assert course_id == 101
        return {"expanded_context": "补充背景", "related_concepts": ["代数"], "similar_questions": []}

    async def fake_intent_classify(question_text, **kwargs):
        return IntentDecision(
            intent=INTENT_KNOWLEDGE_BASE_QA,
            confidence=0.91,
            route="rag_answer",
            reason="test",
            top_candidates=[{"intent": INTENT_KNOWLEDGE_BASE_QA, "score": 1.0}],
        )

    monkeypatch.setattr(agent, "_extract_image_context", fake_extract)
    monkeypatch.setattr(agent, "_heuristic_understanding", fake_understand)
    monkeypatch.setattr(agent, "_heuristic_classification", fake_classify)
    monkeypatch.setattr(agent, "_expand_question_fast", fake_expand)
    monkeypatch.setattr(agent.intent_tree, "classify", fake_intent_classify)

    result = await agent.analyze_question("请分析这道题", ["https://example.com/q1.png"], 101)

    assert result["image_context"]["combined_text"] == "图1: x + y = 10"
    assert result["question_type"] == "解题方法"
    assert result["intent"] == INTENT_KNOWLEDGE_BASE_QA


@pytest.mark.asyncio
async def test_question_analyzer_supports_data_url_image_source(monkeypatch) -> None:
    agent = QuestionAnalyzerAgent()

    monkeypatch.setattr(
        "app.agents.nodes.question_analyzer_agent.extract_text_from_base64_image",
        lambda image_source: ("流程 开始 判断 结束", "tesseract", ""),
    )

    text, hints = await agent._extract_text_from_image_source("data:image/png;base64,ZmFrZQ==")

    assert text == "流程 开始 判断 结束"
    assert "diagram" in hints


@pytest.mark.asyncio
async def test_answer_generator_retrieves_similar_qa_pairs(monkeypatch) -> None:
    agent = AnswerGeneratorAgent()

    question = SimpleNamespace(
        id=11,
        question_text="What is overfitting and how to judge a model",
        knowledge_points=["overfitting", "model"],
        course_id=1,
        has_answer=True,
    )
    answer = SimpleNamespace(
        id=22,
        answer_text="Overfitting means training performance is high but validation performance drops.",
        create_time=1,
    )

    class FakeResult:
        def all(self):
            return [(question, answer)]

    class FakeSession:
        async def execute(self, stmt):
            return FakeResult()

    @asynccontextmanager
    async def fake_session_factory():
        yield FakeSession()

    monkeypatch.setattr("app.agents.nodes.answer_generator_agent.async_session_factory", fake_session_factory)

    pairs = await agent._retrieve_similar_qa_pairs(
        "What is overfitting and how to judge a model",
        {"knowledge_points": ["overfitting", "model"]},
        course_id=1,
    )

    assert len(pairs) == 1
    assert pairs[0]["question_id"] == 11
    assert pairs[0]["score"] > 0.5


@pytest.mark.asyncio
async def test_diagram_generator_returns_structured_mermaid(monkeypatch) -> None:
    agent = DiagramGeneratorAgent()

    def fake_should_generate(*args, **kwargs):
        return True

    def fake_determine(*args, **kwargs):
        return "flowchart"

    monkeypatch.setattr(agent, "_should_generate_diagram", fake_should_generate)
    monkeypatch.setattr(agent, "_determine_diagram_type", fake_determine)

    result = await agent.generate_diagram(
        "请解释训练流程",
        {"core_concept": "训练流程", "knowledge_points": ["数据准备", "模型训练"]},
        "先准备数据，再训练模型。",
    )

    assert result["diagram_types"] == ["flowchart"]
    assert result["diagrams"][0]["render_engine"] == "mermaid"
    assert result["diagrams"][0]["mermaid_code"].startswith("flowchart TD")
