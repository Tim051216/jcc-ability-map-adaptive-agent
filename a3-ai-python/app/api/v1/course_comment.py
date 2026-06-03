from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user_id, get_db_session
from app.db.models.course_comment import CourseComment, CourseCommentLike
from app.schemas.course_comment import (
    CourseCommentCreate,
    CourseCommentItem,
    CourseCommentLikeResponse,
    CourseCommentListResponse,
    CourseCommentReplyInfo,
)

router = APIRouter()


async def _ensure_course_comment_tables(db: AsyncSession) -> None:
    await db.run_sync(lambda sync_session: CourseComment.__table__.create(sync_session.connection(), checkfirst=True))
    await db.run_sync(lambda sync_session: CourseCommentLike.__table__.create(sync_session.connection(), checkfirst=True))


def _resolve_user_name(user_id: int) -> str:
    if user_id == 1001:
        return "你"
    if user_id == 1002:
        return "学者 Zack Dev"
    if user_id == 1003:
        return "学者 Emily UI"
    return f"学友 {user_id}"


def _resolve_badge(user_id: int, liked_count: int) -> str:
    if user_id == 1001:
        return "我的讨论"
    if liked_count >= 20:
        return "高赞笔记"
    if liked_count >= 10:
        return "课堂总结"
    return "课堂互动"


async def _seed_default_comments(db: AsyncSession, course_key: str, section_index: int | None) -> None:
    presets: dict[str, list[tuple[int, str, int]]] = {
        "series-1": [
            (1002, "复合组件这套拆分方式很适合课程页，插槽边界清楚，后续扩展也更稳。", 24),
            (1003, "这一段把 Hooks 缓存、引用稳定性和组件重渲染的关系讲得很透，回头复盘时特别好整理成笔记。", 18),
        ],
        "series-2": [
            (1002, "这节课对 Context 和拆分边界的处理很实用，适合直接迁到项目里。", 22),
            (1003, "把状态切片、渲染链路和组件职责放在一起看，理解会清楚很多。", 14),
        ],
    }
    for user_id, content, like_seed in presets.get(course_key, []):
        record = CourseComment(
            course_key=course_key,
            section_index=section_index,
            user_id=user_id,
            content=content,
            status="active",
        )
        db.add(record)
        await db.flush()
        for offset in range(like_seed):
            db.add(
                CourseCommentLike(
                    comment_id=int(record.id),
                    user_id=20000 + offset + int(record.id) * 100,
                    status="active",
                )
            )
    await db.commit()


async def _cleanup_invalid_comments(db: AsyncSession, course_key: str, section_index: int | None) -> None:
    stmt = select(CourseComment).where(CourseComment.course_key == course_key, CourseComment.status == "active")
    if section_index is not None:
        stmt = stmt.where(CourseComment.section_index == section_index)
    records = (await db.execute(stmt)).scalars().all()
    changed = False
    for record in records:
        content = str(record.content or "")
        if "?" in content or "�" in content:
            record.status = "deleted"
            changed = True
    if changed:
        await db.commit()


async def _normalize_seed_likes(db: AsyncSession, course_key: str, section_index: int | None) -> None:
    stmt = select(CourseComment).where(CourseComment.course_key == course_key, CourseComment.status == "active")
    if section_index is not None:
        stmt = stmt.where(CourseComment.section_index == section_index)
    records = (await db.execute(stmt)).scalars().all()
    changed = False
    for record in records:
        uid = int(record.user_id)
        if uid not in {1002, 1003}:
            continue
        target_likes = 24 if uid == 1002 else 18
        current_likes = (
            await db.execute(
                select(func.count()).select_from(CourseCommentLike).where(
                    CourseCommentLike.comment_id == int(record.id),
                    CourseCommentLike.status == "active",
                )
            )
        ).scalar_one()
        if int(current_likes or 0) == 0:
            for offset in range(target_likes):
                db.add(
                    CourseCommentLike(
                        comment_id=int(record.id),
                        user_id=30000 + offset + int(record.id) * 100,
                        status="active",
                    )
                )
            changed = True
    if changed:
        await db.commit()


