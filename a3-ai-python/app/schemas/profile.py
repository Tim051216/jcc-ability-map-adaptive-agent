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
