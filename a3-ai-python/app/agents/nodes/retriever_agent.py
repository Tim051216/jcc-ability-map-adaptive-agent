from app.agents.state import LearningAgentState
from app.schemas.rag import RagSearchRequest
from app.services.rag_service import RagService


async def retriever_node(state: LearningAgentState) -> LearningAgentState:
    requested_outputs = state.get("requested_outputs", {})
    course_code = state.get("course_code")
    user_input = state.get("user_input", "")
    if not requested_outputs.get("need_retrieval") or not course_code or not user_input:
        state["retrieved_chunks"] = []
        state["citations"] = []
        return state

    response = await RagService().search(
        RagSearchRequest(course_code=course_code, query=user_input, top_k=4)
    )
    state["retrieved_chunks"] = [hit.model_dump() for hit in response.hits]
    state["citations"] = [citation.model_dump() for citation in response.citations]
    trace = state.get("execution_trace", [])
    trace.append(f"retriever:{len(response.hits)}")
    state["execution_trace"] = trace
    return state
