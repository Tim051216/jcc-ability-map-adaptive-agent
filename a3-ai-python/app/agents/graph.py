from langgraph.graph import END, StateGraph

from app.agents.nodes.evaluator_agent import evaluator_node
from app.agents.nodes.planner_agent import planner_node
from app.agents.nodes.profile_agent import profile_node
from app.agents.nodes.resource_agent import resource_node
from app.agents.nodes.retriever_agent import retriever_node
from app.agents.nodes.router_agent import router_node
from app.agents.nodes.safety_agent import safety_node
from app.agents.state import LearningAgentState


def _route_after_router(state: LearningAgentState) -> str:
    requested_outputs = state.get("requested_outputs", {})
    if requested_outputs.get("need_retrieval"):
        return "retriever_agent"
    if requested_outputs.get("need_plan"):
        return "planner_agent"
    if requested_outputs.get("need_resources"):
        return "resource_agent"
    return "evaluator_agent"


def _route_after_retriever(state: LearningAgentState) -> str:
    requested_outputs = state.get("requested_outputs", {})
    if requested_outputs.get("need_plan"):
        return "planner_agent"
    if requested_outputs.get("need_resources"):
        return "resource_agent"
    return "evaluator_agent"


def _route_after_planner(state: LearningAgentState) -> str:
    requested_outputs = state.get("requested_outputs", {})
    if requested_outputs.get("need_resources"):
        return "resource_agent"
    return "evaluator_agent"


def build_learning_graph():
    graph = StateGraph(LearningAgentState)
    graph.add_node("profile_agent", profile_node)
    graph.add_node("router_agent", router_node)
    graph.add_node("retriever_agent", retriever_node)
    graph.add_node("planner_agent", planner_node)
    graph.add_node("resource_agent", resource_node)
    graph.add_node("evaluator_agent", evaluator_node)
    graph.add_node("safety_agent", safety_node)

    graph.set_entry_point("profile_agent")
    graph.add_edge("profile_agent", "router_agent")
    graph.add_conditional_edges(
        "router_agent",
        _route_after_router,
        {
            "retriever_agent": "retriever_agent",
            "planner_agent": "planner_agent",
            "resource_agent": "resource_agent",
            "evaluator_agent": "evaluator_agent",
        },
    )
    graph.add_conditional_edges(
        "retriever_agent",
        _route_after_retriever,
        {
            "planner_agent": "planner_agent",
            "resource_agent": "resource_agent",
            "evaluator_agent": "evaluator_agent",
        },
    )
    graph.add_conditional_edges(
        "planner_agent",
        _route_after_planner,
        {
            "resource_agent": "resource_agent",
            "evaluator_agent": "evaluator_agent",
        },
    )
    graph.add_edge("resource_agent", "evaluator_agent")
    graph.add_edge("evaluator_agent", "safety_agent")
    graph.add_edge("safety_agent", END)
    return graph.compile()