@router.get("", response_model=CourseCommentListResponse)
async def list_course_comments(
    course_key: str = Query(..., min_length=1, max_length=64, description="课程键"),
    section_index: int | None = Query(default=None, ge=0, le=9999, description="章节索引"),
    limit: int = Query(100, ge=1, le=300, description="返回数量"),
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db_session),
) -> CourseCommentListResponse:
    await _ensure_course_comment_tables(db)
    await _cleanup_invalid_comments(db, course_key, section_index)
    await _normalize_seed_likes(db, course_key, section_index)

    stmt = (
        select(CourseComment)
        .where(CourseComment.course_key == course_key, CourseComment.status == "active")
        .order_by(CourseComment.created_at.desc(), CourseComment.id.desc())
        .limit(limit)
    )
    if section_index is not None:
        stmt = stmt.where(CourseComment.section_index == section_index)

    records = (await db.execute(stmt)).scalars().all()
    if not records:
        await _seed_default_comments(db, course_key, section_index)
        records = (await db.execute(stmt)).scalars().all()
        if not records:
            return CourseCommentListResponse(total=0, items=[])

    comment_ids = [int(record.id) for record in records]
    like_rows = (
        await db.execute(
            select(CourseCommentLike.comment_id, CourseCommentLike.user_id)
            .where(CourseCommentLike.comment_id.in_(comment_ids), CourseCommentLike.status == "active")
        )
    ).all()

    like_count_map: dict[int, int] = {}
    liked_map: dict[int, bool] = {}
    for comment_id, like_user_id in like_rows:
        cid = int(comment_id)
        like_count_map[cid] = like_count_map.get(cid, 0) + 1
        if int(like_user_id) == user_id:
            liked_map[cid] = True

    parent_ids = [int(record.parent_comment_id) for record in records if record.parent_comment_id]
    parent_map: dict[int, CourseComment] = {}
    if parent_ids:
        parent_rows = (
            await db.execute(select(CourseComment).where(CourseComment.id.in_(parent_ids), CourseComment.status == "active"))
        ).scalars().all()
        parent_map = {int(item.id): item for item in parent_rows}

    items = [
        CourseCommentItem(
            id=int(record.id),
            course_key=str(record.course_key),
            section_index=record.section_index,
            user_id=int(record.user_id),
            author=_resolve_user_name(int(record.user_id)),
            content=str(record.content),
            created_at=getattr(record, "created_at", None),
            likes=like_count_map.get(int(record.id), 0),
            liked=liked_map.get(int(record.id), False),
            badge=_resolve_badge(int(record.user_id), like_count_map.get(int(record.id), 0)),
            parent_comment_id=record.parent_comment_id,
            reply_to=(
                CourseCommentReplyInfo(
                    id=int(parent_map[int(record.parent_comment_id)].id),
                    author=_resolve_user_name(int(parent_map[int(record.parent_comment_id)].user_id)),
                )
                if record.parent_comment_id and int(record.parent_comment_id) in parent_map
                else None
            ),
        )
        for record in records
    ]
    return CourseCommentListResponse(total=len(items), items=items)


@router.post("", response_model=CourseCommentItem)
async def create_course_comment(
    request: CourseCommentCreate,
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db_session),
) -> CourseCommentItem:
    await _ensure_course_comment_tables(db)

    content = request.content.strip()
    if not content:
        raise HTTPException(status_code=400, detail="评论内容不能为空")

    parent_record = None
    if request.parent_comment_id is not None:
        parent_record = (
            await db.execute(
                select(CourseComment).where(CourseComment.id == request.parent_comment_id, CourseComment.status == "active")
            )
        ).scalar_one_or_none()
        if parent_record is None:
            raise HTTPException(status_code=404, detail="父评论不存在")

    record = CourseComment(
        course_key=request.course_key.strip(),
        section_index=request.section_index,
        user_id=user_id,
        parent_comment_id=request.parent_comment_id,
        content=content,
        status="active",
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)

    return CourseCommentItem(
        id=int(record.id),
        course_key=str(record.course_key),
        section_index=record.section_index,
        user_id=int(record.user_id),
        author=_resolve_user_name(int(record.user_id)),
        content=str(record.content),
        created_at=getattr(record, "created_at", None),
        likes=0,
        liked=False,
        badge=_resolve_badge(int(record.user_id), 0),
        parent_comment_id=record.parent_comment_id,
        reply_to=(
            CourseCommentReplyInfo(id=int(parent_record.id), author=_resolve_user_name(int(parent_record.user_id)))
            if parent_record is not None
            else None
        ),
    )


@router.post("/{comment_id}/like", response_model=CourseCommentLikeResponse)
async def toggle_course_comment_like(
    comment_id: int,
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db_session),
) -> CourseCommentLikeResponse:
    await _ensure_course_comment_tables(db)

    comment = (
        await db.execute(select(CourseComment).where(CourseComment.id == comment_id, CourseComment.status == "active"))
    ).scalar_one_or_none()
    if comment is None:
        raise HTTPException(status_code=404, detail="评论不存在")

    existing = (
        await db.execute(
            select(CourseCommentLike).where(
                CourseCommentLike.comment_id == comment_id,
                CourseCommentLike.user_id == user_id,
                CourseCommentLike.status == "active",
            )
        )
    ).scalar_one_or_none()

    if existing is not None:
        existing.status = "deleted"
        liked = False
    else:
        db.add(CourseCommentLike(comment_id=comment_id, user_id=user_id, status="active"))
        liked = True

    await db.commit()

    likes = (
        await db.execute(
            select(func.count()).select_from(CourseCommentLike).where(
                CourseCommentLike.comment_id == comment_id,
                CourseCommentLike.status == "active",
            )
        )
    ).scalar_one()

    return CourseCommentLikeResponse(comment_id=comment_id, liked=liked, likes=int(likes or 0))
