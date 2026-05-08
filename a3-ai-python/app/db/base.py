from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    """所有 ORM 模型的基类。"""


class TimestampMixin:
    created_at: Mapped[str | None] = mapped_column(nullable=True)
    updated_at: Mapped[str | None] = mapped_column(nullable=True)
