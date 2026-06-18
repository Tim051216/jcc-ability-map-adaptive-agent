"""
智能辅导 API
"""
import asyncio
import json
from datetime import datetime
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user_id, get_db_session, get_websocket_user_id
from app.agents.tutoring_coordinator import TutoringCoordinator
from app.core.config import settings
from app.db.session import get_db
from app.schemas.tutoring import (
    AnswerEvaluationRequest,
    EscalationRecordCreate,
    EscalationListResponse,
    EscalationDetailResponse,
    EscalationRecordResponse,
    ExpertAnswerSubmitRequest,
    ExpertAssignmentRequest,
    OcrPreviewRequest,
    OcrPreviewResponse,
    TutoringImageUploadResponse,
    TutoringAnswerResponse,
    TutoringHistoryQuery,
    TutoringHistoryResponse,
    TutoringTaskHistoryResponse,
    TutoringTaskStatusResponse,
    TutoringTaskSubmitResponse,
    TutoringQuestionCreate,
    TutoringQuestionResponse,
)
from app.services.tutoring_image_storage import upload_tutoring_attachment
from app.services.tutoring_memory_store import memory_tutoring_store
from app.services.tutoring_ocr_service import extract_text_from_base64_image
from app.services.tutoring_service import TutoringBillingError, TutoringService
from app.services.tutoring_task_service import TutoringTaskService
from app.services.guardrail_service import GuardrailContext, GuardrailService

router = APIRouter()
async_session_factory = get_db
_background_generating_questions: set[int] = set()


async def _generate_memory_answer(question_id: int) -> None:
    question = memory_tutoring_store.get_question(question_id)
    if not question:
        memory_tutoring_store.unmark_generating(question_id)
        return

    try:
        result = await TutoringCoordinator().run(
            question_text=question.get("question_text") or "",
            question_images=question.get("question_images"),
            course_id=question.get("course_id"),
            user_profile=None,
            persona=question.get("persona"),
            on_event=None,
        )
        reviewed_answer_text, safety_review, hallucination_review = await _review_memory_answer(
            question=question,
            answer_text=result.get("answer_text", ""),
            reference_sources=result.get("reference_sources") or [],
        )
        memory_tutoring_store.save_answer(
            question_id,
            {
                "answer_text": reviewed_answer_text,
                "diagrams": result.get("answer_diagrams") or [],
                "videos": result.get("answer_videos") or [],
                "reference_sources": result.get("reference_sources") or [],
                "confidence_score": result.get("confidence_score") or 0,
                "generation_time": result.get("generation_time_ms"),
                "should_escalate": bool(result.get("should_escalate")),
                "question_type": (result.get("question_analysis") or {}).get("question_type"),
                "knowledge_points": (result.get("question_analysis") or {}).get("knowledge_points") or [],
                "safety_review": safety_review,
                "hallucination_review": hallucination_review,
            },
        )
    except Exception as exc:
        memory_tutoring_store.save_error(question_id, str(exc))
    finally:
        memory_tutoring_store.unmark_generating(question_id)


async def _generate_db_answer(question_id: int, user_id: int) -> None:
    if question_id in _background_generating_questions:
        return
    _background_generating_questions.add(question_id)
    try:
        async with async_session_factory() as db:
            service = TutoringService(db)
            await service.generate_answer(question_id, user_id)
    except Exception as exc:
        # Generation errors should already be persisted in the service layer.
        # Keep a log here so background-task failures do not become silent.
        from app.core.logging import logger

        logger.exception(
            "tutoring.background_generate_failed",
            question_id=question_id,
            user_id=user_id,
            error=str(exc),
        )
    finally:
        _background_generating_questions.discard(question_id)


