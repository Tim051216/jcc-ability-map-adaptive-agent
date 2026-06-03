from app.agents.nodes.resource_agent import resource_node
from app.agents.state import LearningAgentState


async def resource_generation_node(state: LearningAgentState) -> LearningAgentState:
    state = await resource_node(state)
    trace = state.get("execution_trace", [])
    trace.append("resource_generation")
    state["execution_trace"] = trace
    return state
