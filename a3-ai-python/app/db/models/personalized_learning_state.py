from sqlalchemy import JSON, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class PersonalizedLearningState(Base, TimestampMixin):
    __tablename__ = "personalized_learning_state"
    __table_args__ = (
        UniqueConstraint("user_id", "course_id", name="uq_personalized_learning_state_user_course"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(index=True)
    course_id: Mapped[int] = mapped_column(index=True)
    total_watched_seconds: Mapped[int] = mapped_column(default=0)
    completed_sections: Mapped[list[int]] = mapped_column(JSON, default=list)
    last_event_type: Mapped[str] = mapped_column(String(32), default="init")
