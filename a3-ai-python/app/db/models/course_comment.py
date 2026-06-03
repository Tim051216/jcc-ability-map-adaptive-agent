from sqlalchemy import BigInteger, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class CourseComment(Base, TimestampMixin):
    __tablename__ = "course_comment"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    course_key: Mapped[str] = mapped_column(String(64), index=True, nullable=False, comment="课程键")
    section_index: Mapped[int | None] = mapped_column(Integer, index=True, nullable=True, comment="章节索引")
    user_id: Mapped[int] = mapped_column(BigInteger, index=True, nullable=False, comment="评论用户ID")
    parent_comment_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("course_comment.id", ondelete="SET NULL"),
        index=True,
        nullable=True,
        comment="父评论ID",
    )
    content: Mapped[str] = mapped_column(Text, nullable=False, comment="评论内容")
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="active", index=True, comment="状态")


class CourseCommentLike(Base, TimestampMixin):
    __tablename__ = "course_comment_like"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    comment_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("course_comment.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
        comment="评论ID",
    )
    user_id: Mapped[int] = mapped_column(BigInteger, index=True, nullable=False, comment="点赞用户ID")
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="active", index=True, comment="状态")
