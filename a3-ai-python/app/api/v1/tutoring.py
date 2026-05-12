"""
智能辅导 API
"""
import json
from datetime import datetime

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user_id, get_db_session, get_websocket_user_id
from app.db.session import async_session_factory
from app.schemas.tutoring import (
    AnswerEvaluationRequest,
    EscalationRecordCreate,
    EscalationRecordResponse,
    OcrPreviewRequest,
    OcrPreviewResponse,
    TutoringImageUploadResponse,
    TutoringAnswerResponse,
    TutoringHistoryQuery,
    TutoringHistoryResponse,
    TutoringQuestionCreate,
    TutoringQuestionResponse,
)
from app.services.tutoring_image_storage import upload_tutoring_question_image
from app.services.tutoring_ocr_service import extract_text_from_base64_image
from app.services.tutoring_service import TutoringService

router = APIRouter()


@router.post("/ocr-preview", response_model=OcrPreviewResponse)
async def ocr_preview(
    request: OcrPreviewRequest,
    user_id: int = Depends(get_current_user_id),
) -> OcrPreviewResponse:
    """
    识别题目配图中的文字（可选：需 `poetry install --extras ocr` 与系统 Tesseract）。
    未安装依赖时返回空 text 与安装说明，不影响提交问题流程。
    """
    _ = user_id
    try:
        text, engine, hint = extract_text_from_base64_image(request.image_base64)
        return OcrPreviewResponse(text=text, engine=engine, hint=hint)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OCR 失败: {str(e)}")


@router.post("/upload-image", response_model=TutoringImageUploadResponse)
async def upload_tutoring_image(
    file: UploadFile = File(...),
    user_id: int = Depends(get_current_user_id),
) -> TutoringImageUploadResponse:
    """
    将辅导配图上传到 MinIO，返回 URL 供 question_images 使用。
    未配置公网前缀时返回短期预签名 URL。失败时前端可回退为 Base64。
    """
    try:
        data = await file.read()
        url = upload_tutoring_question_image(
            user_id,
            data,
            file.content_type or "application/octet-stream",
        )
        return TutoringImageUploadResponse(url=url)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"对象存储不可用: {str(e)}")


@router.post("/question", response_model=dict)
async def submit_question(
    request: TutoringQuestionCreate,
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    """
    提交问题
    
    支持文字+图片问题
    返回问题ID和会话ID
    """
    service = TutoringService(db)
    try:
        result = await service.submit_question(user_id, request)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"问题提交失败: {str(e)}")


@router.get("/answer/{question_id}", response_model=dict)
async def get_answer(
    question_id: int,
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    """
    获取解答
    
    如果解答不存在，会触发生成流程
    返回完整解答和生成状态
    """
    service = TutoringService(db)
    try:
        # 先尝试获取已有解答
        question = await service._get_question(question_id)
        if not question or question.user_id != user_id:
            raise HTTPException(status_code=404, detail="问题不存在或无权访问")

        # 如果已有解答，直接返回
        if question.has_answer:
            answer = await service._get_answer_by_question(question_id)
            if answer:
                answer.view_count = int(getattr(answer, "view_count", 0) or 0) + 1
                answer.update_time = datetime.now()
                await db.commit()
                conf = float(answer.confidence_score or 0)
                return {
                    "status": "completed",
                    "answer_id": answer.id,
                    "answer_text": answer.answer_text,
                    "diagrams": answer.answer_diagrams,
                    "videos": answer.answer_videos,
                    "reference_sources": answer.reference_sources,
                    "confidence_score": conf,
                    "generation_time": answer.generation_time,
                    "should_escalate": conf < 60.0,
                }

        # 如果没有解答，生成新解答
        result = await service.generate_answer(question_id, user_id)
        return {
            "status": "completed",
            **result,
        }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"解答获取失败: {str(e)}")


@router.get("/history", response_model=TutoringHistoryResponse)
async def get_history(
    course_id: int | None = Query(None, description="课程ID"),
    section_id: int | None = Query(None, description="章节ID"),
    question_type: str | None = Query(None, description="问题类型"),
    keyword: str | None = Query(
        None, description="关键词（匹配问题正文或解答正文，ILIKE）"
    ),
    start_date: datetime | None = Query(
        None, description="创建时间起（含），ISO8601"
    ),
    end_date: datetime | None = Query(
        None,
        description="创建时间止；若仅日期且时刻为 00:00:00 则含该日全天",
    ),
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db_session),
) -> TutoringHistoryResponse:
    """
    查询答疑历史
    
    支持多条件筛选和分页
    """
    service = TutoringService(db)
    try:
        query = TutoringHistoryQuery(
            user_id=user_id,
            course_id=course_id,
            section_id=section_id,
            question_type=question_type,
            keyword=keyword,
            start_date=start_date,
            end_date=end_date,
            page=page,
            page_size=page_size,
        )
        result = await service.query_history(user_id, query)
        return TutoringHistoryResponse(**result)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"历史查询失败: {str(e)}")


