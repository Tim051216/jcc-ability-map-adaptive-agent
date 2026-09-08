from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.course import CourseCardResponse, LearningCourseDetailResponse
from app.schemas.evaluation import EvaluationHistoryItem, EvaluationTrendResponse
from app.schemas.plan import LearningPlanResponse
from app.schemas.profile_conversation import ProfileSummary


class PortalMetricItem(BaseModel):
    key: str
    label: str
    value: str
    note: str | None = None
    hint: str | None = None


class PortalActivityItem(BaseModel):
    id: str
    time: str
    title: str
    gain: str
    badge: str | None = None


class PortalDashboardResponse(BaseModel):
    featured_courses: list[CourseCardResponse] = Field(default_factory=list)
    current_course: LearningCourseDetailResponse | None = None
    metrics: list[PortalMetricItem] = Field(default_factory=list)
    activities: list[PortalActivityItem] = Field(default_factory=list)
    profile_summary: ProfileSummary | None = None
    latest_plan: LearningPlanResponse | None = None
    evaluation_trend: EvaluationTrendResponse | None = None
    latest_evaluations: list[EvaluationHistoryItem] = Field(default_factory=list)


class CapabilityAxisItem(BaseModel):
    label: str
    score: int
    benchmark: int
    note: str | None = None


class CapabilityAchievementItem(BaseModel):
    id: str
    title: str
    status: str


class CapabilityProfileResponse(BaseModel):
    overall_score: int
    strongest_axis: str
    axes: list[CapabilityAxisItem] = Field(default_factory=list)
    recent_activities: list[PortalActivityItem] = Field(default_factory=list)
    achievements: list[CapabilityAchievementItem] = Field(default_factory=list)
    diagnosis_summary: str
    recommendations: list[str] = Field(default_factory=list)


class StudyWeekItem(BaseModel):
    day: str
    hours: float
    focus: str


class StudyReportResponse(BaseModel):
    overall_score: int
    total_hours: float
    average_hours: float
    best_day: str
    weekly_study: list[StudyWeekItem] = Field(default_factory=list)
    metrics: list[PortalMetricItem] = Field(default_factory=list)
    diagnosis_feed: list[PortalActivityItem] = Field(default_factory=list)
    recommendations: list[str] = Field(default_factory=list)


JobGoalScene = Literal["course", "training", "competition", "internship"]
AbilityAssessmentStatus = Literal["measured", "derived", "not_assessed"]
JobCoachingStatus = Literal["planned", "in_progress", "completed", "abandoned"]
JobOutcomeStatus = Literal["insufficient_data", "baseline_only", "comparable"]
TrialParticipantRole = Literal["student", "teacher", "enterprise_mentor"]


class JobLearningGoalUpdateRequest(BaseModel):
    user_id: int = Field(default=1001, ge=1)
    course_id: int = Field(default=401, ge=1)
    student_goal: str = Field(min_length=2, max_length=200)
    goal_scene: JobGoalScene


class JobLearningGoalResponse(BaseModel):
    user_id: int
    course_id: int
    job_name: str
    student_goal: str
    goal_scene: JobGoalScene
    updated_at: str | None = None


class JobCoachingRecordCreateRequest(BaseModel):
    user_id: int = Field(default=1001, ge=1)
    course_id: int = Field(default=401, ge=1)
    source: str = Field(default="xfyun_workflow", min_length=2, max_length=32)
    user_question: str = Field(min_length=2, max_length=1000)
    advice_summary: str = Field(min_length=2, max_length=5000)
    recommended_actions: list[str] = Field(default_factory=list, max_length=10)


class JobCoachingFeedbackRequest(BaseModel):
    user_id: int = Field(default=1001, ge=1)
    status: JobCoachingStatus
    helpful: bool | None = None
    rating: int | None = Field(default=None, ge=1, le=5)
    feedback_note: str | None = Field(default=None, max_length=500)


class JobCoachingRecordResponse(BaseModel):
    id: int
    user_id: int
    course_id: int
    source: str
    user_question: str
    advice_summary: str
    recommended_actions: list[str] = Field(default_factory=list)
    status: JobCoachingStatus
    helpful: bool | None = None
    rating: int | None = None
    feedback_note: str | None = None
    created_at: str | None = None
    updated_at: str | None = None


class JobCoachingRecordListResponse(BaseModel):
    total: int
    items: list[JobCoachingRecordResponse] = Field(default_factory=list)


class JobCoachingOutcomeSummary(BaseModel):
    total: int = 0
    planned: int = 0
    in_progress: int = 0
    completed: int = 0
    abandoned: int = 0
    completion_rate: float = Field(default=0, ge=0, le=100)
    helpful_count: int = 0
    rated_count: int = 0
    average_rating: float | None = Field(default=None, ge=1, le=5)


