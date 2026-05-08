from app.agents.state import LearningAgentState


def _detect_intent(scene: str, user_input: str) -> str:
    normalized_scene = (scene or "study_assistant").strip().lower()
    normalized_input = (user_input or "").strip().lower()

    if normalized_scene in {"study_plan", "plan_generation"}:
        return "study_plan"
    if normalized_scene in {"resource_generation", "resource"}:
        return "resource_generation"
    if normalized_scene in {"full_tutor", "comprehensive"}:
        return "comprehensive"

    if any(keyword in normalized_input for keyword in ["学习计划", "复习计划", "安排", "规划"]):
        return "study_plan"
    if any(keyword in normalized_input for keyword in ["讲义", "练习", "题目", "导图", "资源"]):
        return "resource_generation"
    if any(keyword in normalized_input for keyword in ["方案", "同时", "并且给出计划", "并给出资源"]):
        return "comprehensive"
    return "qa"


async def router_node(state: LearningAgentState) -> LearningAgentState:
    intent = _detect_intent(state.get("scene", "study_assistant"), state.get("user_input", ""))
    requested_outputs = {
        "need_retrieval": intent in {"qa", "study_plan", "resource_generation", "comprehensive"},
        "need_plan": intent in {"study_plan", "comprehensive"},
        "need_resources": intent in {"resource_generation", "comprehensive"},
        "need_evaluation": intent in {"study_plan", "comprehensive"},
        "need_answer": True,
    }
    state["intent"] = intent
    state["requested_outputs"] = requested_outputs
    trace = state.get("execution_trace", [])
    trace.append(f"router:{intent}")
    state["execution_trace"] = trace
    return state
