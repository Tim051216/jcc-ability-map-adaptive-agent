from pydantic import BaseModel, Field


class ProfileBuildRequest(BaseModel):
    user_id: int
    dialogue: list[str] = Field(default_factory=list)
    learning_goal: str | None = None
    course_code: str | None = None


class ProfileResponse(BaseModel):
    user_id: int
    dimensions: dict
    dimension_order: list[str] = Field(default_factory=list)
    profile_tags: list[str] = Field(default_factory=list)
    recommended_resource_types: list[str] = Field(default_factory=list)
    summary: str | None = None
    version: int = 1


class ProfileTuneRequest(BaseModel):
    user_id: int
    dimensions_patch: dict = Field(default_factory=dict)
    profile_tags: list[str] | None = None
    recommended_resource_types: list[str] | None = None
    summary: str | None = None
    source_summary: str | None = None
    updated_by: str | None = None


class ProfileBehaviorFeedbackRequest(BaseModel):
    user_id: int
    activity_type: str = "learning_session"
    course_code: str | None = None
    duration_minutes: int | None = None
    completion_rate: float | None = None
    resource_usage_count: int | None = None
    weak_points: list[str] = Field(default_factory=list)
    note: str | None = None
    updated_by: str | None = None


class ProfileHistoryItem(BaseModel):
    snapshot_id: int
    user_id: int
    version: int
    summary: str | None = None
    source_summary: str | None = None
    profile_tags: list[str] = Field(default_factory=list)
    updated_at: str | None = None


class ProfileHistoryResponse(BaseModel):
    items: list[ProfileHistoryItem] = Field(default_factory=list)
    total: int = 0


class ProfileTagSummaryResponse(BaseModel):
    user_id: int
    total_snapshots: int = 0
    by_tag: dict[str, int] = Field(default_factory=dict)
    by_resource_type: dict[str, int] = Field(default_factory=dict)
    latest_updated_at: str | None = None
