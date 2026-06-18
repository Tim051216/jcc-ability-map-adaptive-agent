from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.repositories.im_repository import ImRepository
from app.schemas.chat import (
    ImMessageListResponse,
    ImMessageResponse,
    ImSendMessageRequest,
    ImSessionCreateRequest,
    ImSessionListResponse,
    ImSessionReadResponse,
    ImSessionSummaryResponse,
)

DEFAULT_IM_SESSION_SEEDS: dict[int, list[dict[str, int | str | None]]] = {
    1001: [
        {"title": "软件工程课程群", "scene": "course_group", "peer_user_id": None, "peer_name": None},
        {"title": "A3 项目冲刺群", "scene": "course_group", "peer_user_id": None, "peer_name": None},
        {"title": "答辩排练小组", "scene": "course_group", "peer_user_id": None, "peer_name": None},
        {"title": "李老师", "scene": "peer_im", "peer_user_id": 2001, "peer_name": "李老师"},
        {"title": "林知夏", "scene": "peer_im", "peer_user_id": 1003, "peer_name": "林知夏"},
        {"title": "罗亦凡", "scene": "peer_im", "peer_user_id": 1006, "peer_name": "罗亦凡"},
        {"title": "程启航", "scene": "peer_im", "peer_user_id": 1010, "peer_name": "程启航"},
    ],
    1002: [
        {"title": "前端工程化课程群", "scene": "course_group", "peer_user_id": None, "peer_name": None},
        {"title": "页面重构协作群", "scene": "course_group", "peer_user_id": None, "peer_name": None},
        {"title": "设计助教 阿澄", "scene": "peer_im", "peer_user_id": 2002, "peer_name": "设计助教 阿澄"},
        {"title": "陈星宇", "scene": "peer_im", "peer_user_id": 1001, "peer_name": "陈星宇"},
        {"title": "Emily UI", "scene": "peer_im", "peer_user_id": 1003, "peer_name": "Emily UI"},
    ],
    1003: [
        {"title": "软件工程课程群", "scene": "course_group", "peer_user_id": None, "peer_name": None},
        {"title": "交互稿讨论群", "scene": "course_group", "peer_user_id": None, "peer_name": None},
        {"title": "周予安", "scene": "peer_im", "peer_user_id": 1001, "peer_name": "周予安"},
        {"title": "林澈", "scene": "peer_im", "peer_user_id": 1002, "peer_name": "林澈"},
        {"title": "课程运营助教", "scene": "peer_im", "peer_user_id": 2003, "peer_name": "课程运营助教"},
    ],
    1004: [
        {"title": "数据表达课程群", "scene": "course_group", "peer_user_id": None, "peer_name": None},
        {"title": "报告图表优化群", "scene": "course_group", "peer_user_id": None, "peer_name": None},
        {"title": "报告教练 陈序", "scene": "peer_im", "peer_user_id": 2004, "peer_name": "报告教练 陈序"},
        {"title": "顾言辞", "scene": "peer_im", "peer_user_id": 1009, "peer_name": "顾言辞"},
    ],
    1005: [
        {"title": "答辩策略课程群", "scene": "course_group", "peer_user_id": None, "peer_name": None},
        {"title": "产品表达共创群", "scene": "course_group", "peer_user_id": None, "peer_name": None},
        {"title": "答辩助教 祁越", "scene": "peer_im", "peer_user_id": 2005, "peer_name": "答辩助教 祁越"},
        {"title": "陈星宇", "scene": "peer_im", "peer_user_id": 1001, "peer_name": "陈星宇"},
    ],
    1006: [
        {"title": "多智能体实验群", "scene": "course_group", "peer_user_id": None, "peer_name": None},
        {"title": "工具调用联调群", "scene": "course_group", "peer_user_id": None, "peer_name": None},
        {"title": "学习协同中枢", "scene": "system_agent", "peer_user_id": None, "peer_name": None},
        {"title": "赵清和", "scene": "peer_im", "peer_user_id": 1007, "peer_name": "赵清和"},
        {"title": "陈星宇", "scene": "peer_im", "peer_user_id": 1001, "peer_name": "陈星宇"},
        {"title": "程启航", "scene": "peer_im", "peer_user_id": 1010, "peer_name": "程启航"},
    ],
    1007: [
        {"title": "知识库运营群", "scene": "course_group", "peer_user_id": None, "peer_name": None},
        {"title": "后端联调答疑群", "scene": "course_group", "peer_user_id": None, "peer_name": None},
        {"title": "知识库运营台", "scene": "system_agent", "peer_user_id": None, "peer_name": None},
        {"title": "沈砚舟", "scene": "peer_im", "peer_user_id": 1006, "peer_name": "沈砚舟"},
        {"title": "程启航", "scene": "peer_im", "peer_user_id": 1010, "peer_name": "程启航"},
    ],
    1008: [
        {"title": "资源运营课程群", "scene": "course_group", "peer_user_id": None, "peer_name": None},
        {"title": "资源策展组", "scene": "course_group", "peer_user_id": None, "peer_name": None},
        {"title": "连续学习运营群", "scene": "course_group", "peer_user_id": None, "peer_name": None},
        {"title": "课程运营助教", "scene": "peer_im", "peer_user_id": 2003, "peer_name": "课程运营助教"},
        {"title": "Emily UI", "scene": "peer_im", "peer_user_id": 1003, "peer_name": "Emily UI"},
        {"title": "顾言辞", "scene": "peer_im", "peer_user_id": 1009, "peer_name": "顾言辞"},
    ],
    1009: [
        {"title": "测评反馈课程群", "scene": "course_group", "peer_user_id": None, "peer_name": None},
        {"title": "错因复盘讨论群", "scene": "course_group", "peer_user_id": None, "peer_name": None},
        {"title": "测评助教 柳言", "scene": "peer_im", "peer_user_id": 2006, "peer_name": "测评助教 柳言"},
        {"title": "宋知夏", "scene": "peer_im", "peer_user_id": 1004, "peer_name": "宋知夏"},
        {"title": "沈知序", "scene": "peer_im", "peer_user_id": 1008, "peer_name": "沈知序"},
    ],
    1010: [
        {"title": "平台工程协同群", "scene": "course_group", "peer_user_id": None, "peer_name": None},
        {"title": "架构治理讨论群", "scene": "course_group", "peer_user_id": None, "peer_name": None},
        {"title": "平台运行协同台", "scene": "system_agent", "peer_user_id": None, "peer_name": None},
        {"title": "罗亦凡", "scene": "peer_im", "peer_user_id": 1006, "peer_name": "罗亦凡"},
        {"title": "周沐言", "scene": "peer_im", "peer_user_id": 1007, "peer_name": "周沐言"},
    ],
}


