from datetime import datetime
from pydantic import BaseModel, Field


class SkillTrend(BaseModel):
    name: str
    current: int = Field(ge=0)
    previous: int = Field(ge=0)
    match: int = Field(ge=0, le=100)
    growth: int


class IndustryAnalysisResponse(BaseModel):
    professional_group: str
    core_job: str
    collected_at: datetime
    collection_mode: str
    source_urls: list[str]
    sample_count: int = Field(ge=0)
    fetched_count: int = Field(default=0, ge=0)
    skills: list[SkillTrend]
    trend_months: list[str] = Field(default_factory=list)
    trend_series: dict[str, list[int]] = Field(default_factory=dict)
    trend_source: str = "normalized-interpolation"
    history_count: int = Field(default=0, ge=0)
    history_span_days: int = Field(default=0, ge=0)
    alerts: list[dict[str, str]]
    recommendations: list[str]
    optimization_plan: list[dict[str, str]] = Field(default_factory=list)
    ai_generated: bool = False
    safety_notice: str


class ProfessionalGroupMonitor(BaseModel):
    professional_group: str
    core_job: str
    sample_count: int = Field(ge=0)
    average_match: int = Field(ge=0, le=100)
    leading_skill: str
    leading_growth: int
    alert_count: int = Field(ge=0)
    collection_mode: str


class ProfessionalGroupsMonitorResponse(BaseModel):
    collected_at: datetime
    items: list[ProfessionalGroupMonitor]
    safety_notice: str


class JobSnapshotRecord(BaseModel):
    collected_at: datetime
    professional_group: str
    core_job: str
    source_urls: list[str]
    skill_summary: list[SkillTrend]


class JobSnapshotHistoryResponse(BaseModel):
    items: list[JobSnapshotRecord] = Field(default_factory=list)
    safety_notice: str


class LearningTaskRequest(BaseModel):
    work_task: str = Field(min_length=2, max_length=200)
    job_name: str = "新能源汽车维修技师"
    professional_group: str = Field(default="软件技术专业群", max_length=80)
    industry_context: str = Field(default="", max_length=500)
    ability_focus: list[str] = Field(default_factory=list, max_length=12)


class LearningResourceLink(BaseModel):
    name: str
    href: str
    resource_type: str = "校内资源"


class LearningTaskResponse(BaseModel):
    task_id: str
    task_name: str
    task_description: str
    work_context: str
    learning_objectives: list[str]
    steps: list[str]
    safety_points: list[str]
    knowledge_points: list[str]
    skill_points: list[str]
    deliverables: list[str]
    acceptance_criteria: list[str]
    resources: list[LearningResourceLink]
    citations: list[str]
    ai_generated: bool = False
    generation_mode: str = "rule-template"


class JobAbilityRequest(BaseModel):
    job_name: str = Field(min_length=2, max_length=100)
    professional_group: str = Field(default="软件技术专业群", max_length=80)
    observed_skills: list[str] = Field(default_factory=list, max_length=20)
    typical_tasks: list[str] = Field(default_factory=list, max_length=12)


class JobAbilityNode(BaseModel):
    name: str
    score: int = Field(ge=0, le=100)
    related_tasks: list[str] = Field(default_factory=list)
    ability_units: list[str]
    skill_points: list[str]
    knowledge_points: list[str]


class JobAbilityResponse(BaseModel):
    job_name: str
    industry_chain: str
    job_group: str
    typical_tasks: list[str]
    abilities: list[JobAbilityNode]
    citations: list[str]
    ai_generated: bool = False
    generation_mode: str = "rule-template"


class AdaptiveLearningRequest(BaseModel):
    goal: str = Field(min_length=2, max_length=200)
    goal_scene: str = Field(default="internship", max_length=40)
    job_name: str = Field(default="软件开发工程师", max_length=100)
    assessment_scores: dict[str, int] = Field(default_factory=dict)
    ability_labels: dict[str, str] = Field(default_factory=dict)
    completed_skills: list[str] = Field(default_factory=list)


class AdaptiveWeakArea(BaseModel):
    code: str
    label: str
    score: int = Field(ge=0, le=100)
    reason: str


class AdaptiveNextStep(BaseModel):
    title: str
    kind: str
    description: str
    resource: str
    unlock_condition: str


class AdaptiveLearningResponse(BaseModel):
    goal: str
    goal_scene: str
    job_name: str
    diagnostic_summary: str
    weak_areas: list[AdaptiveWeakArea]
    next_steps: list[AdaptiveNextStep]
    progress: int = Field(ge=0, le=100)
    badges: list[str]
    ai_generated: bool = False
    safety_notice: str
