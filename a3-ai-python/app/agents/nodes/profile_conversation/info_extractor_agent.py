"""Conversation profile info extraction node."""

from __future__ import annotations

import json
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage

try:
    from langchain_openai import ChatOpenAI
except ModuleNotFoundError:  # pragma: no cover
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

GUIDE_PROMPT = """你是学习画像追问助手。

请基于学生刚刚的表达，生成一句自然的中文追问，用来继续完善学习画像。

要求：
1. 只输出一句追问，不要解释。
2. 问题要紧跟学生刚说过的内容，不要空泛模板化。
3. 优先补充这些缺失维度：{missing_dimensions}
4. 语气像真实老师追问。

最近对话：
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
    raw_completeness = extracted_data.get("completeness", 0)
    try:
        completeness_value = float(raw_completeness or 0)
    except (TypeError, ValueError):
        completeness_value = 0.0
    if 0 < completeness_value <= 1:
        completeness = int(round(completeness_value * 100))
    else:
        completeness = int(round(completeness_value))

    normalized_data = {
        **extracted_data,
        "completeness": max(0, min(100, completeness)),
    }
    state["extracted_info"] = normalized_data
    state["missing_dimensions"] = normalized_data.get("missing_dimensions", ALL_DIMENSIONS)
    state["completeness"] = normalized_data["completeness"]


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

        if any(token in message for token in ["容易错", "不太会", "困难", "卡住", "薄弱", "调试", "题型"]):
            _append_item(
                extracted_items,
                dimension="error_preference",
                info_key="common_errors",
                info_value=message,
                confidence=0.82,
            )

        if any(token in message for token in ["兴趣", "喜欢", "目标", "方向", "想学", "想做"]):
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

    fallback_data = _fallback_extract_info(messages)
    if ChatOpenAI is None:
        raise RuntimeError(
            "langchain_openai is required for conversational-profile info extraction"
        )

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
        content = str(response.content or "").strip()

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
        trace = state.get("execution_trace", [])
        trace.append(f"info_extractor: llm failed - {exc}")
        state["execution_trace"] = trace
        _store_extracted_info(state, fallback_data)

    return state


def generate_guide_question(missing_dimensions: list[str], extracted_info: dict[str, Any]) -> str:
    extracted_items = extracted_info.get("extracted_info", []) if isinstance(extracted_info, dict) else []
    context_hint = ""
    if extracted_items:
        latest_value = str(extracted_items[-1].get("info_value") or "").strip()
        if latest_value:
            context_hint = latest_value[:36]

    dimension_questions = {
        "knowledge_base": "我先了解一下你的基础：你之前学过哪些相关知识，哪部分最熟悉？",
        "cognitive_style": "我想确认你的学习偏好：你更喜欢视频、文字讲解，还是边做边学？",
        "learning_progress": "你现在大概学到哪里了？每周通常能投入多少时间？",
        "error_preference": "你最容易卡在哪些知识点或题型上？",
        "interest_direction": "你对哪些主题更感兴趣，当前最想达成什么目标？",
        "learning_habit": "你通常在什么时间学习，能连续专注多久？",
    }
    if not missing_dimensions:
        return "我已经收集到一些关键信息了。你还想补充哪些学习特点、薄弱点或目标？"

    question = dimension_questions.get(missing_dimensions[0], "可以继续说说你的学习习惯和目标。")
    if context_hint:
        return f"我记下了你刚提到的“{context_hint}”。{question}"
    return question


async def generate_guide_question_llm(
    messages: list[str],
    missing_dimensions: list[str],
    extracted_info: dict[str, Any],
) -> str:
    fallback_question = generate_guide_question(missing_dimensions, extracted_info)
    if ChatOpenAI is None:
        return fallback_question

    conversation_text = "\n".join(messages[-4:])
    missing_text = "、".join(missing_dimensions[:3]) if missing_dimensions else "无明显缺失维度"
    prompt = GUIDE_PROMPT.format(
        missing_dimensions=missing_text,
        conversation=conversation_text,
    )

    llm = ChatOpenAI(
        model=settings.llm_model,
        temperature=0.4,
        api_key=settings.llm_api_key,
        base_url=settings.llm_base_url,
    )
    try:
        response = await llm.ainvoke(
            [
                SystemMessage(content="你负责生成自然的画像追问句。"),
                HumanMessage(content=prompt),
            ]
        )
        content = str(response.content or "").strip()
        return content or fallback_question
    except Exception:
        return fallback_question
