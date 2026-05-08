from app.agents.state import LearningAgentState


async def profile_node(state: LearningAgentState) -> LearningAgentState:
    state["profile"] = {
        "knowledge_level": "intermediate",
        "learning_style": "interactive",
    }
    trace = state.get("execution_trace", [])
    trace.append("profile")
    state["execution_trace"] = trace
    return state
