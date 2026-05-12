from sqlalchemy import ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class PlanStepProgress(Base, TimestampMixin):
    __tablename__ = "ai_plan_step_progress"
    __table_args__ = (
        UniqueConstraint("plan_id", "user_id", "step_id", name="uq_ai_plan_step_progress_plan_user_step"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    plan_id: Mapped[int] = mapped_column(ForeignKey("ai_learning_plan.id"), index=True)
    user_id: Mapped[int] = mapped_column(index=True)
    step_id: Mapped[str] = mapped_column(String(64), index=True)
    status: Mapped[str] = mapped_column(String(32), default="pending")
    last_action: Mapped[str] = mapped_column(String(32), default="initialize")
    progress_note: Mapped[str | None] = mapped_column(Text, nullable=True)
