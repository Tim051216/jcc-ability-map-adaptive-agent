from sqlalchemy import JSON, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class KnowledgeDocument(Base, TimestampMixin):
    __tablename__ = "ai_knowledge_document"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    course_code: Mapped[str] = mapped_column(String(128), index=True)
    title: Mapped[str] = mapped_column(String(255))
    source_type: Mapped[str] = mapped_column(String(64))
    source_uri: Mapped[str | None] = mapped_column(String(500), nullable=True)
    metadata_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)


class KnowledgeChunk(Base, TimestampMixin):
    __tablename__ = "ai_knowledge_chunk"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    document_id: Mapped[int] = mapped_column(ForeignKey("ai_knowledge_document.id"), index=True)
    chunk_index: Mapped[int] = mapped_column(index=True)
    content: Mapped[str] = mapped_column(Text)
    keywords: Mapped[str | None] = mapped_column(String(500), nullable=True)
    metadata_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
