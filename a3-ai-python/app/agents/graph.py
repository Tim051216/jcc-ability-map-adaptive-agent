from langgraph.graph import END, StateGraph

from app.agents.nodes.assessment_agent import assessment_node
from app.agents.nodes.evaluator_agent import evaluator_node
from app.agents.nodes.planner_agent import planner_node
from app.agents.nodes.profile_agent import profile_node
from app.agents.nodes.resource_agent import resource_node
from app.agents.nodes.retriever_agent import retriever_node
from app.agents.nodes.router_agent import router_node
from app.agents.nodes.safety_agent import safety_node
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


def _route_after_router(state: LearningAgentState) -> str:
    requested_outputs = state.get("requested_outputs", {})
    if requested_outputs.get("need_retrieval"):
        return "retriever_agent"
    if requested_outputs.get("need_plan"):
        return "planner_agent"
    if requested_outputs.get("need_resources"):
        return "resource_agent"
    if requested_outputs.get("need_evaluation"):
        return "assessment_agent"
    return "evaluator_agent"


def _route_after_retriever(state: LearningAgentState) -> str:
    requested_outputs = state.get("requested_outputs", {})
    if requested_outputs.get("need_plan"):
        return "planner_agent"
    if requested_outputs.get("need_resources"):
        return "resource_agent"
    if requested_outputs.get("need_evaluation"):
        return "assessment_agent"
    return "evaluator_agent"


def _route_after_planner(state: LearningAgentState) -> str:
    requested_outputs = state.get("requested_outputs", {})
    if requested_outputs.get("need_resources"):
        return "resource_agent"
    if requested_outputs.get("need_evaluation"):
        return "assessment_agent"
    return "evaluator_agent"


def _route_after_resource(state: LearningAgentState) -> str:
    requested_outputs = state.get("requested_outputs", {})
    if requested_outputs.get("need_evaluation"):
        return "assessment_agent"
    return "evaluator_agent"


def build_learning_graph():
    graph = StateGraph(LearningAgentState)
    graph.add_node("profile_agent", _with_runtime_logging("profile_agent", profile_node))
    graph.add_node("router_agent", _with_runtime_logging("router_agent", router_node))
    graph.add_node("retriever_agent", _with_runtime_logging("retriever_agent", retriever_node))
    graph.add_node("planner_agent", _with_runtime_logging("planner_agent", planner_node))
    graph.add_node("resource_agent", _with_runtime_logging("resource_agent", resource_node))
    graph.add_node("assessment_agent", _with_runtime_logging("assessment_agent", assessment_node))
    graph.add_node("evaluator_agent", _with_runtime_logging("evaluator_agent", evaluator_node))
    graph.add_node("safety_agent", _with_runtime_logging("safety_agent", safety_node))

    graph.set_entry_point("profile_agent")
    graph.add_edge("profile_agent", "router_agent")
    graph.add_conditional_edges(
        "router_agent",
        _route_after_router,
        {
            "retriever_agent": "retriever_agent",
            "planner_agent": "planner_agent",
            "resource_agent": "resource_agent",
            "assessment_agent": "assessment_agent",
            "evaluator_agent": "evaluator_agent",
        },
    )
    graph.add_conditional_edges(
        "retriever_agent",
        _route_after_retriever,
        {
            "planner_agent": "planner_agent",
            "resource_agent": "resource_agent",
            "assessment_agent": "assessment_agent",
            "evaluator_agent": "evaluator_agent",
        },
    )
    graph.add_conditional_edges(
        "planner_agent",
        _route_after_planner,
        {
            "resource_agent": "resource_agent",
            "assessment_agent": "assessment_agent",
            "evaluator_agent": "evaluator_agent",
        },
    )
    graph.add_conditional_edges(
        "resource_agent",
        _route_after_resource,
        {
            "assessment_agent": "assessment_agent",
            "evaluator_agent": "evaluator_agent",
        },
    )
    graph.add_edge("assessment_agent", "evaluator_agent")
    graph.add_edge("evaluator_agent", "safety_agent")
    graph.add_edge("safety_agent", END)
    return graph.compile()
