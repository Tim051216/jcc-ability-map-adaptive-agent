from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError, ProgrammingError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user_id, get_db_session
from app.db.models.user_inbox import UserInbox
from app.schemas.inbox import InboxItem, InboxListResponse, InboxReadResponse

router = APIRouter()
_inbox_table_ready = False


async def _ensure_inbox_table(db: AsyncSession) -> None:
    global _inbox_table_ready
    if _inbox_table_ready:
        return
    try:
        await db.run_sync(lambda sync_session: UserInbox.__table__.create(sync_session.connection(), checkfirst=True))
    except (IntegrityError, ProgrammingError):
        await db.rollback()
    _inbox_table_ready = True


async def _ensure_inbox_seed(db: AsyncSession, user_id: int) -> None:
    existing = await db.execute(
        select(UserInbox.id).where(UserInbox.user_id == user_id, UserInbox.status == "active").limit(1)
    )
    if existing.scalar_one_or_none() is not None:
        return

    now = datetime.now()
    seed_items = [
        UserInbox(
            user_id=user_id,
            type=1,
            title="智能复习提醒",
            content="你在《软件工程与实践（第4版）》第 1 章已进入首次复习窗口，建议今晚先回顾软件危机、生命周期与过程方法的主线，再完成 1 轮章节记忆卡。",
            publisher=9001,
            push_time=(now - timedelta(minutes=18)).isoformat(timespec="seconds"),
            status="active",
        ),
        UserInbox(
            user_id=user_id,
            type=2,
            title="学习路径更新",
            content="系统已根据你最近的课堂停留、测评反馈和资源使用情况，重排了本周学习路径，建议先补需求分析，再进入概要设计与测试衔接。",
            publisher=9001,
            push_time=(now - timedelta(hours=3)).isoformat(timespec="seconds"),
            status="active",
        ),
        UserInbox(
            user_id=user_id,
            type=3,
            title="课程群新消息",
            content="学习交流群新增了 1 条与软件工程课程相关的协同建议，适合继续围绕需求建模、设计拆分和测试策略展开讨论。",
            publisher=9002,
            push_time=(now - timedelta(days=1)).isoformat(timespec="seconds"),
            status="active",
            is_read=True,
        ),
    ]
    db.add_all(seed_items)
    await db.commit()


def _to_item(record: UserInbox) -> InboxItem:
    return InboxItem(
        id=int(record.id),
        type=int(record.type),
        title=str(record.title),
        content=str(record.content),
        isRead=bool(record.is_read),
        publisher=int(record.publisher),
        pushTime=record.push_time,
    )


@router.get("", response_model=InboxListResponse)
async def list_inbox_items(
    pageNo: int = Query(default=1, ge=1),
    pageSize: int = Query(default=20, ge=1, le=100),
    isRead: bool | None = Query(default=None),
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db_session),
) -> InboxListResponse:
    await _ensure_inbox_table(db)
    await _ensure_inbox_seed(db, user_id)

    stmt = (
        select(UserInbox)
        .where(UserInbox.user_id == user_id, UserInbox.status == "active")
        .order_by(UserInbox.is_read.asc(), UserInbox.push_time.desc(), UserInbox.id.desc())
        .offset((pageNo - 1) * pageSize)
        .limit(pageSize)
    )
    if isRead is not None:
        stmt = stmt.where(UserInbox.is_read == isRead)

    records = (await db.execute(stmt)).scalars().all()
    return InboxListResponse(list=[_to_item(record) for record in records], total=len(records))


@router.put("/{inbox_id}/read", response_model=InboxReadResponse)
async def mark_inbox_item_read(
    inbox_id: int,
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db_session),
) -> InboxReadResponse:
    await _ensure_inbox_table(db)
    record = (
        await db.execute(
            select(UserInbox).where(
                UserInbox.id == inbox_id,
                UserInbox.user_id == user_id,
                UserInbox.status == "active",
            )
        )
    ).scalar_one_or_none()
    if record is None:
        raise HTTPException(status_code=404, detail="inbox item not found")

    if not record.is_read:
        record.is_read = True
        await db.commit()

    return InboxReadResponse(id=int(record.id), isRead=True)
