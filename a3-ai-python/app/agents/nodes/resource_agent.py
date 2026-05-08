from app.agents.state import LearningAgentState
from app.schemas.resource import ResourceGenerationRequest
from app.services.resource_service import ResourceService


async def resource_node(state: LearningAgentState) -> LearningAgentState:
    requested_outputs = state.get("requested_outputs", {})
    course_code = state.get("course_code")
    user_input = state.get("user_input", "")
    user_id = state.get("user_id")
    if not requested_outputs.get("need_resources"):
        state["resources"] = []
        return state

    if not course_code or not user_id:
        state["resources"] = []
        return state

    response = await ResourceService().generate_resources(
        ResourceGenerationRequest(
            user_id=user_id,
            course_code=course_code,
            knowledge_points=[user_input] if user_input else [],
            resource_types=["lecture_note", "quiz_set"],
        )
    )
    state["resources"] = [resource.model_dump() for resource in response.resources]
    trace = state.get("execution_trace", [])
    trace.append(f"resource:{len(response.resources)}")
    state["execution_trace"] = trace
    return state
