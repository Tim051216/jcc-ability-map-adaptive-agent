"""
智能辅导业务：问题提交、AI 解答生成、历史、评价、升级。
"""
from __future__ import annotations

import secrets
import time
from datetime import datetime
from decimal import Decimal
from typing import Any, Awaitable, Callable

from sqlalchemy import and_, exists, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.tutoring_coordinator import TutoringCoordinator
from app.core.logging import logger
from app.db.models.tutoring import (
    EscalationRecord,
    TutoringAnswer,
    TutoringFavorite,
    TutoringQuestion,
    TutoringSession,
)
from app.schemas.tutoring import (
    AnswerEvaluationRequest,
    EscalationRecordCreate,
    TutoringHistoryItem,
    TutoringHistoryQuery,
    TutoringHistoryResponse,
    TutoringQuestionCreate,
    TutoringQuestionResponse,
    TutoringAnswerResponse,
)
from app.services.profile_service import ProfileService
from app.services.tutoring_sensitive import assert_tutoring_text_allowed

EmitFn = Callable[[dict[str, Any]], Awaitable[None]]


def _inclusive_end_calendar_day(dt: datetime) -> datetime:
    """日期选择器常给出结束日 00:00:00，按「含当日」扩展到当天最后一微秒。"""
    if dt.hour == 0 and dt.minute == 0 and dt.second == 0 and dt.microsecond == 0:
        return dt.replace(hour=23, minute=59, second=59, microsecond=999999)
    return dt


