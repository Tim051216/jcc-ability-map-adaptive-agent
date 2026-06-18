from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.chat_session import ChatMessage, ChatSession, ChatSessionReadState


class ImRepository:
    async def list_sessions(self, session: AsyncSession, *, user_id: int) -> list[ChatSession]:
        stmt = (
            select(ChatSession)
            .where(
                ChatSession.user_id == user_id
            )
            .order_by(ChatSession.updated_at.desc(), ChatSession.id.desc())
        )
        return list((await session.execute(stmt)).scalars().all())

    async def get_session(self, session: AsyncSession, *, session_id: int) -> ChatSession | None:
        return await session.get(ChatSession, session_id)

    async def find_peer_session(
        self,
        session: AsyncSession,
        *,
        owner_user_id: int,
        peer_user_id: int,
    ) -> ChatSession | None:
        stmt = (
            select(ChatSession)
            .where(
                ChatSession.user_id == owner_user_id,
                ChatSession.scene == "peer_im",
                ChatSession.peer_user_id == peer_user_id,
            )
            .order_by(ChatSession.updated_at.desc(), ChatSession.id.desc())
        )
        return (await session.execute(stmt)).scalars().first()

    async def list_messages(self, session: AsyncSession, *, session_id: int) -> list[ChatMessage]:
        stmt = select(ChatMessage).where(ChatMessage.session_id == session_id).order_by(ChatMessage.created_at.asc(), ChatMessage.id.asc())
        return list((await session.execute(stmt)).scalars().all())

    async def list_latest_messages(self, session: AsyncSession, *, session_ids: list[int]) -> dict[int, ChatMessage]:
        if not session_ids:
            return {}
        latest_subquery = (
            select(ChatMessage.session_id, func.max(ChatMessage.id).label("latest_id"))
            .where(ChatMessage.session_id.in_(session_ids))
            .group_by(ChatMessage.session_id)
            .subquery()
        )
        stmt = (
            select(ChatMessage)
            .join(latest_subquery, ChatMessage.id == latest_subquery.c.latest_id)
            .order_by(ChatMessage.session_id.asc())
        )
        rows = list((await session.execute(stmt)).scalars().all())
        return {int(row.session_id): row for row in rows}

    async def get_read_state(self, session: AsyncSession, *, session_id: int, user_id: int) -> ChatSessionReadState | None:
        stmt = select(ChatSessionReadState).where(
            ChatSessionReadState.session_id == session_id,
            ChatSessionReadState.user_id == user_id,
        )
        return (await session.execute(stmt)).scalars().first()

    async def list_read_states(self, session: AsyncSession, *, session_ids: list[int], user_id: int) -> dict[int, ChatSessionReadState]:
        if not session_ids:
            return {}
        stmt = select(ChatSessionReadState).where(
            ChatSessionReadState.user_id == user_id,
            ChatSessionReadState.session_id.in_(session_ids),
        )
        rows = list((await session.execute(stmt)).scalars().all())
        return {int(row.session_id): row for row in rows}

    async def list_unread_counts(self, session: AsyncSession, *, session_ids: list[int], user_id: int) -> dict[int, int]:
        if not session_ids:
            return {}
        read_state_subquery = (
            select(
                ChatSessionReadState.session_id.label("session_id"),
                ChatSessionReadState.last_read_message_id.label("last_read_message_id"),
            )
            .where(
                ChatSessionReadState.user_id == user_id,
                ChatSessionReadState.session_id.in_(session_ids),
            )
            .subquery()
        )
        stmt = (
            select(
                ChatMessage.session_id,
                func.count(ChatMessage.id).label("unread_count"),
            )
            .select_from(ChatMessage)
            .outerjoin(read_state_subquery, ChatMessage.session_id == read_state_subquery.c.session_id)
            .where(
                ChatMessage.session_id.in_(session_ids),
                ChatMessage.role != f"user:{user_id}",
                ChatMessage.id > func.coalesce(read_state_subquery.c.last_read_message_id, 0),
            )
            .group_by(ChatMessage.session_id)
        )
        rows = list((await session.execute(stmt)).all())
        return {int(session_id): int(unread_count or 0) for session_id, unread_count in rows}

    async def mark_read(
        self,
        session: AsyncSession,
        *,
        session_id: int,
        user_id: int,
        last_read_message_id: int,
    ) -> ChatSessionReadState:
        item = await self.get_read_state(session, session_id=session_id, user_id=user_id)
        if item is None:
            item = ChatSessionReadState(
                session_id=session_id,
                user_id=user_id,
                last_read_message_id=last_read_message_id,
            )
            session.add(item)
        else:
            item.last_read_message_id = max(int(item.last_read_message_id or 0), int(last_read_message_id or 0))
        await session.flush()
        return item

    async def create_session(
        self,
        session: AsyncSession,
        *,
        owner_user_id: int,
        peer_user_id: int,
        title: str,
        peer_name: str | None = None,
    ) -> ChatSession:
        item = ChatSession(
            user_id=owner_user_id,
            title=title,
            scene="peer_im",
            peer_user_id=peer_user_id,
            peer_name=peer_name or title,
        )
        session.add(item)
        await session.flush()
        return item

    async def create_seed_session(
        self,
        session: AsyncSession,
        *,
        owner_user_id: int,
        title: str,
        scene: str,
        peer_user_id: int | None = None,
        peer_name: str | None = None,
    ) -> ChatSession:
        item = ChatSession(
            user_id=owner_user_id,
            title=title,
            scene=scene,
            peer_user_id=peer_user_id,
            peer_name=peer_name,
        )
        session.add(item)
        await session.flush()
        return item

    async def create_message_with_timestamp(
        self,
        session: AsyncSession,
        *,
        session_id: int,
        role: str,
        content: str,
        citations: str | None = None,
        created_at: str | None = None,
        updated_at: str | None = None,
    ) -> ChatMessage:
        item = ChatMessage(
            session_id=session_id,
            role=role,
            content=content,
            citations=citations,
            created_at=created_at,
            updated_at=updated_at,
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
