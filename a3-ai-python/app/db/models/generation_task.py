from sqlalchemy import JSON, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class GenerationTask(Base, TimestampMixin):
    __tablename__ = "ai_generation_task"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(index=True)
    task_type: Mapped[str] = mapped_column(String(64))
    status: Mapped[str] = mapped_column(String(32), default="pending")
    payload: Mapped[dict] = mapped_column(JSON)
    result_data: Mapped[dict | None] = mapped_column(JSON, nullable=True)
