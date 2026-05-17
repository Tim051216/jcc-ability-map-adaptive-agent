import pytest

from app.agents.nodes.profile_conversation.conversation_graph import (
    _should_continue_conversation,
)
from app.agents.nodes.profile_conversation.info_extractor_agent import info_extractor_node
from app.agents.nodes.profile_conversation import info_extractor_agent
from app.agents.nodes.profile_conversation import profile_builder_agent
from app.agents.nodes.profile_conversation.profile_builder_agent import (
    _fallback_build_profile,
    profile_builder_node,
)


@pytest.mark.asyncio
async def test_info_extractor_syncs_completeness_to_state(monkeypatch) -> None:
    class _FakeLLM:
        def __init__(self, **kwargs):
            self.kwargs = kwargs

        async def ainvoke(self, prompt_messages):
            assert "Python 基础" in prompt_messages[0].content
            return type(
                "_Response",
                (),
                {
                    "content": (
                        '{"extracted_info":[{"dimension":"knowledge_base","info_key":"background",'
                        '"info_value":"学过 Python 基础","confidence":0.9},{"dimension":"cognitive_style",'
                        '"info_key":"learning_preference","info_value":"喜欢结构化讲解","confidence":0.9},'
                        '{"dimension":"learning_progress","info_key":"study_frequency","info_value":"每周 4 到 6 小时","confidence":0.9}],'
                        '"missing_dimensions":["error_preference","interest_direction","learning_habit"],'
                        '"completeness":50}'
                    )
                },
            )()

    monkeypatch.setattr(info_extractor_agent, "ChatOpenAI", _FakeLLM)
    state = {
        "messages": [
            "我之前学过 Python 基础，更喜欢先看结构化讲解，再做练习。",
            "目前在入门阶段，平时晚上学习，每周能投入 4 到 6 小时。",
        ],
        "execution_trace": [],
    }

    result = await info_extractor_node(state)

    assert result["completeness"] >= 50
    assert "missing_dimensions" in result
    assert result["missing_dimensions"] == result["extracted_info"]["missing_dimensions"]


@pytest.mark.asyncio
async def test_info_extractor_requires_langchain_openai() -> None:
    state = {
        "messages": ["我学过 Python 基础。"],
        "execution_trace": [],
    }

    original = info_extractor_agent.ChatOpenAI
    info_extractor_agent.ChatOpenAI = None
    try:
        with pytest.raises(RuntimeError, match="langchain_openai"):
            await info_extractor_node(state)
    finally:
        info_extractor_agent.ChatOpenAI = original


@pytest.mark.asyncio
async def test_info_extractor_llm_prompt_accepts_json_example(monkeypatch) -> None:
    class _FakeLLM:
        def __init__(self, **kwargs):
            self.kwargs = kwargs

        async def ainvoke(self, prompt_messages):
            system_text = prompt_messages[0].content
            assert "学生: 我学过 Python 基础" in system_text
            assert '"extracted_info"' in system_text
            return type(
                "_Response",
                (),
                {
                    "content": (
                        '{"extracted_info":[{"dimension":"knowledge_base","info_key":"background",'
                        '"info_value":"学过 Python 基础","confidence":0.9}],"missing_dimensions":'
                        '["cognitive_style","learning_progress","error_preference","interest_direction","learning_habit"],'
                        '"completeness":16}'
                    )
                },
            )()

    monkeypatch.setattr(info_extractor_agent, "ChatOpenAI", _FakeLLM)
    state = {
        "messages": ["我学过 Python 基础。"],
        "execution_trace": [],
    }

    result = await info_extractor_node(state)

    assert result["extracted_info"]["extracted_info"][0]["dimension"] == "knowledge_base"
    assert result["completeness"] == 16


def test_completed_session_routes_to_profile_build() -> None:
    route = _should_continue_conversation(
        {
            "session_status": "completed",
            "completeness": 66,
            "current_round": 3,
        }
    )

    assert route == "build"


def test_fallback_profile_builder_prefers_short_keywords_over_full_sentences() -> None:
    profile = _fallback_build_profile(
        [
            {
                "dimension": "knowledge_base",
                "info_key": "background",
                "info_value": "我学过 Python 基础，也做过一些自动化脚本和数据分析练习。",
                "confidence": 0.8,
            },
            {
                "dimension": "error_preference",
                "info_key": "common_errors",
                "info_value": "最近主要卡在调试和算法题分析，偶尔也会混淆一些概念。",
                "confidence": 0.8,
            },
            {
                "dimension": "interest_direction",
                "info_key": "learning_motivation",
                "info_value": "我对数据分析和自动化脚本更感兴趣，希望先打牢基础再逐步做项目。",
                "confidence": 0.8,
            },
            {
                "dimension": "learning_habit",
                "info_key": "study_frequency",
                "info_value": "平时晚上学习，每周能投入 4 到 6 小时。",
                "confidence": 0.8,
            },
        ]
    )

    assert profile["knowledge_base"]["mastered_topics"] == ["Python基础", "数据分析", "自动化脚本"]
    assert profile["error_preference"]["common_errors"] == ["调试", "算法题分析", "概念辨析"]
    assert profile["interest_direction"]["interested_areas"] == ["数据分析", "自动化脚本", "项目实践"]
    assert profile["interest_direction"]["learning_motivation"] == "先打牢基础，再逐步提升"
    assert profile["learning_habit"]["study_frequency"] == "每周约 5 小时"


@pytest.mark.asyncio
async def test_profile_builder_requires_langchain_openai() -> None:
    state = {
        "extracted_info": {
            "extracted_info": [
                {
                    "dimension": "knowledge_base",
                    "info_key": "background",
                    "info_value": "我学过 Python 基础。",
                    "confidence": 0.9,
                }
            ]
        },
        "execution_trace": [],
    }

    original = profile_builder_agent.ChatOpenAI
    profile_builder_agent.ChatOpenAI = None
    try:
        with pytest.raises(RuntimeError, match="langchain_openai"):
            await profile_builder_node(state)
    finally:
        profile_builder_agent.ChatOpenAI = original
