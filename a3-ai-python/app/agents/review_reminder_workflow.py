from __future__ import annotations

from functools import lru_cache
from typing import Any, TypedDict

from langgraph.graph import END, StateGraph

from app.services.agent_runtime_logging_service import AgentRuntimeLoggingService


class ReviewReminderState(TypedDict, total=False):
    user_id: int
    course_id: int
    section_index: int
    total_watched_seconds: int
    completed_sections: list[int]
    latest_score: float | None
    improvement: float | None
    focus_knowledge_points: list[str]
    favorite_resource_type: str | None
    base_summary: str
    review_cards: list[dict[str, Any]]
    review_spacing_hours: int
    prioritized_focus: str | None
    summary: str
    cards: list[dict[str, Any]]
    execution_trace: list[str]


def _workflow_payload(state: ReviewReminderState) -> dict[str, Any]:
    return {
        "user_id": state.get("user_id"),
        "course_id": state.get("course_id"),
        "section_index": state.get("section_index"),
        "card_count": len(state.get("review_cards", [])),
        "watched_seconds": state.get("total_watched_seconds"),
    }


def _with_runtime_logging(node_name: str, node_fn):
    async def wrapped(state: ReviewReminderState) -> ReviewReminderState:
        logger = AgentRuntimeLoggingService()
        async with logger.track(
            agent_name=f"review_reminder_{node_name}",
            start_message=f"review_reminder_{node_name} started",
            success_message=f"review_reminder_{node_name} completed",
            start_payload=_workflow_payload(state),
            success_payload_factory=lambda: {
                **_workflow_payload(state),
                "trace_size": len(state.get("execution_trace", [])),
            },
            error_message=f"review_reminder_{node_name} failed",
        ):
            return await node_fn(state)

    return wrapped


async def gather_review_context_node(state: ReviewReminderState) -> ReviewReminderState:
    watched_seconds = int(state.get("total_watched_seconds", 0) or 0)
    focus_points = list(state.get("focus_knowledge_points") or [])
    review_spacing_hours = 12 if watched_seconds < 1200 else 6
    prioritized_focus = focus_points[0] if focus_points else None
    return {
        **state,
        "review_spacing_hours": review_spacing_hours,
        "prioritized_focus": prioritized_focus,
        "execution_trace": [*state.get("execution_trace", []), "gather_review_context"],
    }


async def prioritize_review_cards_node(state: ReviewReminderState) -> ReviewReminderState:
    spacing = int(state.get("review_spacing_hours", 12) or 12)
    prioritized_focus = state.get("prioritized_focus")
    cards: list[dict[str, Any]] = []
    for index, raw_card in enumerate(state.get("review_cards", [])):
        card = dict(raw_card)
        card["next_review_in_hours"] = spacing * (index + 1)
        if index == 0 and prioritized_focus:
            card["prompt"] = f"{card['prompt']}（重点：{prioritized_focus}）"
        cards.append(card)
    return {
        **state,
        "cards": cards,
        "execution_trace": [*state.get("execution_trace", []), "prioritize_review_cards"],
    }


async def compose_review_plan_node(state: ReviewReminderState) -> ReviewReminderState:
    summary_parts = [str(state.get("base_summary") or "").strip()]
    completed_sections = state.get("completed_sections") or []
    latest_score = state.get("latest_score")
    improvement = state.get("improvement")
    favorite_resource_type = state.get("favorite_resource_type")

    if completed_sections:
        summary_parts.append(f"已完成 {len(completed_sections)} 个学习片段，建议优先回看最近卡住的知识点。")
    if latest_score is not None:
        summary_parts.append(f"最近一次测评分数为 {latest_score:g} 分。")
    if improvement is not None:
        trend_text = "较上次提升" if improvement >= 0 else "较上次回落"
        summary_parts.append(f"{trend_text} {abs(improvement):g} 分。")
    if favorite_resource_type:
        summary_parts.append(f"你最近更偏好 {favorite_resource_type} 类型资源，可搭配对应讲义复习。")

    summary = " ".join(part for part in summary_parts if part)
    return {
        **state,
        "summary": summary,
        "execution_trace": [*state.get("execution_trace", []), "compose_review_plan"],
    }


@lru_cache(maxsize=1)
def build_review_reminder_workflow():
    graph = StateGraph(ReviewReminderState)
    graph.add_node("gather_review_context", _with_runtime_logging("gather_review_context", gather_review_context_node))
    graph.add_node("prioritize_review_cards", _with_runtime_logging("prioritize_review_cards", prioritize_review_cards_node))
    graph.add_node("compose_review_plan", _with_runtime_logging("compose_review_plan", compose_review_plan_node))
    graph.set_entry_point("gather_review_context")
    graph.add_edge("gather_review_context", "prioritize_review_cards")
    graph.add_edge("prioritize_review_cards", "compose_review_plan")
    graph.add_edge("compose_review_plan", END)
    return graph.compile()
