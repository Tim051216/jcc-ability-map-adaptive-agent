from app.agents.state import LearningAgentState
from app.schemas.evaluation import EvaluationRequest
from app.services.evaluation_service import EvaluationService


async def assessment_node(state: LearningAgentState) -> LearningAgentState:
    requested_outputs = state.get("requested_outputs", {})
    if not requested_outputs.get("need_evaluation"):
        state["evaluation"] = {}
        return state

    user_id = state.get("user_id")
    course_code = state.get("course_code")
    if not user_id or not course_code:
        state["evaluation"] = {}
        return state

    evaluation = await EvaluationService().evaluate(
        EvaluationRequest(
            user_id=user_id,
            course_code=course_code,
            scene=state.get("scene"),
            profile=state.get("profile"),
            plan=state.get("plan"),
            resources=state.get("resources", []),
            resource_usage_count=len(state.get("resources", [])),
        )
    )
    state["evaluation"] = evaluation.model_dump()
    trace = state.get("execution_trace", [])
    trace.append(f"assessment:{round(evaluation.overall_score, 1)}")
    state["execution_trace"] = trace
    return state
