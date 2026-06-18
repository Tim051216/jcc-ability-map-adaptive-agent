from sqlalchemy import JSON, BigInteger, Boolean, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class LearningQuestion(Base, TimestampMixin):
    __tablename__ = "learning_question"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    user_id: Mapped[int] = mapped_column(BigInteger, index=True)
    course_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True, index=True)
    chapter_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    section_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True, index=True)
    title: Mapped[str] = mapped_column(String(300))
    description: Mapped[str] = mapped_column(Text)
    anonymity: Mapped[bool] = mapped_column(Boolean, default=False)
    status: Mapped[str] = mapped_column(String(20), default="active", index=True)


class LearningReply(Base, TimestampMixin):
    __tablename__ = "learning_reply"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    question_id: Mapped[int] = mapped_column(BigInteger, index=True)
    user_id: Mapped[int] = mapped_column(BigInteger, index=True)
    answer_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True, index=True)
    target_reply_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    target_user_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    content: Mapped[str] = mapped_column(Text)
    anonymity: Mapped[bool] = mapped_column(Boolean, default=False)
    liked_times: Mapped[int] = mapped_column(Integer, default=0)
    liked_user_ids: Mapped[list[int] | None] = mapped_column(JSON, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="active", index=True)


class LearningNote(Base, TimestampMixin):
    __tablename__ = "learning_note"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    user_id: Mapped[int] = mapped_column(BigInteger, index=True)
    course_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True, index=True)
    chapter_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    section_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True, index=True)
    content: Mapped[str] = mapped_column(Text)
    note_moment: Mapped[int] = mapped_column(Integer, default=0)
    is_private: Mapped[bool] = mapped_column(Boolean, default=False)
    is_gathered: Mapped[bool] = mapped_column(Boolean, default=False)
    status: Mapped[str] = mapped_column(String(20), default="active", index=True)
