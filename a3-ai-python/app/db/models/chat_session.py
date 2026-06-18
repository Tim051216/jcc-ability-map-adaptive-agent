from sqlalchemy import BigInteger, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class ChatSession(Base, TimestampMixin):
    __tablename__ = "chat_session"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(index=True)
    title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    scene: Mapped[str] = mapped_column(String(64), default="study_assistant")
    peer_user_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True, index=True)
    peer_name: Mapped[str | None] = mapped_column(String(255), nullable=True)


class ChatMessage(Base, TimestampMixin):
    __tablename__ = "chat_message"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("chat_session.id"), index=True)
    role: Mapped[str] = mapped_column(String(32))
    content: Mapped[str] = mapped_column(Text)
    citations: Mapped[str | None] = mapped_column(Text, nullable=True)


class ChatSessionReadState(Base, TimestampMixin):
    __tablename__ = "chat_session_read_state"
    __table_args__ = (UniqueConstraint("session_id", "user_id", name="uq_chat_session_read_state_session_user"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("chat_session.id"), index=True)
    user_id: Mapped[int] = mapped_column(BigInteger, index=True)
    last_read_message_id: Mapped[int] = mapped_column(Integer, default=0)
