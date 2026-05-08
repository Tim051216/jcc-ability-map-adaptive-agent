from sqlalchemy import JSON, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class UserProfileSnapshot(Base, TimestampMixin):
    __tablename__ = "ai_user_profile_snapshot"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(index=True)
    version: Mapped[int] = mapped_column(default=1)
    profile_data: Mapped[dict] = mapped_column(JSON)
    source_summary: Mapped[str | None] = mapped_column(String(1000), nullable=True)
