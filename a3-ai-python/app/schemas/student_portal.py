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
