from app.agents.state import LearningAgentState


async def safety_node(state: LearningAgentState) -> LearningAgentState:
    # 这里预留安全审查、敏感内容过滤和引用完整性校验。
    if not state.get("final_answer"):
        state["final_answer"] = "当前未生成有效结果，请稍后重试。"
    trace = state.get("execution_trace", [])
    trace.append("safety")
    state["execution_trace"] = trace
    return state
