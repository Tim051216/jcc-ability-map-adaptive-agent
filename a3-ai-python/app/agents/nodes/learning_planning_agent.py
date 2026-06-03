from app.agents.nodes.planner_agent import planner_node
from app.agents.state import LearningAgentState


async def learning_planning_node(state: LearningAgentState) -> LearningAgentState:
    state = await planner_node(state)
    trace = state.get("execution_trace", [])
    trace.append("learning_planning")
    state["execution_trace"] = trace
    return state
