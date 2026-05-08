import httpx

from app.agents.graph import build_learning_graph
from app.integrations.java_clients.course_client import CourseClient
from app.schemas.chat import ChatRequest, ChatResponse
from app.schemas.common import Citation


class ChatService:
    async def chat(self, request: ChatRequest) -> ChatResponse:
        course_name = None
        if request.course_code:
            try:
                course = await CourseClient().get_course_detail(int(request.course_code))
            except (ValueError, httpx.HTTPError):
                course = None
            course_name = course.name if course else None

        state = await build_learning_graph().ainvoke(
            {
                "user_id": request.user_id,
                "course_code": request.course_code,
                "course_name": course_name,
                "scene": request.scene,
                "user_input": request.message,
                "messages": [request.message],
                "execution_trace": [],
            }
        )
        citations = [Citation.model_validate(item) for item in state.get("citations", [])]
        return ChatResponse(
            answer=state.get("final_answer", "当前返回的是基础回答。"),
            citations=citations,
            intent=state.get("intent"),
            agent_trace=state.get("execution_trace", []),
            profile=state.get("profile"),
            generated_plan=state.get("plan") or None,
            generated_resources=state.get("resources", []),
            generated_evaluation=state.get("evaluation") or None,
        )
