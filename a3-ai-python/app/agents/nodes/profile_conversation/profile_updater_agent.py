"""Conversation profile updater node."""

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

PROFILE_UPDATE_PROMPT = """你是学习画像更新助手。

请基于当前画像和新增学习行为，输出更新建议 JSON：
{
  "updated_dimensions": {},
  "new_tags": [],
  "removed_tags": [],
  "summary": ""
}

当前画像：
{current_profile}

行为数据：
{behavior_data}
"""


def _build_profile_update_prompt(
    current_profile: dict[str, Any],
    behavior_data: list[dict[str, Any]],
) -> str:
    profile_text = json.dumps(current_profile, ensure_ascii=False, indent=2)
    behavior_text = json.dumps(behavior_data, ensure_ascii=False, indent=2)
    return (
        PROFILE_UPDATE_PROMPT.replace("{current_profile}", profile_text)
        .replace("{behavior_data}", behavior_text)
    )


async def profile_updater_node(state: LearningAgentState) -> LearningAgentState:
    current_profile = state.get("profile", {})
    behavior_data = state.get("behavior_data", [])

    if not behavior_data:
        state["profile_updates"] = {
            "updated_dimensions": {},
            "new_tags": [],
            "removed_tags": [],
            "summary": "无新的学习行为数据。",
        }
        return state

    if ChatOpenAI is None:
        update_data = _fallback_update_profile(current_profile, behavior_data)
        state["profile_updates"] = update_data
        state["profile"] = apply_profile_updates(current_profile, update_data)
        trace = state.get("execution_trace", [])
        trace.append("profile_updater: fallback update applied")
        state["execution_trace"] = trace
        return state

    llm = ChatOpenAI(
        model=settings.llm_model,
        temperature=0.2,
        api_key=settings.llm_api_key,
        base_url=settings.llm_base_url,
    )
    prompt_messages = [
        SystemMessage(
            content=_build_profile_update_prompt(current_profile, behavior_data)
        ),
        HumanMessage(content="请分析并更新学习画像"),
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
        update_data = json.loads(content)
        state["profile_updates"] = update_data
        state["profile"] = apply_profile_updates(current_profile, update_data)
        trace = state.get("execution_trace", [])
        trace.append(
            f"profile_updater: updated {len(update_data.get('updated_dimensions', {}))} dimensions"
        )
        state["execution_trace"] = trace
    except Exception as exc:
        update_data = _fallback_update_profile(current_profile, behavior_data)
        update_data["error"] = str(exc)
        state["profile_updates"] = update_data
        state["profile"] = apply_profile_updates(current_profile, update_data)
        trace = state.get("execution_trace", [])
        trace.append(f"profile_updater: llm failed, fallback used - {exc}")
        state["execution_trace"] = trace

    return state


def _fallback_update_profile(
    current_profile: dict[str, Any], behavior_data: list[dict[str, Any]]
) -> dict[str, Any]:
    del current_profile
    updated_dimensions: dict[str, dict[str, Any]] = {}
    new_tags: list[str] = []

    for item in behavior_data:
        behavior_type = item.get("behavior_type")
        behavior_detail = item.get("behavior_data", {})
        impact = analyze_behavior_impact(int(behavior_type or 0), behavior_detail)
        for dimension, values in impact.get("suggested_updates", {}).items():
            updated_dimensions[dimension] = {
                "updated_fields": values,
                "reason": f"基于行为类型 {behavior_type} 自动更新",
            }
        for dimension in impact.get("affected_dimensions", []):
            if dimension == "knowledge_base":
                new_tags.append("行为驱动巩固")
            elif dimension == "interest_direction":
                new_tags.append("兴趣持续追踪")

    deduped_tags: list[str] = []
    for tag in new_tags:
        if tag not in deduped_tags:
            deduped_tags.append(tag)

    return {
        "updated_dimensions": updated_dimensions,
        "new_tags": deduped_tags,
        "removed_tags": [],
        "summary": "已根据学习行为生成基础画像更新建议。",
    }


def apply_profile_updates(
    current_profile: dict[str, Any], updates: dict[str, Any]
) -> dict[str, Any]:
    updated_profile = current_profile.copy()

    for dim_code, dim_updates in updates.get("updated_dimensions", {}).items():
        if dim_code not in updated_profile or not isinstance(updated_profile.get(dim_code), dict):
            updated_profile[dim_code] = {}
        updated_fields = dim_updates.get("updated_fields", {})
        updated_profile[dim_code].update(updated_fields)

    current_tags = set(updated_profile.get("tags", []))
    current_tags.update(updates.get("new_tags", []))
    current_tags.difference_update(updates.get("removed_tags", []))
    updated_profile["tags"] = list(current_tags)

    return updated_profile


def analyze_behavior_impact(behavior_type: int, behavior_data: dict[str, Any]) -> dict[str, Any]:
    impact = {
        "affected_dimensions": [],
        "suggested_updates": {},
    }

    if behavior_type == 1:
        impact["affected_dimensions"] = ["knowledge_base", "error_preference"]
        result = behavior_data.get("result")
        if result == "wrong":
            impact["suggested_updates"]["error_preference"] = {
                "add_error_type": behavior_data.get("question_type"),
                "add_confused_concept": behavior_data.get("knowledge_point"),
            }
        elif result == "correct":
            impact["suggested_updates"]["knowledge_base"] = {
                "add_mastered_topic": behavior_data.get("knowledge_point"),
            }
    elif behavior_type == 2:
        impact["affected_dimensions"] = ["interest_direction", "cognitive_style"]
        impact["suggested_updates"]["cognitive_style"] = {
            "update_preferred_format": behavior_data.get("resource_type"),
        }
        if behavior_data.get("duration", 0) > 300:
            impact["suggested_updates"]["interest_direction"] = {
                "add_interested_area": behavior_data.get("topic"),
            }
    elif behavior_type == 3:
        impact["affected_dimensions"] = ["learning_progress", "learning_habit"]
        impact["suggested_updates"]["learning_progress"] = {
            "update_completion_rate": behavior_data.get("completion_rate"),
            "update_current_stage": behavior_data.get("current_stage"),
        }
    elif behavior_type == 4:
        impact["affected_dimensions"] = ["cognitive_style", "interest_direction"]
        impact["suggested_updates"]["cognitive_style"] = {
            "update_thinking_style": "主动探索型",
        }

    return impact
