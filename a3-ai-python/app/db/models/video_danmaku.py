from sqlalchemy import BigInteger, Float, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class VideoDanmaku(Base, TimestampMixin):
    __tablename__ = "video_danmaku"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    video_key: Mapped[str] = mapped_column(String(128), index=True, nullable=False, comment="视频唯一键")
    user_id: Mapped[int] = mapped_column(BigInteger, index=True, nullable=False, comment="发送用户ID")
    course_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True, index=True, comment="课程ID")
    section_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True, index=True, comment="章节ID")
    content: Mapped[str] = mapped_column(String(120), nullable=False, comment="弹幕内容")
    color: Mapped[str] = mapped_column(String(16), nullable=False, default="#ffffff", comment="弹幕颜色")
    mode: Mapped[str] = mapped_column(String(16), nullable=False, default="scroll", index=True, comment="弹幕模式")
    start_time: Mapped[float] = mapped_column(Float, nullable=False, index=True, comment="视频内时间点（秒）")
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="active", index=True, comment="状态")
