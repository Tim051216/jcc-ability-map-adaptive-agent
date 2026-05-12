from sqlalchemy import ForeignKey, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class EvaluationPaper(Base, TimestampMixin):
    __tablename__ = "ai_evaluation_paper"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(index=True)
    course_code: Mapped[str] = mapped_column(String(128), index=True)
    paper_type: Mapped[str] = mapped_column(String(64), default="diagnostic")
    status: Mapped[str] = mapped_column(String(32), default="draft")
    questions_data: Mapped[list[dict]] = mapped_column(JSON)


class EvaluationAnswer(Base, TimestampMixin):
    __tablename__ = "ai_evaluation_answer"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    paper_id: Mapped[int] = mapped_column(ForeignKey("ai_evaluation_paper.id"), index=True)
    user_id: Mapped[int] = mapped_column(index=True)
    question_id: Mapped[str] = mapped_column(String(64), index=True)
    question_type: Mapped[str] = mapped_column(String(32), default="single_choice")
    prompt: Mapped[str] = mapped_column(Text)
    knowledge_point: Mapped[str] = mapped_column(String(255))
    user_answer: Mapped[str] = mapped_column(Text)
    correct_answer: Mapped[str] = mapped_column(Text)
    is_correct: Mapped[bool] = mapped_column()
    explanation: Mapped[str] = mapped_column(Text)