def _build_memory_answer_response(question: dict, answer: dict | None = None) -> dict:
    if answer is None:
        failure_reason = memory_tutoring_store.get_error(int(question["id"]))
        if failure_reason:
            return {
                "status": "failed",
                "question_id": question["id"],
                "session_id": question["session_id"],
                "answer_id": None,
                "answer_text": "",
                "diagrams": [],
                "videos": [],
                "reference_sources": [],
                "confidence_score": 0,
            "generation_time": None,
            "should_escalate": bool(question.get("is_escalated")),
            "question_type": question.get("question_type"),
            "knowledge_points": question.get("knowledge_points") or [],
            "safety_review": None,
            "hallucination_review": None,
            "error": failure_reason,
        }
        return {
            "status": "processing",
            "question_id": question["id"],
            "session_id": question["session_id"],
            "answer_id": None,
            "answer_text": "",
            "diagrams": [],
            "videos": [],
            "reference_sources": [],
            "confidence_score": 0,
            "generation_time": None,
            "should_escalate": bool(question.get("is_escalated")),
            "question_type": question.get("question_type"),
            "knowledge_points": question.get("knowledge_points") or [],
            "safety_review": None,
            "hallucination_review": None,
        }
    return {
        "status": "completed",
        "question_id": question["id"],
        "session_id": question["session_id"],
        "answer_id": answer["id"],
        "answer_text": answer["answer_text"],
        "diagrams": answer["answer_diagrams"] or [],
        "videos": answer["answer_videos"] or [],
        "reference_sources": answer["reference_sources"] or [],
        "confidence_score": float(answer["confidence_score"] or 0),
        "generation_time": answer["generation_time"],
        "should_escalate": bool(question.get("is_escalated")),
        "question_type": question.get("question_type"),
        "knowledge_points": question.get("knowledge_points") or [],
        "safety_review": answer.get("safety_review"),
        "hallucination_review": answer.get("hallucination_review"),
    }


def _get_memory_question_if_owned(question_id: int, user_id: int) -> dict | None:
    question = memory_tutoring_store.get_question(question_id)
    if question is None:
        return None
    if question.get("user_id") != user_id:
        raise HTTPException(status_code=404, detail="问题不存在或无权访问")
    return question


def _extract_memory_citations(reference_sources: list[dict] | None) -> list[str]:
    citations: list[str] = []
    for item in reference_sources or []:
        if not isinstance(item, dict):
            continue
        title = str(item.get("title") or "").strip()
        excerpt = str(item.get("excerpt") or "").strip()
        url = str(item.get("url") or "").strip()
        merged = " ".join(part for part in [title, excerpt, url] if part)
        if merged:
            citations.append(merged)
    return citations


async def _review_memory_answer(
    *,
    question: dict,
    answer_text: str,
    reference_sources: list[dict] | None = None,
) -> tuple[str, dict | None, dict | None]:
    citations = _extract_memory_citations(reference_sources)
    review = await GuardrailService().review_output(
        answer_text,
        context=GuardrailContext(
            scene="tutoring_answer",
            course_id=question.get("course_id"),
            user_id=question.get("user_id"),
            citations=citations,
        ),
        citations=citations,
    )
    safe_answer_text = answer_text
    if review.output_review and review.output_review.blocked:
        safe_answer_text = (
            review.output_review.rewritten_text
            or "当前回答触发了内容安全保护，请换个问题继续。"
        )
    return (
        safe_answer_text,
        {"output_review": review.output_review.model_dump(mode="json")}
        if review.output_review
        else None,
        review.hallucination_review.model_dump(mode="json")
        if review.hallucination_review
        else None,
    )


async def _can_connect_local_tutoring_db() -> bool:
    dsn = settings.local_postgres_dsn
    if not dsn:
        return False
    parsed = urlparse(dsn)
    host = parsed.hostname or "127.0.0.1"
    port = parsed.port or 5432
    writer = None
    try:
        reader, writer = await asyncio.wait_for(asyncio.open_connection(host, port), timeout=0.25)
        return True
    except Exception:
        return False
    finally:
        if writer is not None:
            writer.close()
            try:
                await writer.wait_closed()
            except Exception:
                pass


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
        result = upload_tutoring_attachment(
            user_id,
            data,
            file.content_type or "application/octet-stream",
        )
        return TutoringImageUploadResponse(url=result.url, extracted_text=result.extracted_text)
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


@router.post("/tasks", response_model=TutoringTaskSubmitResponse)
async def submit_tutoring_task(
    request: TutoringQuestionCreate,
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db_session),
) -> TutoringTaskSubmitResponse:
    service = TutoringTaskService(db)
    try:
        return await service.submit_task(user_id, request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"异步答疑任务提交失败: {str(e)}")


@router.get("/tasks/{task_id}", response_model=TutoringTaskStatusResponse)
async def get_tutoring_task_status(
    task_id: int,
    db: AsyncSession = Depends(get_db_session),
) -> TutoringTaskStatusResponse:
    service = TutoringTaskService(db)
    result = await service.get_task_status(task_id)
    if result is None:
        raise HTTPException(status_code=404, detail="tutoring task not found")
    return result


