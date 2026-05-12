"""Conversation profile builder node."""

from __future__ import annotations

import json
import re
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage

try:
    from langchain_openai import ChatOpenAI
except ModuleNotFoundError:  # pragma: no cover - optional runtime dependency
    ChatOpenAI = None

from app.agents.state import LearningAgentState
from app.core.config import settings

PROFILE_BUILDING_PROMPT = """你是学习画像建模助手。

基于提取到的信息，构建六维学习画像：
- knowledge_base
- cognitive_style
- learning_progress
- error_preference
- interest_direction
- learning_habit

并输出 tags 与 summary。

提取信息：
{extracted_info}
"""


def _empty_profile(summary: str) -> dict[str, Any]:
    return {
        "knowledge_base": None,
        "cognitive_style": None,
        "learning_progress": None,
        "error_preference": None,
        "interest_direction": None,
        "learning_habit": None,
        "tags": [],
        "summary": summary,
    }


def _collect_values(extracted_items: list[dict[str, Any]], dimension: str) -> list[str]:
    return [
        str(item.get("info_value", "")).strip()
        for item in extracted_items
        if item.get("dimension") == dimension and str(item.get("info_value", "")).strip()
    ]


def _extract_topic_keywords(values: list[str]) -> list[str]:
    topic_map = {
        "python": "Python基础",
        "数据分析": "数据分析",
        "自动化": "自动化脚本",
        "算法": "算法题分析",
        "调试": "调试能力",
        "项目": "项目实践",
    }
    topics: list[str] = []
    for raw_value in values:
        lower_value = raw_value.lower()
        for token, label in topic_map.items():
            haystack = lower_value if token == "python" else raw_value
            if token in haystack and label not in topics:
                topics.append(label)
    return topics


def _unique_preserve_order(values: list[str]) -> list[str]:
    deduped: list[str] = []
    for value in values:
        normalized = str(value).strip()
        if normalized and normalized not in deduped:
            deduped.append(normalized)
    return deduped


def _trim_phrase(value: str, limit: int = 18) -> str:
    text = re.sub(r"[，。；：、,.!?！？]+$", "", str(value).strip())
    if not text:
        return ""
    return text if len(text) <= limit else text[:limit].rstrip()


def _extract_short_sentences(values: list[str], *, limit: int = 2, max_length: int = 18) -> list[str]:
    snippets: list[str] = []
    for raw_value in values:
        parts = re.split(r"[，。；：、,.!?！？\n]+", str(raw_value))
        for part in parts:
            candidate = _trim_phrase(part, max_length)
            if len(candidate) >= 2:
                snippets.append(candidate)
    return _unique_preserve_order(snippets)[:limit]


def _build_learning_preference_summary(values: list[str]) -> str:
    joined = " ".join(values)
    parts: list[str] = []
    if "结构化" in joined:
        parts.append("先看结构化讲解")
    if "文字" in joined:
        parts.append("偏好文字讲解")
    if "视频" in joined:
        parts.append("可接受视频辅助")
    if "练习" in joined or "实操" in joined:
        parts.append("再通过练习巩固")
    return "，".join(parts) if parts else "偏好先理解再练习"


def _build_background_summary(values: list[str]) -> str:
    topics = _extract_topic_keywords(values)
    joined = " ".join(values)
    level = "有一定基础" if any(token in joined.lower() for token in ["学过", "基础", "掌握", "python"]) else "仍在摸索阶段"
    if topics:
        return f"{level}，接触过{'、'.join(topics[:3])}"
    return level


def _build_mastered_topics(values: list[str]) -> list[str]:
    topics = _extract_topic_keywords(values)
    return topics[:4] or _extract_short_sentences(values, limit=3, max_length=12) or ["Python基础"]


def _extract_stage(values: list[str]) -> str:
    joined = " ".join(values)
    if "入门" in joined:
        return "入门阶段"
    if "基础" in joined:
        return "基础阶段"
    if "进阶" in joined:
        return "进阶阶段"
    if "项目" in joined:
        return "项目实践阶段"
    return "基础阶段"


def _extract_weekly_hours(values: list[str], default: int = 6) -> int:
    for raw_value in values:
        ranged = re.search(r"(\d+)\s*(?:到|-|~|至)\s*(\d+)\s*小时", raw_value)
        if ranged:
            low, high = int(ranged.group(1)), int(ranged.group(2))
            return max(1, int((low + high) / 2))
        single = re.search(r"(\d+)\s*小时", raw_value)
        if single:
            return max(1, int(single.group(1)))
    return default


