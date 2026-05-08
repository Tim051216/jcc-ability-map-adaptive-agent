from pydantic import BaseModel, Field

from app.schemas.common import Citation


class ChatRequest(BaseModel):
    user_id: int
    message: str
    session_id: int | None = None
    course_code: str | None = None
    scene: str = Field(default="study_assistant")


class ChatResponse(BaseModel):
    session_id: int | None = None
    answer: str
    citations: list[Citation] = Field(default_factory=list)
    intent: str | None = None
    agent_trace: list[str] = Field(default_factory=list)
    profile: dict | None = None
    generated_plan: dict | None = None
    generated_resources: list[dict] = Field(default_factory=list)
    generated_evaluation: dict | None = None


class ChatTaskSubmitResponse(BaseModel):
    task_id: int
    status: str
    poll_interval_ms: int = Field(default=2000)


class ChatTaskStatusResponse(BaseModel):
    task_id: int
    status: str
    result: ChatResponse | None = None
    error_message: str | None = None
