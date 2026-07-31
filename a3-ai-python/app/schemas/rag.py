from pydantic import BaseModel, Field

from app.schemas.common import Citation, KnowledgeHit


class RagSearchRequest(BaseModel):
    course_code: str
    query: str
    top_k: int = Field(default=5, ge=1, le=20)


class RagSearchResponse(BaseModel):
    query: str
    course_code: str
    hits: list[KnowledgeHit] = Field(default_factory=list)
    citations: list[Citation] = Field(default_factory=list)
    retrieval_mode: str = "legacy"
    vector_backend: str = "none"
    intent: str = "general"
    candidate_count: int = 0
    latency_ms: float = 0.0