def _extract_time_preference(values: list[str]) -> str:
    joined = " ".join(values)
    if "晚上" in joined:
        return "晚上"
    if "早上" in joined:
        return "早上"
    if "周末" in joined:
        return "周末"
    return "时间灵活"


def _extract_learning_pace(values: list[str]) -> str:
    joined = " ".join(values)
    if "慢慢" in joined or "打牢" in joined or "稳" in joined:
        return "稳步"
    if "尽快" in joined or "冲刺" in joined:
        return "紧凑"
    return "中等"


def _extract_weak_point_keywords(values: list[str]) -> list[str]:
    keyword_map = {
        "调试": "调试",
        "算法题": "算法题分析",
        "算法": "算法基础",
        "概念": "概念辨析",
        "粗心": "审题粗心",
    }
    keywords: list[str] = []
    for raw_value in values:
        for token, label in keyword_map.items():
            if token == "算法" and "算法题" in raw_value:
                continue
            if token in raw_value and label not in keywords:
                keywords.append(label)
    return keywords


def _build_error_labels(values: list[str]) -> list[str]:
    labels = _extract_weak_point_keywords(values)
    return labels[:3] or _extract_short_sentences(values, limit=2, max_length=12) or ["调试易卡点"]


def _build_interest_topics(values: list[str]) -> list[str]:
    topics = _extract_topic_keywords(values)
    return topics[:4] or _extract_short_sentences(values, limit=3, max_length=12)


def _build_motivation_summary(values: list[str]) -> str:
    joined = " ".join(values)
    if "打牢基础" in joined or "基础" in joined:
        return "先打牢基础，再逐步提升"
    if "项目" in joined:
        return "希望尽快进入项目实战"
    if "答辩" in joined or "展示" in joined:
        return "希望提升表达与展示效果"
    snippets = _extract_short_sentences(values, limit=1, max_length=20)
    return snippets[0] if snippets else "希望持续提升"


def _build_target_level(values: list[str]) -> str:
    joined = " ".join(values)
    if "项目" in joined:
        return "能独立完成基础项目"
    if "基础" in joined:
        return "先完成基础阶段巩固"
    if "进阶" in joined:
        return "逐步进入进阶阶段"
    return "希望持续提升"


def _build_study_frequency(progress_values: list[str], habit_values: list[str], weekly_hours: int) -> str:
    joined = " ".join([*progress_values, *habit_values])
    if "每天" in joined:
        return "尽量每天学习"
    if "周末" in joined:
        return "工作日零散，周末集中"
    return f"每周约 {weekly_hours} 小时"


def _fallback_build_profile(extracted_items: list[dict[str, Any]]) -> dict[str, Any]:
    knowledge_values = _collect_values(extracted_items, "knowledge_base")
    cognitive_values = _collect_values(extracted_items, "cognitive_style")
    progress_values = _collect_values(extracted_items, "learning_progress")
    error_values = _collect_values(extracted_items, "error_preference")
    interest_values = _collect_values(extracted_items, "interest_direction")
    habit_values = _collect_values(extracted_items, "learning_habit")

    profile = _empty_profile("已根据对话生成基础学习画像。")
    if knowledge_values:
        profile["knowledge_base"] = {
            "mastered_topics": _build_mastered_topics(knowledge_values),
            "weak_areas": _extract_weak_point_keywords(error_values)[:3] if error_values else [],
            "background": _build_background_summary(knowledge_values),
            "level": "中级" if len(knowledge_values) > 1 else "初级",
        }
    if cognitive_values:
        preferred_format = []
        joined = " ".join(cognitive_values)
        if "视频" in joined:
            preferred_format.append("视频")
        if "文字" in joined or "结构化" in joined:
            preferred_format.append("文字")
        if "实操" in joined or "练习" in joined:
            preferred_format.append("实操")
        profile["cognitive_style"] = {
            "learning_preference": [_build_learning_preference_summary(cognitive_values)],
            "thinking_style": "先理解框架，再通过练习巩固",
            "comprehension_speed": "中",
            "preferred_format": preferred_format or ["文字"],
        }
    if progress_values:
        weekly_hours = _extract_weekly_hours(progress_values)
        profile["learning_progress"] = {
            "current_stage": _extract_stage(progress_values),
            "completion_rate": min(90, max(20, len(progress_values) * 20)),
            "learning_pace": _extract_learning_pace(progress_values),
            "weekly_hours": weekly_hours,
        }
    if error_values:
        weak_points = _build_error_labels(error_values)
        profile["error_preference"] = {
            "common_errors": weak_points,
            "confused_concepts": weak_points[:2],
            "attention_points": weak_points[:2] or ["需要针对性复盘"],
        }
    if interest_values:
        interest_topics = _build_interest_topics(interest_values)
        profile["interest_direction"] = {
            "interested_areas": interest_topics,
            "learning_motivation": _build_motivation_summary(interest_values),
            "target_level": _build_target_level(interest_values),
            "career_goal": None,
        }
    if habit_values:
        weekly_hours = _extract_weekly_hours(habit_values, default=6)
        profile["learning_habit"] = {
            "best_time": _extract_time_preference(habit_values),
            "focus_duration": 45,
            "study_frequency": _build_study_frequency(progress_values, habit_values, weekly_hours),
            "study_pattern": "分散学习",
        }

    profile["tags"] = generate_profile_tags(profile)
    filled_dimensions = sum(
        1
        for key in [
            "knowledge_base",
            "cognitive_style",
            "learning_progress",
            "error_preference",
            "interest_direction",
            "learning_habit",
        ]
        if profile.get(key)
    )
    profile["summary"] = f"已覆盖 {filled_dimensions} 个画像维度，适合继续通过对话和行为数据逐步完善。"
    return profile


