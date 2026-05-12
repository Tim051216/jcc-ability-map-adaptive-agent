from datetime import datetime

from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    """所有 ORM 模型的基类。"""


class TimestampMixin:
    created_at: Mapped[str | None] = mapped_column(
        default=lambda: datetime.now().isoformat(timespec="seconds"),
        nullable=True,
    )
    updated_at: Mapped[str | None] = mapped_column(
        default=lambda: datetime.now().isoformat(timespec="seconds"),
        onupdate=lambda: datetime.now().isoformat(timespec="seconds"),
        nullable=True,
    )
