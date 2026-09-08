from sqlalchemy import Boolean, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class JobTrialFeedback(Base, TimestampMixin):
    __tablename__ = "job_trial_feedback"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(index=True)
    course_id: Mapped[int] = mapped_column(index=True)
    participant_role: Mapped[str] = mapped_column(String(32))
    identity_description: Mapped[str] = mapped_column(String(200))
    trial_task: Mapped[str] = mapped_column(Text)
    strengths: Mapped[str] = mapped_column(Text)
    problems: Mapped[str] = mapped_column(Text)
    improvement_suggestions: Mapped[str] = mapped_column(Text)
    overall_rating: Mapped[int] = mapped_column()
    consent_to_quote: Mapped[bool] = mapped_column(Boolean, default=False)
