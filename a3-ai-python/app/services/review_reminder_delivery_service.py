from __future__ import annotations

from datetime import datetime

from sqlalchemy import select

from app.db.models.user_inbox import UserInbox
from app.db.session import get_db


class ReviewReminderDeliveryService:
    REMINDER_TITLE = "智能复习提醒"
    REMINDER_TYPE = 1
    REMINDER_PUBLISHER = 9001

    async def upsert_review_plan_reminder(
        self,
        *,
        user_id: int,
        course_id: int,
        section_index: int,
        summary: str,
        cards: list[dict],
    ) -> None:
        focus_prompt = ""
        if cards:
            focus_prompt = str(cards[0].get("prompt") or "").strip()
        reminder_text = (
            f"你在课程 {course_id} 的第 {section_index + 1} 节已进入复习窗口，"
            f"建议优先回顾「{focus_prompt or '当前重点知识点'}」。"
        )
        if summary.strip():
            reminder_text = f"{reminder_text} {summary.strip()}"

        async with get_db() as session:
            existing = (
                await session.execute(
                    select(UserInbox)
                    .where(
                        UserInbox.user_id == user_id,
                        UserInbox.status == "active",
                        UserInbox.type == self.REMINDER_TYPE,
                        UserInbox.publisher == self.REMINDER_PUBLISHER,
                        UserInbox.title == self.REMINDER_TITLE,
                    )
                    .order_by(UserInbox.id.desc())
                    .limit(1)
                )
            ).scalar_one_or_none()

            now = datetime.now().isoformat(timespec="seconds")
            if existing is None:
                session.add(
                    UserInbox(
                        user_id=user_id,
                        type=self.REMINDER_TYPE,
                        title=self.REMINDER_TITLE,
                        content=reminder_text,
                        publisher=self.REMINDER_PUBLISHER,
                        push_time=now,
                        status="active",
                        is_read=False,
                    )
                )
            else:
                existing.content = reminder_text
                existing.push_time = now
                existing.is_read = False

            await session.commit()
