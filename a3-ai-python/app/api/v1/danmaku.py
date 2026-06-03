from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user_id, get_db_session
from app.db.models.video_danmaku import VideoDanmaku
from app.schemas.video_danmaku import VideoDanmakuCreate, VideoDanmakuItem, VideoDanmakuListResponse

router = APIRouter()

ALLOWED_DANMAKU_MODES = {"scroll", "top", "bottom"}


async def _ensure_video_danmaku_table(db: AsyncSession) -> None:
    await db.run_sync(lambda sync_session: VideoDanmaku.__table__.create(sync_session.connection(), checkfirst=True))


def _to_item(record: VideoDanmaku) -> VideoDanmakuItem:
    return VideoDanmakuItem(
        id=int(record.id),
        video_key=str(record.video_key),
        user_id=int(record.user_id),
        user_name=f"学友 {record.user_id}",
        course_id=record.course_id,
        section_id=record.section_id,
        content=str(record.content),
        color=str(record.color or "#ffffff"),
        mode=str(record.mode or "scroll"),
        start_time=float(record.start_time or 0),
        created_at=getattr(record, "created_at", None),
    )


@router.get("", response_model=VideoDanmakuListResponse)
async def list_video_danmaku(
    video_key: str = Query(..., min_length=1, max_length=128, description="视频唯一键"),
    limit: int = Query(200, ge=1, le=500, description="返回数量"),
    db: AsyncSession = Depends(get_db_session),
) -> VideoDanmakuListResponse:
    await _ensure_video_danmaku_table(db)

    stmt = (
        select(VideoDanmaku)
        .where(VideoDanmaku.video_key == video_key, VideoDanmaku.status == "active")
        .order_by(VideoDanmaku.start_time.asc(), VideoDanmaku.id.asc())
        .limit(limit)
    )
    records = (await db.execute(stmt)).scalars().all()
    items = [_to_item(record) for record in records]
    return VideoDanmakuListResponse(total=len(items), items=items)


@router.post("", response_model=VideoDanmakuItem)
async def create_video_danmaku(
    request: VideoDanmakuCreate,
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db_session),
) -> VideoDanmakuItem:
    await _ensure_video_danmaku_table(db)

    mode = (request.mode or "scroll").strip().lower()
    if mode not in ALLOWED_DANMAKU_MODES:
      raise HTTPException(status_code=400, detail="unsupported danmaku mode")

    content = request.content.strip()
    if not content:
        raise HTTPException(status_code=400, detail="弹幕内容不能为空")

    record = VideoDanmaku(
        video_key=request.video_key.strip(),
        user_id=user_id,
        course_id=request.course_id,
        section_id=request.section_id,
        content=content,
        color=request.color.strip() or "#ffffff",
        mode=mode,
        start_time=round(float(request.start_time), 2),
        status="active",
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)
    return _to_item(record)
