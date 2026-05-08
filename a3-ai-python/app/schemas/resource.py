from pydantic import BaseModel, Field

from app.schemas.common import ResourceCard


class ResourceGenerationRequest(BaseModel):
    user_id: int
    course_code: str
    knowledge_points: list[str] = Field(default_factory=list)
    resource_types: list[str] = Field(default_factory=list)


class ResourceGenerationResponse(BaseModel):
    task_id: int | None = None
    recommended_order: list[str] = Field(default_factory=list)
    resources: list[ResourceCard] = Field(default_factory=list)
