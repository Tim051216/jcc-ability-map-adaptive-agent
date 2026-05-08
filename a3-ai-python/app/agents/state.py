from typing import Any, TypedDict


class LearningAgentState(TypedDict, total=False):
    user_id: int
    course_code: str | None
    course_name: str | None
    scene: str
    user_input: str
    messages: list[str]
    intent: str
    requested_outputs: dict[str, bool]
    execution_trace: list[str]
    profile: dict[str, Any]
    retrieved_chunks: list[dict[str, Any]]
    citations: list[dict[str, Any]]
    plan: dict[str, Any]
    resources: list[dict[str, Any]]
    final_answer: str
