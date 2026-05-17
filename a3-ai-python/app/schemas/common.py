from pydantic import BaseModel, Field


class Citation(BaseModel):
    source: str
    chunk_id: int | None = None
    score: float | None = None


class ResourceSourceFileRef(BaseModel):
    file_id: int
    display_name: str
    relative_path: str
    top_level_category: str
    file_extension: str
    mime_type: str | None = None
    file_size: int | None = None
    preview_text: str | None = None
    is_inline_previewable: bool = False
    preview_mode: str = "unsupported"
    preview_url: str | None = None
    open_url: str


class ResourceCard(BaseModel):
    resource_id: int | None = None
    resource_type: str
    title: str
    summary: str
    content_markdown: str
    source_titles: list[str] = Field(default_factory=list)
    study_suggestion: str | None = None
    source_file_count: int = 0
    source_files: list[ResourceSourceFileRef] = Field(default_factory=list)


class KnowledgeHit(BaseModel):
    chunk_id: int
    document_id: int | None = None
    title: str
    content: str
    score: float
