from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.repositories.im_repository import ImRepository
from app.schemas.chat import (
    ImMessageListResponse,
    ImMessageResponse,
    ImSendMessageRequest,
    ImSessionCreateRequest,
    ImSessionListResponse,
    ImSessionSummaryResponse,
)


class ImService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.repo = ImRepository()

    async def list_sessions(self, user_id: int) -> ImSessionListResponse:
        rows = await self.repo.list_sessions(self.db, user_id=user_id)
        items: list[ImSessionSummaryResponse] = []
        for row in rows:
            messages = await self.repo.list_messages(self.db, session_id=row.id)
            latest = messages[-1] if messages else None
            subtitle = latest.citations if latest and latest.citations else self._build_subtitle(row.scene)
            unread_count = 1 if latest and latest.role != f"user:{user_id}" else 0
            conversation_type = self._build_conversation_type(row.scene)
            items.append(
                ImSessionSummaryResponse(
                    session_id=row.id,
                    title=row.title or f"\u4f1a\u8bdd #{row.id}",
                    scene=row.scene,
                    conversation_type=conversation_type,
                    subtitle=subtitle,
                    badge_label=self._build_badge_label(row.scene),
                    participant_label=self._build_participant_label(row.title or "", row.scene),
                    member_count=self._build_member_count(row.id, row.scene),
                    unread_count=unread_count,
                    latest_message=latest.content if latest else None,
                    latest_message_at=latest.created_at if latest else row.updated_at,
                )
            )
        return ImSessionListResponse(items=items, total=len(items))

    async def create_session(self, user_id: int, request: ImSessionCreateRequest) -> ImSessionSummaryResponse:
        title = request.peer_name or f"\u7528\u6237 {request.peer_user_id}"
        created = await self.repo.create_session(
            self.db,
            owner_user_id=user_id,
            peer_user_id=request.peer_user_id,
            title=f"{title} #{request.peer_user_id}",
        )
        await self.db.commit()
        return ImSessionSummaryResponse(
            session_id=created.id,
            peer_user_id=request.peer_user_id,
            title=created.title or title,
            scene=created.scene,
            conversation_type=self._build_conversation_type(created.scene),
            subtitle=self._build_subtitle(created.scene),
            badge_label=self._build_badge_label(created.scene),
            participant_label=self._build_participant_label(created.title or title, created.scene),
            member_count=self._build_member_count(created.id, created.scene),
            unread_count=0,
            latest_message=None,
            latest_message_at=created.updated_at,
        )

    async def list_messages(self, user_id: int, session_id: int) -> ImMessageListResponse:
        session_row = await self.repo.get_session(self.db, session_id=session_id)
        if session_row is None:
            return ImMessageListResponse(items=[], total=0)
        rows = await self.repo.list_messages(self.db, session_id=session_id)
        items = [
            ImMessageResponse(
                message_id=row.id,
                session_id=row.session_id,
                role=row.role,
                content=row.content,
                created_at=row.created_at,
            )
            for row in rows
        ]
        return ImMessageListResponse(items=items, total=len(items))

    async def send_message(self, user_id: int, session_id: int, request: ImSendMessageRequest) -> ImMessageResponse:
        item = await self.repo.create_message(
            self.db,
            session_id=session_id,
            role=f"user:{user_id}",
            content=request.content.strip(),
        )
        await self.db.commit()
        return ImMessageResponse(
            message_id=item.id,
            session_id=item.session_id,
            role=item.role,
            content=item.content,
            created_at=item.created_at,
        )

    @staticmethod
    def _build_subtitle(scene: str | None) -> str:
        if scene == "course_group":
            return "课程群"
        if scene == "system_agent":
            return "系统协同"
        return "站内私聊"

    @staticmethod
    def _build_conversation_type(scene: str | None) -> str:
        if scene == "course_group":
            return "group"
        if scene == "system_agent":
            return "system"
        return "direct"

    @staticmethod
    def _build_badge_label(scene: str | None) -> str:
        if scene == "course_group":
            return "课程群"
        if scene == "system_agent":
            return "系统协同"
        return "私聊"

    @staticmethod
    def _build_participant_label(title: str, scene: str | None) -> str:
        if scene == "course_group":
            return f"{title} · 课堂协作"
        if scene == "system_agent":
            return f"{title} · Agent Runtime"
        return f"{title} · 站内沟通"

    @staticmethod
    def _build_member_count(session_id: int, scene: str | None) -> int | None:
        if scene == "course_group":
            return 18 + session_id % 9
        if scene == "system_agent":
            return 5
        return 2
