from sqlalchemy import JSON, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class EvaluationRecord(Base, TimestampMixin):
    __tablename__ = "ai_evaluation_record"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(index=True)
    course_code: Mapped[str] = mapped_column(String(128), index=True)
    evaluation_type: Mapped[str] = mapped_column(String(64))
    result_data: Mapped[dict] = mapped_column(JSON)
