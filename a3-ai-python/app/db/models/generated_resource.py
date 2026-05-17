from sqlalchemy import JSON, Boolean, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class GeneratedResource(Base, TimestampMixin):
    __tablename__ = "generated_resource"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(index=True)
    course_code: Mapped[str] = mapped_column(String(128), index=True)
    resource_type: Mapped[str] = mapped_column(String(64), index=True)
    title: Mapped[str] = mapped_column(String(255))
    summary: Mapped[str] = mapped_column(Text)
    content_markdown: Mapped[str] = mapped_column(Text)
    source_titles: Mapped[list[str]] = mapped_column(JSON, default=list)
    study_suggestion: Mapped[str | None] = mapped_column(Text, nullable=True)
    generation_context: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    archived_at: Mapped[str | None] = mapped_column(nullable=True)
    archived_by: Mapped[str | None] = mapped_column(String(64), nullable=True)
    archive_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    download_scope: Mapped[str] = mapped_column(String(32), default="owner")
    download_count: Mapped[int] = mapped_column(Integer, default=0)


class ResourceFavorite(Base, TimestampMixin):
    __tablename__ = "resource_favorite"
    __table_args__ = (
        UniqueConstraint("user_id", "resource_id", name="uq_ai_resource_favorite_user_resource"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(index=True)
    resource_id: Mapped[int] = mapped_column(ForeignKey("generated_resource.id"), index=True)
    category: Mapped[str] = mapped_column(String(64), default="默认分类")
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)


class ResourceFavoriteHistory(Base, TimestampMixin):
    __tablename__ = "resource_favorite_history"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(index=True)
    resource_id: Mapped[int] = mapped_column(ForeignKey("generated_resource.id"), index=True)
    action: Mapped[str] = mapped_column(String(32), index=True)
