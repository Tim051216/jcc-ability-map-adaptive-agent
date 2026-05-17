from sqlalchemy import Boolean, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class ResourceSourceFile(Base, TimestampMixin):
    __tablename__ = "resource_source_file"
    __table_args__ = (
        UniqueConstraint("resource_id", "relative_path", name="uq_ai_resource_source_file_resource_path"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    resource_id: Mapped[int] = mapped_column(ForeignKey("generated_resource.id"), index=True)
    course_code: Mapped[str] = mapped_column(String(128), index=True)
    display_name: Mapped[str] = mapped_column(String(255))
    relative_path: Mapped[str] = mapped_column(Text)
    absolute_path: Mapped[str] = mapped_column(Text)
    top_level_category: Mapped[str] = mapped_column(String(255), index=True)
    file_extension: Mapped[str] = mapped_column(String(32), default="")
    mime_type: Mapped[str | None] = mapped_column(String(128), nullable=True)
    file_size: Mapped[int | None] = mapped_column(Integer, nullable=True)
    preview_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_inline_previewable: Mapped[bool] = mapped_column(Boolean, default=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
