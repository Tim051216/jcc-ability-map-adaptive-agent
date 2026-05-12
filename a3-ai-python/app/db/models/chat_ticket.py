from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class ChatTicket(Base, TimestampMixin):
    __tablename__ = "ai_chat_ticket"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(index=True)
    session_id: Mapped[int | None] = mapped_column(ForeignKey("ai_chat_session.id"), nullable=True, index=True)
    course_code: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    title: Mapped[str] = mapped_column(String(255))
    question_summary: Mapped[str] = mapped_column(Text)
    latest_answer: Mapped[str | None] = mapped_column(Text, nullable=True)
    priority: Mapped[str] = mapped_column(String(32), default="normal")
    status: Mapped[str] = mapped_column(String(32), default="open")


class ChatTicketReply(Base, TimestampMixin):
    __tablename__ = "ai_chat_ticket_reply"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    ticket_id: Mapped[int] = mapped_column(ForeignKey("ai_chat_ticket.id"), index=True)
    replier_name: Mapped[str] = mapped_column(String(128))
    replier_role: Mapped[str] = mapped_column(String(32), default="staff")
    content: Mapped[str] = mapped_column(Text)