@router.get("/tasks", response_model=TutoringTaskHistoryResponse)
async def list_tutoring_tasks(
    course_id: int | None = Query(None, description="课程ID"),
    limit: int = Query(10, ge=1, le=50, description="返回数量"),
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db_session),
) -> TutoringTaskHistoryResponse:
    service = TutoringTaskService(db)
    return await service.list_tasks(user_id=user_id, course_id=course_id, limit=limit)


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
                return {
                    "status": "completed",
                    **(await service.build_answer_payload(question=question, answer=answer)),
                }

        asyncio.create_task(_generate_db_answer(question_id, user_id))
        return {
            "status": "processing",
            "question_id": question.id,
            "session_id": question.session_id,
            "answer_id": None,
            "answer_text": "",
            "diagrams": [],
            "videos": [],
            "reference_sources": [],
            "confidence_score": 0,
            "generation_time": None,
            "should_escalate": bool(getattr(question, "is_escalated", False)),
            "question_type": getattr(question, "question_type", None),
            "knowledge_points": getattr(question, "knowledge_points", []) or [],
            "safety_review": None,
            "hallucination_review": None,
            "source": "ai",
            "fallback_reason": None,
        }

    except TutoringBillingError as e:
        raise HTTPException(status_code=503, detail=str(e))
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


@router.get("/escalations", response_model=EscalationListResponse)
async def list_escalations(
    course_id: int | None = Query(None, description="课程ID"),
    escalation_status: int | None = Query(None, description="升级状态"),
    assigned_expert_id: int | None = Query(None, description="专家ID"),
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db_session),
) -> EscalationListResponse:
    """查询当前用户的人工升级记录。"""
    service = TutoringService(db)
    try:
        result = await service.list_escalations(
            user_id,
            course_id=course_id,
            escalation_status=escalation_status,
            assigned_expert_id=assigned_expert_id,
            page=page,
            page_size=page_size,
        )
        return EscalationListResponse(**result)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"升级记录查询失败: {str(e)}")


@router.get("/escalations/{escalation_id}", response_model=EscalationDetailResponse)
async def get_escalation_detail(
    escalation_id: int,
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db_session),
) -> EscalationDetailResponse:
    """查询单条升级记录详情。"""
    service = TutoringService(db)
    try:
        result = await service.get_escalation_detail(escalation_id, user_id=user_id)
        return EscalationDetailResponse.model_validate(result)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"升级详情查询失败: {str(e)}")


