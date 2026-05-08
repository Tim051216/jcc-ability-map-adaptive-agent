from pydantic import BaseModel, Field


class EvaluationRequest(BaseModel):
    user_id: int
    course_code: str
    answers: list[dict] = Field(default_factory=list)
    scene: str | None = None
    profile: dict | None = None
    plan: dict | None = None
    resources: list[dict] = Field(default_factory=list)
    learning_duration_minutes: int | None = None
    resource_usage_count: int | None = None


class EvaluationMetric(BaseModel):
    metric_name: str
    score: float
    comment: str


class EvaluationLayerResult(BaseModel):
    level: str
    score: float
    status: str
    comment: str


class EvaluationResponse(BaseModel):
    overall_score: float
    evaluation_type: str = "diagnostic"
    mastery_level: str = "developing"
    report_summary: str = ""
    strengths: list[str] = Field(default_factory=list)
    weak_points: list[str] = Field(default_factory=list)
    suggestions: list[str] = Field(default_factory=list)
    layered_results: list[EvaluationLayerResult] = Field(default_factory=list)
    metrics: list[EvaluationMetric] = Field(default_factory=list)
    knowledge_points: list[str] = Field(default_factory=list)
    recommended_actions: list[str] = Field(default_factory=list)
    path_feedback: dict = Field(default_factory=dict)
    profile_feedback: dict = Field(default_factory=dict)
