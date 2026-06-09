from pydantic import BaseModel, Field


class LearningPlanRequest(BaseModel):
    user_id: int
    course_code: str | None = None
    course_id: int | None = None
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
    resource_id: int | None = None
    resource_title: str | None = None
    source_file_id: int | None = None
    open_url: str | None = None


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
    step_id: str | None = None
    day: int
    title: str
    objective: str | None = None
    tasks: list[str] = Field(default_factory=list)
    checkpoint: str | None = None
    stage_no: int = 1
    stage_name: str | None = None
    chapter_id: int | None = None
    chapter_name: str | None = None
    section_id: int | None = None
    node_type: str = "study_task"
    status: str = "pending"
    duration_minutes: int = 45
    weak_point_focus: list[str] = Field(default_factory=list)
    knowledge_points: list[str] = Field(default_factory=list)
    recommended_resource_types: list[str] = Field(default_factory=list)
    resource_pushes: list[PlanResourcePush] = Field(default_factory=list)
    resource_ids: list[int] = Field(default_factory=list)
    resource_titles: list[str] = Field(default_factory=list)
    path_reason: str | None = None


class LearningPlanResponse(BaseModel):
    plan_id: int | None = None
    user_id: int
    course_code: str
    course_id: int | None = None
    course_name: str
    summary: str
    profile_summary: str | None = None
    progress_hint: str
    next_action: str
    risk_alerts: list[str] = Field(default_factory=list)
    path_mode: str = "laddered"
    current_stage: str | None = None
    recommended_learning_style: str | None = None
    available_resource_types: list[str] = Field(default_factory=list)
    completion_rate: float = 0.0
    dynamic_adjustments: list[str] = Field(default_factory=list)
    recommended_checkpoints: list[str] = Field(default_factory=list)
    stages: list[LearningPlanStage] = Field(default_factory=list)
    steps: list[LearningPlanStep] = Field(default_factory=list)


class PlanStepActionRequest(BaseModel):
    user_id: int


class PlanStepProgressItem(BaseModel):
    step_id: str
    status: str
    progress_note: str | None = None
    last_action: str
    updated_at: str | None = None


class PlanProgressResponse(BaseModel):
    plan_id: int
    user_id: int
    completion_rate: float
    completed_steps: int
    total_steps: int
    items: list[PlanStepProgressItem] = Field(default_factory=list)


class LearningPlanSummaryResponse(BaseModel):
    user_id: int
    total: int = 0
    average_completion_rate: float = 0.0
    by_status: dict[str, int] = Field(default_factory=dict)
    by_course: dict[str, int] = Field(default_factory=dict)
    latest_updated_at: str | None = None
