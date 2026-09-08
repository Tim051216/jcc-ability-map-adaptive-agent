from sqlalchemy import JSON, Boolean, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class JobCoachingRecord(Base, TimestampMixin):
    __tablename__ = "job_coaching_record"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(index=True)
    course_id: Mapped[int] = mapped_column(index=True)
    source: Mapped[str] = mapped_column(String(32), default="xfyun_workflow")
    user_question: Mapped[str] = mapped_column(Text)
    advice_summary: Mapped[str] = mapped_column(Text)
    recommended_actions: Mapped[list[str]] = mapped_column(JSON, default=list)
    status: Mapped[str] = mapped_column(String(32), default="planned")
    helpful: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    rating: Mapped[int | None] = mapped_column(nullable=True)
    feedback_note: Mapped[str | None] = mapped_column(Text, nullable=True)
