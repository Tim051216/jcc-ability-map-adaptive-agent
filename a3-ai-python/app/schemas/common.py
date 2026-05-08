from pydantic import BaseModel, Field


class Citation(BaseModel):
    source: str
    chunk_id: int | None = None
    score: float | None = None


class ResourceCard(BaseModel):
    resource_type: str
    title: str
    summary: str
    content_markdown: str
    source_titles: list[str] = Field(default_factory=list)
    study_suggestion: str | None = None


class KnowledgeHit(BaseModel):
    chunk_id: int
    document_id: int | None = None
    title: str
    content: str
    score: float