async def profile_builder_node(state: LearningAgentState) -> LearningAgentState:
    extracted_info = state.get("extracted_info", {})
    extracted_items = extracted_info.get("extracted_info", [])

    if not extracted_items:
        state["built_profile"] = _empty_profile("画像信息不足，需要更多对话。")
        return state

    if ChatOpenAI is None:
        profile_data = _fallback_build_profile(extracted_items)
        state["built_profile"] = profile_data
        trace = state.get("execution_trace", [])
        trace.append(f"profile_builder: fallback built profile with {len(profile_data.get('tags', []))} tags")
        state["execution_trace"] = trace
        return state

    llm = ChatOpenAI(
        model=settings.llm_model,
        temperature=0.3,
        api_key=settings.llm_api_key,
        base_url=settings.llm_base_url,
    )
    info_text = json.dumps(extracted_items, ensure_ascii=False, indent=2)
    prompt_messages = [
        SystemMessage(content=PROFILE_BUILDING_PROMPT.format(extracted_info=info_text)),
        HumanMessage(content="请构建学习画像"),
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
        profile_data = json.loads(content)
        state["built_profile"] = profile_data
        trace = state.get("execution_trace", [])
        trace.append(f"profile_builder: built profile with {len(profile_data.get('tags', []))} tags")
        state["execution_trace"] = trace
    except Exception as exc:
        fallback_data = _fallback_build_profile(extracted_items)
        fallback_data["error"] = str(exc)
        state["built_profile"] = fallback_data
        trace = state.get("execution_trace", [])
        trace.append(f"profile_builder: llm failed, fallback used - {exc}")
        state["execution_trace"] = trace

    return state


def calculate_profile_completeness(profile: dict[str, Any]) -> int:
    dimensions = [
        "knowledge_base",
        "cognitive_style",
        "learning_progress",
        "error_preference",
        "interest_direction",
        "learning_habit",
    ]
    filled_count = 0
    for dimension in dimensions:
        dim_data = profile.get(dimension)
        if not dim_data:
            continue
        if isinstance(dim_data, dict):
            has_content = any(value not in (None, "", []) for value in dim_data.values())
            if has_content:
                filled_count += 1
        else:
            filled_count += 1
    return int((filled_count / len(dimensions)) * 100)


def generate_profile_tags(profile: dict[str, Any]) -> list[str]:
    tags: list[str] = []

    knowledge_base = profile.get("knowledge_base", {})
    if isinstance(knowledge_base, dict):
        level = knowledge_base.get("level")
        if level:
            tags.append(f"{level}学习者")

    cognitive_style = profile.get("cognitive_style", {})
    if isinstance(cognitive_style, dict):
        for item in cognitive_style.get("preferred_format", [])[:2]:
            tags.append(f"{item}学习")

    learning_progress = profile.get("learning_progress", {})
    if isinstance(learning_progress, dict):
        pace = learning_progress.get("learning_pace")
        if pace:
            tags.append(f"{pace}节奏")

    interest_direction = profile.get("interest_direction", {})
    if isinstance(interest_direction, dict):
        for item in interest_direction.get("interested_areas", [])[:3]:
            if isinstance(item, str) and len(item) <= 16:
                tags.append(item)

    learning_habit = profile.get("learning_habit", {})
    if isinstance(learning_habit, dict):
        pattern = learning_habit.get("study_pattern")
        if pattern:
            tags.append(pattern if str(pattern).endswith("学习") else f"{pattern}学习")

    deduped: list[str] = []
    for tag in tags:
        if tag and tag not in deduped:
            deduped.append(tag)
    return deduped[:10]