@router.post("/evaluate", response_model=dict)
async def evaluate_answer(
    request: AnswerEvaluationRequest,
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    """
    评价解答
    
    接收评分和反馈，记录评价数据
    """
    service = TutoringService(db)
    try:
        result = await service.evaluate_answer(user_id, request)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"评价失败: {str(e)}")


@router.post("/escalate", response_model=dict)
async def escalate_question(
    request: EscalationRecordCreate,
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    """
    升级问题到人工
    
    触发人工升级，返回预计响应时间
    """
    service = TutoringService(db)
    try:
        result = await service.create_escalation(user_id, request)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"升级失败: {str(e)}")


@router.post("/favorite", response_model=dict)
async def add_favorite(
    question_id: int,
    answer_id: int,
    note: str | None = None,
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    """
    收藏答疑记录
    """
    from app.db.models.tutoring import TutoringFavorite

    service = TutoringService(db)

    # 验证问题和解答
    question = await service._get_question(question_id)
    if not question or question.user_id != user_id:
        raise HTTPException(status_code=404, detail="问题不存在或无权访问")

    answer = await service._get_answer(answer_id)
    if not answer or answer.question_id != question_id:
        raise HTTPException(status_code=404, detail="解答不存在")

    # 检查是否已收藏
    if await service._is_favorited(user_id, question_id):
        raise HTTPException(status_code=400, detail="已收藏")

    # 创建收藏
    favorite = TutoringFavorite(
        id=service._generate_id(),
        user_id=user_id,
        question_id=question_id,
        answer_id=answer_id,
        favorite_note=note,
        create_time=datetime.now(),
    )

    db.add(favorite)
    await db.commit()

    return {"status": "success", "favorite_id": favorite.id}


@router.websocket("/stream/{question_id}")
async def stream_tutoring_answer(websocket: WebSocket, question_id: int) -> None:
    """
    WebSocket 流式推送辅导生成进度与结果。

    鉴权：支持 `access_token`、`Authorization: Bearer ...`、`X-User-Id`、`user_id` 查询参数。
    消息为 JSON：chunk_type = step | complete | saved | error。
    """
    await websocket.accept()
    try:
        try:
            user_id = get_websocket_user_id(websocket)
        except HTTPException:
            await websocket.send_text(
                json.dumps({"chunk_type": "error", "content": "missing authentication"}, ensure_ascii=False)
            )
            await websocket.close(code=4401)
            return

        async with async_session_factory() as db:
            service = TutoringService(db)
            question = await service._get_question(question_id)
            if not question or question.user_id != user_id:
                await websocket.send_text(
                    json.dumps(
                        {"chunk_type": "error", "content": "问题不存在或无权访问"},
                        ensure_ascii=False,
                    )
                )
                await websocket.close(code=4404)
                return

            if question.has_answer:
                answer = await service._get_answer_by_question(question_id)
                if answer:
                    answer.view_count = int(getattr(answer, "view_count", 0) or 0) + 1
                    answer.update_time = datetime.now()
                    await db.commit()
                    conf = float(answer.confidence_score or 0)
                    await websocket.send_text(
                        json.dumps(
                            {
                                "chunk_type": "complete",
                                "content": {
                                    "status": "completed",
                                    "answer_id": answer.id,
                                    "answer_text": answer.answer_text,
                                    "diagrams": answer.answer_diagrams or [],
                                    "videos": answer.answer_videos or [],
                                    "reference_sources": answer.reference_sources or [],
                                    "confidence_score": conf,
                                    "generation_time": answer.generation_time,
                                    "should_escalate": conf < 60.0,
                                },
                            },
                            ensure_ascii=False,
                        )
                    )
                await websocket.close()
                return

            async def emit(msg: dict) -> None:
                await websocket.send_text(json.dumps(msg, ensure_ascii=False))

            try:
                result = await service.generate_answer(question_id, user_id, on_event=emit)
                await websocket.send_text(
                    json.dumps({"chunk_type": "saved", "content": result}, ensure_ascii=False)
                )
            except ValueError as e:
                await websocket.send_text(
                    json.dumps({"chunk_type": "error", "content": str(e)}, ensure_ascii=False)
                )
        await websocket.close()
    except WebSocketDisconnect:
        pass
    except Exception as e:
        try:
            await websocket.send_text(
                json.dumps({"chunk_type": "error", "content": str(e)}, ensure_ascii=False)
            )
        except Exception:
            pass
        await websocket.close(code=1011)


@router.delete("/favorite/{question_id}", response_model=dict)
async def remove_favorite(
    question_id: int,
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    """
    取消收藏
    """
    from sqlalchemy import select, and_
    from app.db.models.tutoring import TutoringFavorite

    stmt = select(TutoringFavorite).where(
        and_(
            TutoringFavorite.user_id == user_id,
            TutoringFavorite.question_id == question_id,
        )
    )
    result = await db.execute(stmt)
    favorite = result.scalar_one_or_none()

    if not favorite:
        raise HTTPException(status_code=404, detail="收藏不存在")

    await db.delete(favorite)
    await db.commit()

    return {"status": "success"}
