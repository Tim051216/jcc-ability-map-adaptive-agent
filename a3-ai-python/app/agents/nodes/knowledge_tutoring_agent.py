from app.agents.nodes.retriever_agent import retriever_node
from app.agents.nodes.router_agent import router_node
from app.agents.state import LearningAgentState
from app.services.answer_service import AnswerService


async def knowledge_tutoring_node(state: LearningAgentState) -> LearningAgentState:
    state = await router_node(state)
    state = await retriever_node(state)

    intent = state.get("intent", "qa")
    course_name = state.get("course_name") or state.get("course_code") or "当前课程"

    if intent in {"qa", "comprehensive"}:
        state["base_answer"] = await AnswerService().answer_with_context(
            question=state.get("user_input", ""),
            course_name=course_name,
            context_chunks=state.get("retrieved_chunks", []),
        )
    else:
        state["base_answer"] = ""

    trace = state.get("execution_trace", [])
    trace.append("knowledge_tutoring")
    state["execution_trace"] = trace
    return state