class TutoringService:
    """辅导领域服务，依赖 AsyncSession。"""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    @staticmethod
    def _generate_id() -> int:
        return (int(time.time() * 1000) << 20) | secrets.randbelow(1 << 20)

    @staticmethod
    def _coerce_difficulty(raw: Any) -> int | None:
        if raw is None:
            return None
        try:
            return int(raw)
        except (TypeError, ValueError):
            return None

    async def _load_user_profile(self, user_id: int) -> dict[str, Any] | None:
        try:
            prof = await ProfileService().get_latest_profile(user_id)
            if prof is None:
                return None
            return {
                "summary": prof.summary,
                "profile_tags": list(prof.profile_tags or []),
                "recommended_resource_types": list(prof.recommended_resource_types or []),
            }
        except Exception as e:
            logger.warning("tutoring.profile_load_failed", user_id=user_id, error=str(e))
            return None

    async def _get_question(self, question_id: int) -> TutoringQuestion | None:
        stmt = select(TutoringQuestion).where(TutoringQuestion.id == question_id)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def _get_answer(self, answer_id: int) -> TutoringAnswer | None:
        stmt = select(TutoringAnswer).where(TutoringAnswer.id == answer_id)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def _get_answer_by_question(self, question_id: int) -> TutoringAnswer | None:
        stmt = (
            select(TutoringAnswer)
            .where(TutoringAnswer.question_id == question_id)
            .order_by(TutoringAnswer.id.desc())
            .limit(1)
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def _get_open_escalation(self, question_id: int) -> EscalationRecord | None:
        stmt = (
            select(EscalationRecord)
            .where(
                and_(
                    EscalationRecord.question_id == question_id,
                    EscalationRecord.escalation_status.in_([0, 1, 2]),
                )
            )
            .order_by(EscalationRecord.id.desc())
            .limit(1)
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def _is_favorited(self, user_id: int, question_id: int) -> bool:
        stmt = select(TutoringFavorite.id).where(
            and_(
                TutoringFavorite.user_id == user_id,
                TutoringFavorite.question_id == question_id,
            )
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none() is not None

    def _validate_question_text(self, text: str) -> str:
        stripped = (text or "").strip()
        if not stripped:
            raise ValueError("问题内容不能为空")
        if len(stripped) > 20000:
            raise ValueError("问题内容过长")
        assert_tutoring_text_allowed(stripped, field_label="问题")
        return stripped

    async def submit_question(self, user_id: int, request: TutoringQuestionCreate) -> dict[str, Any]:
        text = self._validate_question_text(request.question_text)
        now = datetime.now()

        session_row: TutoringSession
        if request.session_id:
            stmt = select(TutoringSession).where(TutoringSession.id == request.session_id)
            res = await self.db.execute(stmt)
            session_row = res.scalar_one_or_none()
            if not session_row or session_row.user_id != user_id:
                raise ValueError("会话无效或无权访问")
        else:
            sid = self._generate_id()
            session_row = TutoringSession(
                id=sid,
                user_id=user_id,
                course_id=request.course_id,
                section_id=request.section_id,
                session_status=0,
                question_count=0,
                start_time=now,
                end_time=None,
                create_time=now,
                update_time=now,
            )
            self.db.add(session_row)
            await self.db.flush()

        qid = self._generate_id()
        question = TutoringQuestion(
            id=qid,
            session_id=session_row.id,
            user_id=user_id,
            course_id=request.course_id,
            section_id=request.section_id,
            question_text=text,
            question_images=request.question_images,
            question_type=None,
            knowledge_points=None,
            difficulty_level=None,
            question_status=0,
            has_answer=False,
            is_escalated=False,
            create_time=now,
            update_time=now,
        )
        self.db.add(question)

        session_row.question_count = int(session_row.question_count or 0) + 1
        session_row.update_time = now

        await self.db.commit()

        return {"question_id": qid, "session_id": session_row.id}

    async def _persist_coordinator_result(
        self,
        question: TutoringQuestion,
        result: dict[str, Any],
    ) -> dict[str, Any]:
        now = datetime.now()
        analysis = result.get("question_analysis") or {}

        question.question_type = analysis.get("question_type") or question.question_type
        question.knowledge_points = analysis.get("knowledge_points") or question.knowledge_points
        question.difficulty_level = self._coerce_difficulty(
            analysis.get("difficulty_level", question.difficulty_level)
        )
        question.has_answer = True
        question.question_status = 1
        question.update_time = now

        answer_id = self._generate_id()
        confidence = Decimal(str(round(float(result.get("confidence_score") or 0), 2)))
        answer = TutoringAnswer(
            id=answer_id,
            question_id=question.id,
            session_id=question.session_id,
            answer_source=0,
            answerer_id=None,
            answer_text=result.get("answer_text") or "",
            answer_diagrams=result.get("answer_diagrams"),
            answer_videos=result.get("answer_videos"),
            reference_sources=result.get("reference_sources"),
            confidence_score=confidence,
            generation_time=result.get("generation_time_ms"),
            create_time=now,
            update_time=now,
        )
        self.db.add(answer)
        await self.db.commit()

        return {
            "answer_id": answer_id,
            "answer_text": answer.answer_text,
            "diagrams": answer.answer_diagrams or [],
            "videos": answer.answer_videos or [],
            "reference_sources": answer.reference_sources or [],
            "confidence_score": float(confidence),
            "generation_time": answer.generation_time,
            "should_escalate": bool(result.get("should_escalate")),
        }

    async def generate_answer(
        self,
        question_id: int,
        user_id: int,
        *,
        on_event: EmitFn | None = None,
    ) -> dict[str, Any]:
        question = await self._get_question(question_id)
        if not question or question.user_id != user_id:
            raise ValueError("问题不存在或无权访问")

        if question.has_answer:
            existing = await self._get_answer_by_question(question_id)
            if existing:
                existing.view_count = int(existing.view_count or 0) + 1
                existing.update_time = datetime.now()
                await self.db.commit()
                conf = float(existing.confidence_score or 0)
                return {
                    "answer_id": existing.id,
                    "answer_text": existing.answer_text,
                    "diagrams": existing.answer_diagrams or [],
                    "videos": existing.answer_videos or [],
                    "reference_sources": existing.reference_sources or [],
                    "confidence_score": conf,
                    "generation_time": existing.generation_time,
                    "should_escalate": conf < 60.0,
                }

        coordinator = TutoringCoordinator()
        user_profile = await self._load_user_profile(user_id)

        try:
            result = await coordinator.run(
                question_text=question.question_text,
                question_images=question.question_images,
                course_id=question.course_id,
                user_profile=user_profile,
                on_event=on_event,
            )
        except Exception as e:
            logger.exception("tutoring.generate_failed", question_id=question_id)
            raise ValueError(f"解答生成失败: {e}") from e

        return await self._persist_coordinator_result(question, result)

    async def query_history(self, user_id: int, query: TutoringHistoryQuery) -> dict[str, Any]:
        filters = [TutoringQuestion.user_id == user_id]
        if query.course_id is not None:
            filters.append(TutoringQuestion.course_id == query.course_id)
        if query.section_id is not None:
            filters.append(TutoringQuestion.section_id == query.section_id)
        if query.question_type:
            filters.append(TutoringQuestion.question_type == query.question_type)
        if query.start_date is not None:
            filters.append(TutoringQuestion.create_time >= query.start_date)
        if query.end_date is not None:
            filters.append(
                TutoringQuestion.create_time <= _inclusive_end_calendar_day(query.end_date)
            )
        if query.keyword:
            kw = f"%{query.keyword.strip()}%"
            answer_hits = exists().where(
                and_(
                    TutoringAnswer.question_id == TutoringQuestion.id,
                    TutoringAnswer.answer_text.ilike(kw),
                )
            )
            filters.append(
                or_(TutoringQuestion.question_text.ilike(kw), answer_hits)
            )

        base_where = and_(*filters)

        count_stmt = select(func.count()).select_from(TutoringQuestion).where(base_where)
        total = int((await self.db.execute(count_stmt)).scalar_one())

        offset = (query.page - 1) * query.page_size
        stmt = (
            select(TutoringQuestion)
            .where(base_where)
            .order_by(TutoringQuestion.create_time.desc())
            .offset(offset)
            .limit(query.page_size)
        )
        q_result = await self.db.execute(stmt)
        questions = list(q_result.scalars().all())

        question_ids = [q.id for q in questions]
        latest_answers_by_question_id: dict[int, TutoringAnswer] = {}
        favorited_question_ids: set[int] = set()

        if question_ids:
            answers_stmt = (
                select(TutoringAnswer)
                .where(TutoringAnswer.question_id.in_(question_ids))
                .order_by(TutoringAnswer.question_id.asc(), TutoringAnswer.id.desc())
            )
            answers_result = await self.db.execute(answers_stmt)
            for answer in answers_result.scalars().all():
                latest_answers_by_question_id.setdefault(answer.question_id, answer)

            favorites_stmt = select(TutoringFavorite.question_id).where(
                and_(
                    TutoringFavorite.user_id == user_id,
                    TutoringFavorite.question_id.in_(question_ids),
                )
            )
            favorites_result = await self.db.execute(favorites_stmt)
            favorited_question_ids = set(favorites_result.scalars().all())

        items: list[TutoringHistoryItem] = []
        for q in questions:
            ans = latest_answers_by_question_id.get(q.id)
            fav = q.id in favorited_question_ids
            items.append(
                TutoringHistoryItem(
                    question=TutoringQuestionResponse.model_validate(q),
                    answer=TutoringAnswerResponse.model_validate(ans) if ans else None,
                    is_favorited=fav,
                )
            )

        return {
            "total": total,
            "page": query.page,
            "page_size": query.page_size,
            "items": items,
        }

    async def evaluate_answer(self, user_id: int, request: AnswerEvaluationRequest) -> dict[str, Any]:
        answer = await self._get_answer(request.answer_id)
        if not answer:
            raise ValueError("解答不存在")

        question = await self._get_question(answer.question_id)
        if not question or question.user_id != user_id:
            raise ValueError("无权评价该解答")

        if request.user_feedback:
            assert_tutoring_text_allowed(request.user_feedback, field_label="反馈")

        now = datetime.now()
        answer.is_helpful = request.is_helpful
        answer.user_rating = request.user_rating
        answer.user_feedback = request.user_feedback
        answer.update_time = now
        await self.db.commit()

        return {"status": "success"}

    async def create_escalation(self, user_id: int, request: EscalationRecordCreate) -> dict[str, Any]:
        question = await self._get_question(request.question_id)
        if not question or question.user_id != user_id:
            raise ValueError("问题不存在或无权访问")

        existing = await self._get_open_escalation(question.id)
        if existing is not None:
            return {
                "status": "success",
                "escalation_id": existing.id,
                "estimated_response_minutes": 120,
                "message": "已有处理中人工升级记录，请耐心等待",
            }

        now = datetime.now()
        eid = self._generate_id()
        record = EscalationRecord(
            id=eid,
            question_id=question.id,
            session_id=question.session_id,
            user_id=user_id,
            escalation_reason=request.escalation_reason,
            ai_confidence_score=request.ai_confidence_score,
            escalation_status=0,
            create_time=now,
            update_time=now,
        )
        self.db.add(record)

        question.is_escalated = True
        question.question_status = 2
        question.update_time = now

        await self.db.commit()

        return {
            "status": "success",
            "escalation_id": eid,
            "estimated_response_minutes": 120,
            "message": "已提交人工处理，预计 2 小时内响应",
        }
