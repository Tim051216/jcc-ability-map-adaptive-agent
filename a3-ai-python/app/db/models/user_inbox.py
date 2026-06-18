from sqlalchemy import BigInteger, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class UserInbox(Base, TimestampMixin):
    __tablename__ = "user_inbox"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(BigInteger, index=True, nullable=False, comment="收件用户ID")
    type: Mapped[int] = mapped_column(Integer, nullable=False, default=1, comment="消息类型")
    title: Mapped[str] = mapped_column(String(120), nullable=False, comment="消息标题")
    content: Mapped[str] = mapped_column(Text, nullable=False, comment="消息内容")
    is_read: Mapped[bool] = mapped_column(nullable=False, default=False, comment="是否已读")
    publisher: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0, comment="发送方ID")
    push_time: Mapped[str | None] = mapped_column(String(32), nullable=True, comment="推送时间")
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="active", index=True, comment="状态")
