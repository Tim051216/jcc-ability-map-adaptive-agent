from pydantic import BaseModel, Field


class EvaluationRequest(BaseModel):
    user_id: int
    course_code: str
    answers: list[dict] = Field(default_factory=list)


class EvaluationResponse(BaseModel):
    overall_score: float
    strengths: list[str] = Field(default_factory=list)
    weak_points: list[str] = Field(default_factory=list)
    suggestions: list[str] = Field(default_factory=list)
