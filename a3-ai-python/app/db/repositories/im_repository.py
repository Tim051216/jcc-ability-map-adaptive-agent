from __future__ import annotations

from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.chat_session import ChatMessage, ChatSession


class ImRepository:
    async def list_sessions(self, session: AsyncSession, *, user_id: int) -> list[ChatSession]:
        stmt = (
            select(ChatSession)
            .where(
                or_(
                    ChatSession.user_id == user_id,
                    and_(ChatSession.scene == "peer_im", ChatSession.title.like(f"%#{user_id}%")),
                )
            )
            .order_by(ChatSession.updated_at.desc(), ChatSession.id.desc())
        )
        return list((await session.execute(stmt)).scalars().all())

    async def get_session(self, session: AsyncSession, *, session_id: int) -> ChatSession | None:
        return await session.get(ChatSession, session_id)

    async def list_messages(self, session: AsyncSession, *, session_id: int) -> list[ChatMessage]:
        stmt = select(ChatMessage).where(ChatMessage.session_id == session_id).order_by(ChatMessage.created_at.asc(), ChatMessage.id.asc())
        return list((await session.execute(stmt)).scalars().all())

    async def create_session(
        self,
        session: AsyncSession,
        *,
        owner_user_id: int,
        peer_user_id: int,
        title: str,
    ) -> ChatSession:
        item = ChatSession(
            user_id=owner_user_id,
            title=title,
            scene="peer_im",
        )
        session.add(item)
        await session.flush()
        return item

    async def create_message(
        self,
        session: AsyncSession,
        *,
        session_id: int,
        role: str,
        content: str,
        citations: str | None = None,
    ) -> ChatMessage:
        item = ChatMessage(
            session_id=session_id,
            role=role,
            content=content,
            citations=citations,
        )
        session.add(item)
        await session.flush()
        return item
