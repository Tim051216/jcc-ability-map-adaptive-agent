from pydantic import BaseModel, Field


class LearningPlanRequest(BaseModel):
    user_id: int
    course_code: str
    target: str
    available_days: int = 7
    daily_study_minutes: int = 45
    scene: str | None = None
    profile: dict | None = None


class PlanResourcePush(BaseModel):
    resource_type: str
    title: str
    reason: str
    status: str = "pending"


class LearningPlanStage(BaseModel):
    stage_no: int
    stage_name: str
    focus: str
    objective: str
    estimated_days: int
    status: str = "pending"
    recommended_resource_types: list[str] = Field(default_factory=list)
    completion_criteria: list[str] = Field(default_factory=list)


class LearningPlanStep(BaseModel):
    day: int
    title: str
    objective: str | None = None
    tasks: list[str] = Field(default_factory=list)
    checkpoint: str | None = None
    stage_no: int = 1
    stage_name: str | None = None
    node_type: str = "study_task"
    status: str = "pending"
    duration_minutes: int = 45
    weak_point_focus: list[str] = Field(default_factory=list)
    knowledge_points: list[str] = Field(default_factory=list)
    recommended_resource_types: list[str] = Field(default_factory=list)
    resource_pushes: list[PlanResourcePush] = Field(default_factory=list)


class LearningPlanResponse(BaseModel):
    user_id: int
    course_code: str
    course_name: str
    summary: str
    progress_hint: str
    next_action: str
    risk_alerts: list[str] = Field(default_factory=list)
    path_mode: str = "laddered"
    current_stage: str | None = None
    completion_rate: float = 0.0
    dynamic_adjustments: list[str] = Field(default_factory=list)
    recommended_checkpoints: list[str] = Field(default_factory=list)
    stages: list[LearningPlanStage] = Field(default_factory=list)
    steps: list[LearningPlanStep] = Field(default_factory=list)
