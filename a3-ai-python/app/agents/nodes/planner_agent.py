from app.agents.state import LearningAgentState
from app.schemas.plan import LearningPlanRequest
from app.services.plan_service import PlanService


async def planner_node(state: LearningAgentState) -> LearningAgentState:
    requested_outputs = state.get("requested_outputs", {})
    course_code = state.get("course_code")
    user_input = state.get("user_input", "")
    user_id = state.get("user_id")
    if not requested_outputs.get("need_plan"):
        state["plan"] = {}
        return state

    if not course_code or not user_id or not user_input:
        state["plan"] = {
            "summary": "当前缺少课程或问题上下文，暂不生成学习路径。",
            "steps": [],
            "stages": [],
        }
        return state

    plan = await PlanService().generate_plan(
        LearningPlanRequest(
            user_id=user_id,
            course_code=course_code,
            target=user_input,
            available_days=3,
            scene=state.get("scene"),
            profile=state.get("profile"),
        )
    )
    state["plan"] = plan.model_dump()
    trace = state.get("execution_trace", [])
    trace.append(f"planner:{len(plan.steps)}")
    state["execution_trace"] = trace
    return state
