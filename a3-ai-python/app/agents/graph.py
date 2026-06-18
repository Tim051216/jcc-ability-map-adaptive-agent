from langgraph.graph import END, StateGraph

from app.agents.nodes.evaluation_feedback_agent import evaluation_feedback_node
from app.agents.nodes.knowledge_tutoring_agent import knowledge_tutoring_node
from app.agents.nodes.learning_planning_agent import learning_planning_node
from app.agents.nodes.profile_agent import profile_node
from app.agents.nodes.resource_generation_agent import resource_generation_node
from app.agents.state import LearningAgentState
from app.services.agent_runtime_logging_service import AgentRuntimeLoggingService


def _build_state_payload(state: LearningAgentState) -> dict[str, object]:
    return {
        "user_id": state.get("user_id"),
        "course_code": state.get("course_code"),
        "scene": state.get("scene"),
        "message_count": len(state.get("messages", [])),
        "intent": state.get("intent"),
    }


def _with_runtime_logging(agent_name: str, node_fn):
    async def wrapped(state: LearningAgentState) -> LearningAgentState:
        logger = AgentRuntimeLoggingService()
        async with logger.track(
            agent_name=agent_name,
            start_message=f"{agent_name} started",
            success_message=f"{agent_name} completed",
            start_payload=_build_state_payload(state),
            success_payload_factory=lambda: {
                **_build_state_payload(state),
                "trace_size": len(state.get("execution_trace", [])),
            },
            error_message=f"{agent_name} failed",
        ):
            return await node_fn(state)

    return wrapped


def _route_after_profile(state: LearningAgentState) -> str:
    scene = (state.get("scene") or "").strip().lower()
    intent = (state.get("intent") or "").strip().lower()

    if scene in {"profile_only", "profile"} or intent == "profile_only":
        return "end"
    return "knowledge_tutoring_agent"


def _route_after_tutoring(state: LearningAgentState) -> str:
    requested_outputs = state.get("requested_outputs", {})
    if requested_outputs.get("need_plan"):
        return "learning_planning_agent"
    if requested_outputs.get("need_resources"):
        return "resource_generation_agent"
    return "evaluation_feedback_agent"


def _route_after_planning(state: LearningAgentState) -> str:
    requested_outputs = state.get("requested_outputs", {})
    if requested_outputs.get("need_resources"):
        return "resource_generation_agent"
    return "evaluation_feedback_agent"


def _route_after_resource_generation(state: LearningAgentState) -> str:
    return "evaluation_feedback_agent"


def _route_after_evaluation(state: LearningAgentState) -> str:
    evaluation = state.get("evaluation") or {}
    requested_outputs = state.get("requested_outputs") or {}
    overall_score = evaluation.get("overall_score")
    mastery_level = str(evaluation.get("mastery_level") or "").strip().lower()
    trace = state.get("execution_trace", [])

    if (
        requested_outputs.get("need_plan")
        and "evaluation_replan" not in trace
        and (
            (isinstance(overall_score, (int, float)) and overall_score < 75)
            or mastery_level in {"low", "weak", "needs_improvement", "待提升", "较弱"}
        )
    ):
        trace.append("evaluation_replan")
        state["execution_trace"] = trace
        return "learning_planning_agent"

    return "end"


def build_learning_graph():
    graph = StateGraph(LearningAgentState)
    graph.add_node("profile_agent", _with_runtime_logging("profile_agent", profile_node))
    graph.add_node(
        "knowledge_tutoring_agent",
        _with_runtime_logging("knowledge_tutoring_agent", knowledge_tutoring_node),
    )
    graph.add_node(
        "learning_planning_agent",
        _with_runtime_logging("learning_planning_agent", learning_planning_node),
    )
    graph.add_node(
        "resource_generation_agent",
        _with_runtime_logging("resource_generation_agent", resource_generation_node),
    )
    graph.add_node(
        "evaluation_feedback_agent",
        _with_runtime_logging("evaluation_feedback_agent", evaluation_feedback_node),
    )

    graph.set_entry_point("profile_agent")
    graph.add_conditional_edges(
        "profile_agent",
        _route_after_profile,
        {
            "knowledge_tutoring_agent": "knowledge_tutoring_agent",
            "end": END,
        },
    )
    graph.add_conditional_edges(
        "knowledge_tutoring_agent",
        _route_after_tutoring,
        {
            "learning_planning_agent": "learning_planning_agent",
            "resource_generation_agent": "resource_generation_agent",
            "evaluation_feedback_agent": "evaluation_feedback_agent",
        },
    )
    graph.add_conditional_edges(
        "learning_planning_agent",
        _route_after_planning,
        {
            "resource_generation_agent": "resource_generation_agent",
            "evaluation_feedback_agent": "evaluation_feedback_agent",
        },
    )
    graph.add_conditional_edges(
        "resource_generation_agent",
        _route_after_resource_generation,
        {
            "evaluation_feedback_agent": "evaluation_feedback_agent",
        },
    )
    graph.add_conditional_edges(
        "evaluation_feedback_agent",
        _route_after_evaluation,
        {
            "learning_planning_agent": "learning_planning_agent",
            "end": END,
        },
    )
    return graph.compile()
