import httpx
from pydantic import ValidationError

from app.agents.state import LearningAgentState
from app.integrations.java_clients.user_client import UserClient
from app.services.profile_builder import build_profile_payload


async def profile_node(state: LearningAgentState) -> LearningAgentState:
    try:
        user_profile = await UserClient().get_user(state["user_id"])
    except (httpx.HTTPError, ValidationError, ValueError):
        user_profile = None

    state["profile"] = build_profile_payload(
        user_id=state["user_id"],
        course_code=state.get("course_code"),
        learning_goal=state.get("user_input"),
        dialogue=state.get("messages", []),
        user_profile=user_profile,
    )
    trace = state.get("execution_trace", [])
    trace.append("profile")
    state["execution_trace"] = trace
    return state
