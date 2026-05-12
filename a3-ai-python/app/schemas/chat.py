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


class ChatTaskSummaryResponse(BaseModel):
    total: int = 0
    pending_count: int = 0
    failed_count: int = 0
    by_status: dict[str, int] = Field(default_factory=dict)
    latest_task_at: str | None = None


class ChatTicketCreateRequest(BaseModel):
    user_id: int
    session_id: int | None = None
    course_code: str | None = None
    title: str
    question_summary: str
    latest_answer: str | None = None
    priority: str = "normal"


class ChatTicketReplyRequest(BaseModel):
    replier_name: str
    replier_role: str = "staff"
    content: str


class ChatTicketStatusRequest(BaseModel):
    status: str


class ChatTicketReplyResponse(BaseModel):
    ticket_id: int
    reply_id: int
    replier_name: str
    replier_role: str
    content: str
    created_at: str | None = None


class ChatTicketResponse(BaseModel):
    ticket_id: int
    user_id: int
    session_id: int | None = None
    course_code: str | None = None
    title: str
    question_summary: str
    latest_answer: str | None = None
    priority: str
    status: str
    created_at: str | None = None
    updated_at: str | None = None
    replies: list[ChatTicketReplyResponse] = Field(default_factory=list)


class ChatTicketListResponse(BaseModel):
    items: list[ChatTicketResponse] = Field(default_factory=list)
    total: int = 0


class ChatTicketSummaryResponse(BaseModel):
    user_id: int | None = None
    total: int = 0
    unresolved_count: int = 0
    by_status: dict[str, int] = Field(default_factory=dict)
    by_priority: dict[str, int] = Field(default_factory=dict)
    latest_ticket_at: str | None = None