@router.post("/escalations/assign", response_model=dict)
async def assign_escalation(
    request: ExpertAssignmentRequest,
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    """为升级记录分配处理专家。"""
    service = TutoringService(db)
    try:
        return await service.assign_escalation(request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"专家分配失败: {str(e)}")


@router.post("/escalations/answer", response_model=dict)
async def submit_expert_answer(
    request: ExpertAnswerSubmitRequest,
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    """提交人工专家解答并关闭升级记录。"""
    service = TutoringService(db)
    try:
        return await service.submit_expert_answer(request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"人工解答提交失败: {str(e)}")


@router.get("/admin/escalations", response_model=EscalationListResponse)
async def admin_list_escalations(
    course_id: int | None = Query(None, description="课程ID"),
    escalation_status: int | None = Query(None, description="升级状态"),
    assigned_expert_id: int | None = Query(None, description="专家ID"),
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    db: AsyncSession = Depends(get_db_session),
) -> EscalationListResponse:
    """管理员查询全量升级记录。"""
    service = TutoringService(db)
    try:
        result = await service.list_escalations(
            None,
            course_id=course_id,
            escalation_status=escalation_status,
            assigned_expert_id=assigned_expert_id,
            page=page,
            page_size=page_size,
        )
        return EscalationListResponse(**result)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"管理员升级记录查询失败: {str(e)}")


@router.get("/admin/escalations/{escalation_id}", response_model=EscalationDetailResponse)
async def admin_get_escalation_detail(
    escalation_id: int,
    db: AsyncSession = Depends(get_db_session),
) -> EscalationDetailResponse:
    """管理员查询单条升级记录详情。"""
    service = TutoringService(db)
    try:
        result = await service.get_escalation_detail(escalation_id)
        return EscalationDetailResponse.model_validate(result)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"管理员升级详情查询失败: {str(e)}")


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

        memory_question = _get_memory_question_if_owned(question_id, user_id)
        if memory_question is not None:
            cached_answer = memory_tutoring_store.get_answer_by_question(question_id)
            if cached_answer is not None:
                await websocket.send_text(
                    json.dumps(
                        {
                            "chunk_type": "complete",
                            "content": _build_memory_answer_response(memory_question, cached_answer),
                        },
                        ensure_ascii=False,
                    )
                )
                await websocket.close()
                return

            failure_reason = memory_tutoring_store.get_error(question_id)
            if failure_reason:
                await websocket.send_text(
                    json.dumps(
                        {
                            "chunk_type": "error",
                            "content": failure_reason,
                        },
                        ensure_ascii=False,
                    )
                )
                await websocket.close(code=4500)
                return

            if memory_tutoring_store.is_generating(question_id):
                await websocket.send_text(
                    json.dumps(
                        {
                            "chunk_type": "step",
                            "content": "generating",
                            "metadata": {"label": "生成答案"},
                        },
                        ensure_ascii=False,
                    )
                )
                while memory_tutoring_store.is_generating(question_id):
                    await asyncio.sleep(0.25)
                cached_answer = memory_tutoring_store.get_answer_by_question(question_id)
                if cached_answer is not None:
                    await websocket.send_text(
                        json.dumps(
                            {"chunk_type": "saved", "content": _build_memory_answer_response(memory_question, cached_answer)},
                            ensure_ascii=False,
                        )
                    )
                    await websocket.close()
                    return
                failure_reason = memory_tutoring_store.get_error(question_id)
                if failure_reason:
                    await websocket.send_text(
                        json.dumps({"chunk_type": "error", "content": failure_reason}, ensure_ascii=False)
                    )
                    await websocket.close(code=4500)
                    return

            async def emit_memory(msg: dict) -> None:
                await websocket.send_text(json.dumps(msg, ensure_ascii=False))

            persona = memory_question.get("persona")
            memory_tutoring_store.mark_generating(question_id)
            try:
                result = await TutoringCoordinator().run(
                    question_text=memory_question.get("question_text") or "",
                    question_images=memory_question.get("question_images"),
                    course_id=memory_question.get("course_id"),
                    user_profile=None,
                    persona=persona,
                    on_event=emit_memory,
                )
                reviewed_answer_text, safety_review, hallucination_review = await _review_memory_answer(
                    question=memory_question,
                    answer_text=result.get("answer_text", ""),
                    reference_sources=result.get("reference_sources") or [],
                )
                saved = memory_tutoring_store.save_answer(
                    question_id,
                    {
                        "answer_text": reviewed_answer_text,
                        "diagrams": result.get("answer_diagrams") or [],
                        "videos": result.get("answer_videos") or [],
                        "reference_sources": result.get("reference_sources") or [],
                        "confidence_score": result.get("confidence_score") or 0,
                        "generation_time": result.get("generation_time_ms"),
                        "should_escalate": bool(result.get("should_escalate")),
                        "question_type": (result.get("question_analysis") or {}).get("question_type"),
                        "knowledge_points": (result.get("question_analysis") or {}).get("knowledge_points") or [],
                        "safety_review": safety_review,
                        "hallucination_review": hallucination_review,
                    },
                )
                await websocket.send_text(
                    json.dumps(
                        {"chunk_type": "saved", "content": _build_memory_answer_response(memory_question, saved)},
                        ensure_ascii=False,
                    )
                )
                await websocket.close()
                return
            except Exception as exc:
                memory_tutoring_store.save_error(question_id, str(exc))
                await websocket.send_text(
                    json.dumps({"chunk_type": "error", "content": str(exc)}, ensure_ascii=False)
                )
                await websocket.close(code=4500)
                return

        async with get_db() as db:
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
                    await websocket.send_text(
                        json.dumps(
                            {
                                "chunk_type": "complete",
                                "content": {"status": "completed", **(await service.build_answer_payload(question=question, answer=answer))},
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


@router.delete("/question/{question_id}", response_model=dict)
async def delete_history_item(
    question_id: int,
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    """删除当前用户的一条答疑历史记录。"""
    service = TutoringService(db)
    try:
        return await service.delete_history_item(user_id, question_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"删除答疑记录失败: {str(e)}")
