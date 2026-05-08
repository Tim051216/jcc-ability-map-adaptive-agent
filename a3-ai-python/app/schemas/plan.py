from pydantic import BaseModel, Field


class LearningPlanRequest(BaseModel):
    user_id: int
    course_code: str
    target: str
    available_days: int = 7
    daily_study_minutes: int = 45


class LearningPlanStep(BaseModel):
    day: int
    title: str
    objective: str | None = None
    tasks: list[str] = Field(default_factory=list)
    checkpoint: str | None = None


class LearningPlanResponse(BaseModel):
    user_id: int
    course_code: str
    course_name: str
    summary: str
    progress_hint: str
    next_action: str
    risk_alerts: list[str] = Field(default_factory=list)
    steps: list[LearningPlanStep] = Field(default_factory=list)