class JobAbilityChange(BaseModel):
    code: str
    label: str
    before_score: int | None = Field(default=None, ge=0, le=100)
    after_score: int | None = Field(default=None, ge=0, le=100)
    change: int | None = None
    assessment_status: AbilityAssessmentStatus = "not_assessed"


class JobLearningOutcomeResponse(BaseModel):
    user_id: int
    course_id: int
    status: JobOutcomeStatus
    assessment_count: int = 0
    baseline_assessment_id: str | None = None
    latest_assessment_id: str | None = None
    baseline_score: float | None = Field(default=None, ge=0, le=100)
    latest_score: float | None = Field(default=None, ge=0, le=100)
    score_change: float | None = None
    ability_changes: list[JobAbilityChange] = Field(default_factory=list)
    coaching: JobCoachingOutcomeSummary = Field(
        default_factory=JobCoachingOutcomeSummary
    )
    summary: str


class JobTrialFeedbackCreateRequest(BaseModel):
    user_id: int = Field(default=1001, ge=1)
    course_id: int = Field(default=401, ge=1)
    participant_role: TrialParticipantRole
    identity_description: str = Field(min_length=2, max_length=200)
    trial_task: str = Field(min_length=2, max_length=1000)
    strengths: str = Field(min_length=2, max_length=2000)
    problems: str = Field(min_length=2, max_length=2000)
    improvement_suggestions: str = Field(min_length=2, max_length=2000)
    overall_rating: int = Field(ge=1, le=5)
    consent_to_quote: bool = False


class JobTrialFeedbackResponse(BaseModel):
    id: int
    user_id: int
    course_id: int
    participant_role: TrialParticipantRole
    identity_description: str
    trial_task: str
    strengths: str
    problems: str
    improvement_suggestions: str
    overall_rating: int
    consent_to_quote: bool
    created_at: str | None = None
    updated_at: str | None = None


class JobTrialFeedbackListResponse(BaseModel):
    total: int
    items: list[JobTrialFeedbackResponse] = Field(default_factory=list)


class JobAbilityDimension(BaseModel):
    code: str
    label: str
    score: int | None = Field(default=None, ge=0, le=100)
    benchmark: int = Field(default=70, ge=0, le=100)
    assessment_status: AbilityAssessmentStatus = "not_assessed"
    evidence: list[str] = Field(default_factory=list)


class JobWeakAbility(BaseModel):
    code: str
    label: str
    score: int | None = Field(default=None, ge=0, le=100)
    reason: str
    recommended_action: str


class JobLearningPathItem(BaseModel):
    step_id: str
    title: str
    status: str
    duration_minutes: int = 45
    ability_codes: list[str] = Field(default_factory=list)
    path_reason: str | None = None


class JobLearningResourceItem(BaseModel):
    resource_id: int | None = None
    title: str
    resource_type: str
    reason: str
    open_url: str | None = None
    ability_codes: list[str] = Field(default_factory=list)


class JobCitationItem(BaseModel):
    title: str
    locator: str | None = None
    excerpt: str | None = None
    source_type: str = "course_material"


class JobSafetyNotice(BaseModel):
    code: str
    content: str
    severity: Literal["info", "warning", "critical"] = "warning"


class JobNextAction(BaseModel):
    action_type: str
    label: str
    route: str
    reason: str


class JobLearningOverviewResponse(BaseModel):
    user_id: int
    course_id: int
    course_code: str
    course_name: str
    professional_group: str = "软件技术专业群"
    job_name: str = "软件开发工程师"
    student_goal: str
    goal_scene: JobGoalScene
    assessment_id: str | None = None
    assessment_updated_at: str | None = None
    ability_dimensions: list[JobAbilityDimension] = Field(default_factory=list)
    weak_abilities: list[JobWeakAbility] = Field(default_factory=list)
    recommended_path: list[JobLearningPathItem] = Field(default_factory=list)
    recommended_resources: list[JobLearningResourceItem] = Field(default_factory=list)
    citations: list[JobCitationItem] = Field(default_factory=list)
    safety_notices: list[JobSafetyNotice] = Field(default_factory=list)
    ai_generated: bool = False
    next_action: JobNextAction


class JobKnowledgeCatalogItem(BaseModel):
    id: str
    title: str
    ability_dimension: str
    ability_unit: str
    knowledge_point: str
    applicable_scenario: str
    common_error: str
    learning_advice: str
    safety_notice: str
    source_path: str
    source_locator: str | None = None
    task_prompt: str
    deliverable: str
    acceptance_criteria: str
    estimated_minutes: int = Field(default=30, ge=5, le=240)


class JobKnowledgeCatalogResponse(BaseModel):
    total: int
    ability_dimensions: list[str] = Field(default_factory=list)
    items: list[JobKnowledgeCatalogItem] = Field(default_factory=list)
