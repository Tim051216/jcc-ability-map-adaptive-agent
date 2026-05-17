from contextlib import asynccontextmanager
from types import SimpleNamespace

import pytest

from app.agents.nodes.answer_generator_agent import AnswerGeneratorAgent
from app.agents.nodes.diagram_generator_agent import DiagramGeneratorAgent
from app.agents.nodes.question_analyzer_agent import QuestionAnalyzerAgent


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

    async def fake_understand(question_text, question_images=None, image_context=None):
        assert "[图片 OCR 内容]" in question_text
        assert "x + y = 10" in question_text
        assert image_context["visual_hints"] == ["formula"]
        return {"intent": "解题方法", "core_concept": "方程", "has_formula": True}

    async def fake_classify(question_text, understanding):
        return {"question_type": "解题方法", "knowledge_points": ["方程"], "difficulty_level": 2}

    async def fake_expand(question_text, classification, course_id):
        return {"expanded_context": "补充背景", "related_concepts": ["代数"], "similar_questions": []}

    monkeypatch.setattr(agent, "_extract_image_context", fake_extract)
    monkeypatch.setattr(agent, "_understand_question", fake_understand)
    monkeypatch.setattr(agent, "_classify_question", fake_classify)
    monkeypatch.setattr(agent, "_expand_question", fake_expand)

    result = await agent.analyze_question("请分析这道题", ["https://example.com/q1.png"], 101)
    assert result["image_context"]["combined_text"] == "图1: x + y = 10"
    assert result["question_type"] == "解题方法"


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
        question_text="什么是过拟合，如何判断",
        knowledge_points=["过拟合", "模型评估"],
        course_id=1,
        has_answer=True,
    )
    answer = SimpleNamespace(
        id=22,
        answer_text="过拟合通常表现为训练集效果很好、验证集效果下降。",
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

    async def fake_embed_text(text: str) -> list[float]:
        if "过拟合" in text:
            return [1.0, 0.0]
        return [0.0, 1.0]

    monkeypatch.setattr("app.agents.nodes.answer_generator_agent.async_session_factory", fake_session_factory)
    monkeypatch.setattr(agent.embedding_service, "embed_text", fake_embed_text)

    pairs = await agent._retrieve_similar_qa_pairs(
        "请解释过拟合并说明怎么判断",
        {"knowledge_points": ["过拟合", "模型评估"]},
        course_id=1,
    )
    assert len(pairs) == 1
    assert pairs[0]["question_id"] == 11
    assert pairs[0]["score"] > 0.5


@pytest.mark.asyncio
async def test_diagram_generator_returns_structured_mermaid(monkeypatch) -> None:
    agent = DiagramGeneratorAgent()

    async def fake_should_generate(*args, **kwargs):
        return True

    async def fake_determine(*args, **kwargs):
        return "flowchart"

    async def fake_generate(*args, **kwargs):
        return "A[开始] --> B[结束]"

    async def fake_optimize(mermaid_code: str, diagram_type: str):
        return f"flowchart TD\n{mermaid_code}"

    monkeypatch.setattr(agent, "_should_generate_diagram", fake_should_generate)
    monkeypatch.setattr(agent, "_determine_diagram_type", fake_determine)
    monkeypatch.setattr(agent, "_generate_mermaid_code", fake_generate)
    monkeypatch.setattr(agent, "_optimize_diagram", fake_optimize)

    result = await agent.generate_diagram(
        "请解释训练流程",
        {"core_concept": "训练流程", "knowledge_points": ["数据准备", "模型训练"]},
        "先准备数据，再训练模型。",
    )
    assert result["diagram_types"] == ["flowchart"]
    assert result["diagrams"][0]["render_engine"] == "mermaid"
    assert result["diagrams"][0]["mermaid_code"].startswith("flowchart TD")
