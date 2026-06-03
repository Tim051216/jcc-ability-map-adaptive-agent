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
    graph.add_edge("profile_agent", "knowledge_tutoring_agent")
    graph.add_edge("knowledge_tutoring_agent", "learning_planning_agent")
    graph.add_edge("learning_planning_agent", "resource_generation_agent")
    graph.add_edge("resource_generation_agent", "evaluation_feedback_agent")
    graph.add_edge("evaluation_feedback_agent", END)
    return graph.compile()
