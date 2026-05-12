"""Conversation profile info extraction node."""

from __future__ import annotations

import json
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage

try:
    from langchain_openai import ChatOpenAI
except ModuleNotFoundError:  # pragma: no cover - optional runtime dependency
    ChatOpenAI = None

from app.agents.state import LearningAgentState
from app.core.config import settings

EXTRACTION_PROMPT = """你是学习画像信息提取助手。

请从对话中提取与以下六个维度相关的信息：
1. knowledge_base
2. cognitive_style
3. learning_progress
4. error_preference
5. interest_direction
6. learning_habit

输出 JSON：
{{
  "extracted_info": [
    {{
      "dimension": "维度代码",
      "info_key": "信息字段",
      "info_value": "信息内容",
      "confidence": 0.0
    }}
  ],
  "missing_dimensions": ["未覆盖维度"],
  "completeness": 0
}}

对话：
{conversation}
"""

ALL_DIMENSIONS = [
    "knowledge_base",
    "cognitive_style",
    "learning_progress",
    "error_preference",
    "interest_direction",
    "learning_habit",
]


def _store_extracted_info(state: LearningAgentState, extracted_data: dict[str, Any]) -> None:
    state["extracted_info"] = extracted_data
    state["missing_dimensions"] = extracted_data.get("missing_dimensions", ALL_DIMENSIONS)
    state["completeness"] = int(extracted_data.get("completeness", 0) or 0)


def _append_item(
    items: list[dict[str, Any]],
    *,
    dimension: str,
    info_key: str,
    info_value: str,
    confidence: float = 0.7,
) -> None:
    items.append(
        {
            "dimension": dimension,
            "info_key": info_key,
            "info_value": info_value,
            "confidence": confidence,
        }
    )


def _fallback_extract_info(messages: list[str]) -> dict[str, Any]:
    extracted_items: list[dict[str, Any]] = []

    for raw_message in messages:
        message = raw_message.strip()
        lower_message = message.lower()
        if not message:
            continue

        if any(token in lower_message for token in ["基础", "学过", "掌握", "了解", "python", "算法", "数学"]):
            _append_item(
                extracted_items,
                dimension="knowledge_base",
                info_key="background",
                info_value=message,
                confidence=0.75,
            )

        if any(token in message for token in ["视频", "文字", "实操", "练习", "讲解", "结构化"]):
            _append_item(
                extracted_items,
                dimension="cognitive_style",
                info_key="learning_preference",
                info_value=message,
                confidence=0.8,
            )

        if any(token in message for token in ["进度", "每周", "每天", "计划", "阶段", "完成"]):
            _append_item(
                extracted_items,
                dimension="learning_progress",
                info_key="current_stage",
                info_value=message,
                confidence=0.72,
            )

        if any(token in message for token in ["容易错", "混淆", "不会", "困难", "卡住", "卡在", "薄弱", "调试", "算法题"]):
            _append_item(
                extracted_items,
                dimension="error_preference",
                info_key="common_errors",
                info_value=message,
                confidence=0.82,
            )

        if any(token in message for token in ["兴趣", "喜欢", "目标", "方向", "想学", "答辩"]):
            _append_item(
                extracted_items,
                dimension="interest_direction",
                info_key="learning_motivation",
                info_value=message,
                confidence=0.74,
            )

        if any(token in message for token in ["晚上", "早上", "周末", "专注", "习惯", "频率", "节奏"]):
            _append_item(
                extracted_items,
                dimension="learning_habit",
                info_key="study_frequency",
                info_value=message,
                confidence=0.76,
            )

    present_dimensions = {item["dimension"] for item in extracted_items}
    missing_dimensions = [dimension for dimension in ALL_DIMENSIONS if dimension not in present_dimensions]
    completeness = int((len(present_dimensions) / len(ALL_DIMENSIONS)) * 100)

    return {
        "extracted_info": extracted_items,
        "missing_dimensions": missing_dimensions,
        "completeness": completeness,
    }


async def info_extractor_node(state: LearningAgentState) -> LearningAgentState:
    messages = state.get("messages", [])
    if not messages:
        _store_extracted_info(
            state,
            {
            "extracted_info": [],
            "missing_dimensions": ALL_DIMENSIONS,
            "completeness": 0,
            },
        )
        return state

    if ChatOpenAI is None:
        extracted_data = _fallback_extract_info(messages)
        _store_extracted_info(state, extracted_data)
        trace = state.get("execution_trace", [])
        trace.append(
            f"info_extractor: fallback extracted {len(extracted_data.get('extracted_info', []))} items"
        )
        state["execution_trace"] = trace
        return state

    conversation_text = "\n".join(
        [f"{'学生' if i % 2 == 0 else '助手'}: {msg}" for i, msg in enumerate(messages)]
    )

    llm = ChatOpenAI(
        model=settings.llm_model,
        temperature=0.1,
        api_key=settings.llm_api_key,
        base_url=settings.llm_base_url,
    )

    prompt_messages = [
        SystemMessage(content=EXTRACTION_PROMPT.format(conversation=conversation_text)),
        HumanMessage(content="请提取学习画像信息"),
    ]

    try:
        response = await llm.ainvoke(prompt_messages)
        content = response.content

        if "```json" in content:
            json_start = content.find("```json") + 7
            json_end = content.find("```", json_start)
            content = content[json_start:json_end].strip()
        elif "```" in content:
            json_start = content.find("```") + 3
            json_end = content.find("```", json_start)
            content = content[json_start:json_end].strip()

        extracted_data = json.loads(content)
        _store_extracted_info(state, extracted_data)
        trace = state.get("execution_trace", [])
        trace.append(
            f"info_extractor: extracted {len(extracted_data.get('extracted_info', []))} items"
        )
        state["execution_trace"] = trace
    except Exception as exc:
        fallback_data = _fallback_extract_info(messages)
        fallback_data["error"] = str(exc)
        _store_extracted_info(state, fallback_data)
        trace = state.get("execution_trace", [])
        trace.append(f"info_extractor: llm failed, fallback used - {exc}")
        state["execution_trace"] = trace

    return state


def generate_guide_question(missing_dimensions: list[str], extracted_info: dict[str, Any]) -> str:
    del extracted_info
    dimension_questions = {
        "knowledge_base": "你之前学过哪些相关知识，哪些部分最熟悉？",
        "cognitive_style": "你更喜欢视频、文字讲解，还是边做边学？",
        "learning_progress": "你现在的学习进度大概到哪里了？每周能投入多少时间？",
        "error_preference": "你最容易在哪些知识点或题型上出错？",
        "interest_direction": "你对哪些主题更感兴趣，当前最想达到什么目标？",
        "learning_habit": "你通常在什么时间学习，能连续专注多久？",
    }
    if not missing_dimensions:
        return "我已经收集到不少信息了，你还想补充哪些学习特点？"
    return dimension_questions.get(missing_dimensions[0], "可以继续说说你的学习习惯和目标。")