class ImService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.repo = ImRepository()

    async def list_sessions(self, user_id: int) -> ImSessionListResponse:
        rows = await self.repo.list_sessions(self.db, user_id=user_id)
        rows = await self._ensure_seed_sessions(user_id, rows)
        session_ids = [int(row.id) for row in rows]
        latest_messages = await self.repo.list_latest_messages(self.db, session_ids=session_ids)
        read_states = await self.repo.list_read_states(self.db, session_ids=session_ids, user_id=user_id)
        unread_counts = await self.repo.list_unread_counts(self.db, session_ids=session_ids, user_id=user_id)
        items: list[ImSessionSummaryResponse] = []
        for row in rows:
            latest = latest_messages.get(int(row.id))
            subtitle = latest.citations if latest and latest.citations else self._build_subtitle(row.scene)
            read_state = read_states.get(int(row.id))
            unread_count = unread_counts.get(int(row.id), 0)
            conversation_type = self._build_conversation_type(row.scene)
            items.append(
                ImSessionSummaryResponse(
                    session_id=row.id,
                    peer_user_id=row.peer_user_id,
                    title=row.title or f"会话 #{row.id}",
                    scene=row.scene,
                    conversation_type=conversation_type,
                    subtitle=subtitle,
                    badge_label=self._build_badge_label(row.scene),
                    participant_label=self._build_participant_label(row.title or "", row.scene, row.peer_name),
                    member_count=self._build_member_count(row.id, row.scene),
                    unread_count=unread_count,
                    latest_message=latest.content if latest else None,
                    latest_message_at=latest.created_at if latest else row.updated_at,
                )
            )
        return ImSessionListResponse(items=items, total=len(items))

    async def create_session(self, user_id: int, request: ImSessionCreateRequest) -> ImSessionSummaryResponse:
        title = request.peer_name or f"用户 {request.peer_user_id}"
        existing = await self.repo.find_peer_session(
            self.db,
            owner_user_id=user_id,
            peer_user_id=request.peer_user_id,
        )
        if existing is not None:
            return ImSessionSummaryResponse(
                session_id=existing.id,
                peer_user_id=existing.peer_user_id,
                title=existing.title or title,
                scene=existing.scene,
                conversation_type=self._build_conversation_type(existing.scene),
                subtitle=self._build_subtitle(existing.scene),
                badge_label=self._build_badge_label(existing.scene),
                participant_label=self._build_participant_label(existing.title or title, existing.scene, existing.peer_name),
                member_count=self._build_member_count(existing.id, existing.scene),
                unread_count=0,
                latest_message_at=existing.updated_at,
            )

        created = await self.repo.create_session(
            self.db,
            owner_user_id=user_id,
            peer_user_id=request.peer_user_id,
            title=title,
            peer_name=title,
        )

        owner_label = request.owner_name or f"用户 {user_id}"
        reverse_existing = await self.repo.find_peer_session(
            self.db,
            owner_user_id=request.peer_user_id,
            peer_user_id=user_id,
        )
        if reverse_existing is None:
            await self.repo.create_session(
                self.db,
                owner_user_id=request.peer_user_id,
                peer_user_id=user_id,
                title=owner_label,
                peer_name=owner_label,
            )

        await self.db.commit()
        return ImSessionSummaryResponse(
            session_id=created.id,
            peer_user_id=created.peer_user_id,
            title=created.title or title,
            scene=created.scene,
            conversation_type=self._build_conversation_type(created.scene),
            subtitle=self._build_subtitle(created.scene),
            badge_label=self._build_badge_label(created.scene),
            participant_label=self._build_participant_label(created.title or title, created.scene, created.peer_name),
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

    async def mark_session_read(self, user_id: int, session_id: int) -> ImSessionReadResponse:
        session_row = await self.repo.get_session(self.db, session_id=session_id)
        if session_row is None:
            return ImSessionReadResponse(session_id=session_id, user_id=user_id, last_read_message_id=0, unread_count=0)
        messages = await self.repo.list_messages(self.db, session_id=session_id)
        last_read_message_id = max((item.id for item in messages), default=0)
        state = await self.repo.mark_read(
            self.db,
            session_id=session_id,
            user_id=user_id,
            last_read_message_id=last_read_message_id,
        )
        await self.db.commit()
        return ImSessionReadResponse(
            session_id=session_id,
            user_id=user_id,
            last_read_message_id=state.last_read_message_id,
            unread_count=0,
        )

    async def send_message(self, user_id: int, session_id: int, request: ImSendMessageRequest) -> ImMessageResponse:
        session_row = await self.repo.get_session(self.db, session_id=session_id)
        if session_row is None:
            return ImMessageResponse(
                message_id=0,
                session_id=session_id,
                role=f"user:{user_id}",
                content=request.content.strip(),
                created_at=None,
            )
        item = await self.repo.create_message(
            self.db,
            session_id=session_id,
            role=f"user:{user_id}",
            content=request.content.strip(),
        )
        peer_user_id = int(session_row.peer_user_id or 0) or None
        if peer_user_id and peer_user_id != user_id:
            mirror_session = await self.repo.find_peer_session(
                self.db,
                owner_user_id=peer_user_id,
                peer_user_id=user_id,
            )
            if mirror_session is not None:
                await self.repo.create_message_with_timestamp(
                    self.db,
                    session_id=mirror_session.id,
                    role=f"user:{user_id}",
                    content=request.content.strip(),
                    created_at=item.created_at,
                    updated_at=item.updated_at,
                )
        await self.db.commit()
        return ImMessageResponse(
            message_id=item.id,
            session_id=item.session_id,
            role=item.role,
            content=item.content,
            created_at=item.created_at,
        )

    async def _ensure_seed_sessions(self, user_id: int, rows):
        existing_rows = list(rows)
        seed_specs = DEFAULT_IM_SESSION_SEEDS.get(user_id, [])
        if not seed_specs:
            return existing_rows

        existing_keys = {
            (
                (row.scene or "").strip().lower(),
                (row.title or "").strip().lower(),
                int(row.peer_user_id or 0),
            )
            for row in existing_rows
        }

        created = False
        for spec in seed_specs:
            key = (
                str(spec.get("scene") or "").strip().lower(),
                str(spec.get("title") or "").strip().lower(),
                int(spec.get("peer_user_id") or 0),
            )
            if key in existing_keys:
                continue
            session_row = await self.repo.create_seed_session(
                self.db,
                owner_user_id=user_id,
                title=str(spec.get("title") or f"学习会话 {user_id}"),
                scene=str(spec.get("scene") or "peer_im"),
                peer_user_id=int(spec["peer_user_id"]) if spec.get("peer_user_id") is not None else None,
                peer_name=str(spec["peer_name"]) if spec.get("peer_name") is not None else None,
            )
            existing_rows.append(session_row)
            existing_keys.add(key)
            created = True

        if created:
            await self.db.commit()
            return await self.repo.list_sessions(self.db, user_id=user_id)
        return existing_rows

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
    def _build_participant_label(title: str, scene: str | None, peer_name: str | None = None) -> str:
        if scene == "course_group":
            return f"{title} · 课堂协作"
        if scene == "system_agent":
            return f"{title} · 智能协同"
        return f"{peer_name or title} · 站内沟通"

    @staticmethod
    def _build_member_count(session_id: int, scene: str | None) -> int | None:
        if scene == "course_group":
            return 18 + session_id % 9
        if scene == "system_agent":
            return 5
        return 2
