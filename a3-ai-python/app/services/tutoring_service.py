"""Tutoring service layer."""
from __future__ import annotations

import asyncio
import re
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
    ExpertAnswerSubmitRequest,
    ExpertAssignmentRequest,
    TutoringAnswerResponse,
    TutoringHistoryItem,
    TutoringHistoryQuery,
    TutoringHistoryResponse,
    TutoringQuestionCreate,
    TutoringQuestionResponse,
)
from app.services.course_service import CourseService
from app.services.guardrail_service import GuardrailContext, GuardrailService, GuardrailViolationError
from app.services.llm_health_service import LLMHealthService
from app.services.profile_service import ProfileService
from app.services.tutoring_sensitive import assert_tutoring_text_allowed

EmitFn = Callable[[dict[str, Any]], Awaitable[None]]
PERSONA_PREFIX_RE = r"^\[(haibara|usagi)\]\s*"


class TutoringBillingError(ValueError):
    """Raised when upstream model access is blocked by billing/account state."""


def _inclusive_end_calendar_day(dt: datetime) -> datetime:
    """Expand midnight end dates to the end of the same calendar day."""
    if dt.hour == 0 and dt.minute == 0 and dt.second == 0 and dt.microsecond == 0:
        return dt.replace(hour=23, minute=59, second=59, microsecond=999999)
    return dt


class TutoringService:
    """Tutoring domain service backed by AsyncSession."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.guardrail_service = GuardrailService()

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

    @staticmethod
    def _repair_mojibake_text(value: Any) -> Any:
        if not isinstance(value, str):
            return value
        text = value.strip()
        if not text:
            return value
        suspicious_markers = ("Ã", "Â", "â", "è", "æ", "å", "ç", "é")
        if any(marker in text for marker in suspicious_markers):
            try:
                repaired = text.encode("latin1").decode("utf-8")
                if repaired:
                    return repaired
            except (UnicodeEncodeError, UnicodeDecodeError):
                pass
            try:
                repaired_gbk = text.encode("cp1252", errors="ignore").decode("gbk")
                if repaired_gbk and repaired_gbk != text:
                    return repaired_gbk
            except (UnicodeEncodeError, UnicodeDecodeError, LookupError):
                pass
        return value

    @classmethod
    def _repair_mojibake_payload(cls, value: Any) -> Any:
        if isinstance(value, str):
            return cls._repair_mojibake_text(value)
        if isinstance(value, list):
            return [cls._repair_mojibake_payload(item) for item in value]
        if isinstance(value, dict):
            return {key: cls._repair_mojibake_payload(item) for key, item in value.items()}
        return value

    @staticmethod
    def _contains_placeholder_noise(value: Any) -> bool:
        if not isinstance(value, str):
            return False
        text = value.strip()
        if not text:
            return False
        return "????????" in text or text.count("?") >= 6

    @staticmethod
    def _looks_like_billing_error_message(message: str | None) -> bool:
        normalized = str(message or "").lower()
        markers = (
            "arrearage",
            "overdue-payment",
            "account is in good standing",
            "access denied, please make sure your account is in good standing",
            "llm billing unavailable",
            "欠费",
            "余额不足",
        )
        return any(marker in normalized for marker in markers)

    @classmethod
    def _is_local_fallback_result(cls, result: dict[str, Any] | None) -> bool:
        if not isinstance(result, dict):
            return False
        if result.get("fallback_reason"):
            return True
        for item in result.get("reference_sources") or []:
            if not isinstance(item, dict):
                continue
            title = str(item.get("title") or "")
            excerpt = str(item.get("excerpt") or "")
            if "本地辅导兜底回答" in title or "生成链路异常" in excerpt:
                return True
        return False

    async def _raise_if_billing_unavailable(self) -> None:
        health = await LLMHealthService().ping()
        if str(health.get("status") or "").lower() != "unavailable":
            return
        if self._looks_like_billing_error_message(str(health.get("message") or "")):
            raise TutoringBillingError("AI 模型服务当前因账号欠费不可用，请先充值后再试。")

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
        except TimeoutError:
            logger.warning("tutoring.profile_load_timeout", user_id=user_id)
            return None
        except (Exception, OSError) as e:
            logger.warning("tutoring.profile_load_failed", user_id=user_id, error=str(e))
            return None

    @staticmethod
    def _normalize_persona(raw: Any) -> str | None:
        persona = str(raw or "").strip().lower()
        if persona in {"haibara", "usagi"}:
            return persona
        return None

    @classmethod
    def _compose_storage_question_text(cls, text: str, persona: str | None) -> str:
        normalized_persona = cls._normalize_persona(persona)
        if not normalized_persona:
            return text
        return f"[{normalized_persona}] {text}"

    @classmethod
    def _extract_persona_and_clean_text(cls, text: str) -> tuple[str | None, str]:
        stripped = str(text or "").strip()
        match = re.match(PERSONA_PREFIX_RE, stripped, flags=re.IGNORECASE)
        if not match:
            return None, stripped
        persona = cls._normalize_persona(match.group(1))
        cleaned = re.sub(PERSONA_PREFIX_RE, "", stripped, count=1, flags=re.IGNORECASE).strip()
        return persona, cleaned

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
        stripped = str(text or "").strip()
        if not stripped:
            raise ValueError("闂鍐呭涓嶈兘涓虹┖")
        if len(stripped) > 20000:
            raise ValueError("闂鍐呭杩囬暱")
        assert_tutoring_text_allowed(stripped, field_label="闂")
        return stripped

    def _build_guardrail_context(
        self,
        *,
        scene: str,
        course_id: int | None = None,
        user_id: int | None = None,
        citations: list[str] | None = None,
    ) -> GuardrailContext:
        return GuardrailContext(
            scene=scene,
            course_id=course_id,
            user_id=user_id,
            citations=citations,
        )

    def _extract_reference_citations(
        self,
        reference_sources: list[dict[str, Any]] | None,
    ) -> list[str]:
        citations: list[str] = []
        for item in reference_sources or []:
            if not isinstance(item, dict):
                continue
            title = str(item.get("title") or "").strip()
            excerpt = str(item.get("excerpt") or "").strip()
            url = str(item.get("url") or "").strip()
            snippet = " ".join(part for part in [title, excerpt, url] if part)
            if snippet:
                citations.append(snippet)
        return citations

    @classmethod
    def _build_local_fallback_result(
        cls,
        *,
        question_text: str,
        course_id: int | None,
        question_images: list[str] | None,
        failure_reason: str,
    ) -> dict[str, Any]:
        clean_text = str(question_text or "").strip()
        if clean_text.startswith("[haibara] "):
            clean_text = clean_text[len("[haibara] "):]
        elif clean_text.startswith("[usagi] "):
            clean_text = clean_text[len("[usagi] "):]
        if cls._contains_placeholder_noise(clean_text):
            clean_text = ""
        answer_text = cls._build_study_plan_fallback(clean_text, course_id)
        if not answer_text:
            course_hint = f"当前课程 ID 为 {course_id}。" if course_id is not None else "当前课程上下文已接入。"
            image_hint = "我也注意到你这次附带了截图，可以继续围绕截图里的重点追问。" if question_images else ""
            answer_text = (
                "我已经接住你这次的提问。\n\n"
                "当前 AI 深度生成链路暂时波动，我先给你一个可继续学习的简版回答，避免这轮对话卡住。\n"
                f"{course_hint}\n"
                "建议你现在直接做这 3 步：\n"
                "1. 先把你最卡的一句话、概念或报错点再具体一点说出来。\n"
                "2. 如果这是课程知识点问题，补充当前章节或视频位置，我会按课程上下文继续解释。\n"
                "3. 如果这是代码或题目问题，直接贴代码、公式或题干，我会继续帮你拆解。\n\n"
                f"{image_hint}\n"
                "这次我先保证你能继续问、继续学；等完整生成链路恢复后，会再给你更完整的解析、资料和延伸推荐。"
            ).strip()
        return {
            "answer_text": answer_text,
            "answer_diagrams": [],
            "answer_videos": [],
            "reference_sources": [
                {
                    "title": "本地辅导兜底回答",
                    "excerpt": "在生成链路异常时，先返回可执行的学习建议，保证对话不中断。",
                    "url": "",
                }
            ],
            "confidence_score": 62.0,
            "generation_time_ms": 120,
            "should_escalate": False,
            "question_analysis": {
                "question_type": "学习问答",
                "knowledge_points": ["问题澄清", "上下文补充"],
                "difficulty_level": 2,
            },
            "fallback_reason": failure_reason,
        }

    @classmethod
    def _build_study_plan_fallback(cls, question_text: str, course_id: int | None) -> str:
        normalized = str(question_text or "").strip()
        course = next((item for item in CourseService.COURSE_FIXTURES if item.get("id") == course_id), None)
        chapters = list(course.get("chapters") or [])[:3] if course else []
        should_return_study_order = any(
            token in normalized for token in ("复习顺序", "学习顺序", "先复习", "先学哪", "哪一章", "怎么复习")
        )
        if not should_return_study_order and not (not normalized and chapters):
            return ""
        if not chapters:
            return (
                "先按“基础概念 -> 需求与设计 -> 实现测试与管理”这条主线复习，不要跳着看。"
                "\n1. 先把基础概念和软件工程主线过一遍，确保术语不混。"
                "\n2. 再复习需求分析、总体设计和可行性分析，把文档关系串起来。"
                "\n3. 最后回到实现、测试、维护和项目管理，用一个完整案例检查自己能不能从头讲到尾。"
            )

        chapter_labels = [f"{item.get('index', '')}{item.get('name', '')}".strip() for item in chapters]
        lines = [
            "这门课更适合按主线递进复习，不建议从中间章节跳着看。",
            f"1. 先复习 {chapter_labels[0]}：先把软件危机、软件工程概念和过程模型站稳，不然后面需求和设计会散。",
        ]
        if len(chapter_labels) > 1:
            lines.append(
                f"2. 再复习 {chapter_labels[1]}：把可行性分析、需求分析和总体设计串成一条线，这是最容易混、也最值得重点讲清的部分。"
            )
        if len(chapter_labels) > 2:
            lines.append(
                f"3. 最后复习 {chapter_labels[2]}：把实现、测试、维护和项目管理一起回收，用完整流程检查自己能不能从头讲到尾。"
            )
        lines.append("如果你愿意，我下一条可以直接按这三步给你展开成一份本章复习清单。")
        return "\n".join(lines)

    async def _review_answer_content(
        self,
        *,
        answer_text: str,
        course_id: int | None,
        user_id: int | None,
        reference_sources: list[dict[str, Any]] | None = None,
    ) -> tuple[str, dict[str, Any], dict[str, Any] | None]:
        citations = self._extract_reference_citations(reference_sources)
        review = await self.guardrail_service.review_output(
            answer_text,
            context=self._build_guardrail_context(
                scene="tutoring_answer",
                course_id=course_id,
                user_id=user_id,
                citations=citations,
            ),
            citations=citations,
        )
        safe_answer_text = answer_text
        if review.output_review and review.output_review.blocked:
            safe_answer_text = (
                review.output_review.rewritten_text
                or "当前回答触发了内容安全保护，请换一个学习相关问题继续。"
            )
        return (
            safe_answer_text,
            {
                "output_review": review.output_review.model_dump(mode="json")
                if review.output_review
                else None,
            },
            review.hallucination_review.model_dump(mode="json")
            if review.hallucination_review
            else None,
        )

    async def build_answer_payload(
        self,
        *,
        question: TutoringQuestion,
        answer: TutoringAnswer,
    ) -> dict[str, Any]:
        conf = float(answer.confidence_score or 0)
        safe_answer_text, safety_review, hallucination_review = await self._review_answer_content(
            answer_text=self._repair_mojibake_text(answer.answer_text or ""),
            course_id=getattr(question, "course_id", None),
            user_id=getattr(question, "user_id", None),
            reference_sources=answer.reference_sources,
        )
        return {
            "question_id": getattr(question, "id", getattr(answer, "question_id", 0)),
            "session_id": getattr(question, "session_id", getattr(answer, "session_id", None)),
            "answer_id": answer.id,
            "answer_text": safe_answer_text,
            "diagrams": answer.answer_diagrams or [],
            "videos": answer.answer_videos or [],
            "reference_sources": answer.reference_sources or [],
            "confidence_score": conf,
            "generation_time": answer.generation_time,
            "should_escalate": conf < 60.0,
            "question_type": self._repair_mojibake_text(getattr(question, "question_type", None)),
            "knowledge_points": self._repair_mojibake_payload(getattr(question, "knowledge_points", None) or []),
            "safety_review": safety_review,
            "hallucination_review": hallucination_review,
            "source": "ai",
            "fallback_reason": None,
        }

    async def submit_question(self, user_id: int, request: TutoringQuestionCreate) -> dict[str, Any]:
        text = self._validate_question_text(request.question_text)
        try:
            await self.guardrail_service.assert_safe_input(
                text,
                context=self._build_guardrail_context(
                    scene="tutoring_question",
                    course_id=request.course_id,
                    user_id=user_id,
                ),
            )
        except GuardrailViolationError as exc:
            raise ValueError(
                exc.review.rewritten_text or exc.review.summary or "当前提问触发了内容安全保护，请换一个学习相关问题继续。"
            ) from exc
        storage_text = self._compose_storage_question_text(text, request.persona)
        now = datetime.now()

        session_row: TutoringSession | None = None
        if request.session_id:
            stmt = select(TutoringSession).where(TutoringSession.id == request.session_id)
            res = await self.db.execute(stmt)
            candidate = res.scalar_one_or_none()
            if candidate and candidate.user_id == user_id:
                session_row = candidate

        if session_row is None:
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
            # Ensure the new session row exists before creating a question that references it.
            await self.db.flush()

        qid = self._generate_id()
        question = TutoringQuestion(
            id=qid,
            session_id=session_row.id,
            user_id=user_id,
            course_id=request.course_id,
            section_id=request.section_id,
            question_text=storage_text,
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
        analysis = self._repair_mojibake_payload(result.get("question_analysis") or {})
        repaired_answer_text = self._repair_mojibake_text(result.get("answer_text") or "")
        reviewed_answer_text, safety_review, hallucination_review = await self._review_answer_content(
            answer_text=repaired_answer_text,
            course_id=question.course_id,
            user_id=question.user_id,
            reference_sources=self._repair_mojibake_payload(result.get("reference_sources")),
        )

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
            answer_text=reviewed_answer_text,
            answer_diagrams=self._repair_mojibake_payload(result.get("answer_diagrams")),
            answer_videos=self._repair_mojibake_payload(result.get("answer_videos")),
            reference_sources=self._repair_mojibake_payload(result.get("reference_sources")),
            confidence_score=confidence,
            generation_time=result.get("generation_time_ms"),
            create_time=now,
            update_time=now,
        )
        self.db.add(answer)
        if bool(result.get("should_escalate")):
            existing = await self._get_open_escalation(question.id)
            if existing is None:
                self.db.add(
                    EscalationRecord(
                        id=self._generate_id(),
                        question_id=question.id,
                        session_id=question.session_id,
                        user_id=question.user_id,
                        escalation_reason=1,
                        ai_confidence_score=confidence,
                        escalation_status=0,
                        create_time=now,
                        update_time=now,
                    )
                )
                question.is_escalated = True
                question.question_status = 2
        await self.db.commit()

        return {
            "question_id": question.id,
            "session_id": question.session_id,
            "answer_id": answer_id,
            "answer_text": answer.answer_text,
            "diagrams": answer.answer_diagrams or [],
            "videos": answer.answer_videos or [],
            "reference_sources": answer.reference_sources or [],
            "confidence_score": float(confidence),
            "generation_time": answer.generation_time,
            "should_escalate": bool(result.get("should_escalate")),
            "question_type": self._repair_mojibake_text(question.question_type),
            "knowledge_points": self._repair_mojibake_payload(question.knowledge_points or []),
            "safety_review": safety_review,
            "hallucination_review": hallucination_review,
            "source": "fallback" if self._is_local_fallback_result(result) else "ai",
            "fallback_reason": result.get("fallback_reason"),
        }

    async def _persist_result_without_review(
        self,
        question: TutoringQuestion,
        result: dict[str, Any],
    ) -> dict[str, Any]:
        now = datetime.now()
        analysis = self._repair_mojibake_payload(result.get("question_analysis") or {})
        repaired_answer_text = self._repair_mojibake_text(result.get("answer_text") or "")

        question.question_type = analysis.get("question_type") or question.question_type or "学习问答"
        question.knowledge_points = analysis.get("knowledge_points") or question.knowledge_points or []
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
            answer_text=repaired_answer_text,
            answer_diagrams=self._repair_mojibake_payload(result.get("answer_diagrams")) or [],
            answer_videos=self._repair_mojibake_payload(result.get("answer_videos")) or [],
            reference_sources=self._repair_mojibake_payload(result.get("reference_sources")) or [],
            confidence_score=confidence,
            generation_time=result.get("generation_time_ms"),
            create_time=now,
            update_time=now,
        )
        self.db.add(answer)
        await self.db.commit()

        return {
            "question_id": question.id,
            "session_id": question.session_id,
            "answer_id": answer_id,
            "answer_text": answer.answer_text,
            "diagrams": answer.answer_diagrams or [],
            "videos": answer.answer_videos or [],
            "reference_sources": answer.reference_sources or [],
            "confidence_score": float(confidence),
            "generation_time": answer.generation_time,
            "should_escalate": False,
            "question_type": self._repair_mojibake_text(question.question_type),
            "knowledge_points": self._repair_mojibake_payload(question.knowledge_points or []),
            "safety_review": None,
            "hallucination_review": None,
            "source": "fallback" if self._is_local_fallback_result(result) else "ai",
            "fallback_reason": result.get("fallback_reason"),
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
                return await self.build_answer_payload(question=question, answer=existing)

        coordinator = TutoringCoordinator()
        try:
            user_profile = await asyncio.wait_for(self._load_user_profile(user_id), timeout=1.2)
        except TimeoutError:
            logger.warning("tutoring.profile_load_skipped", user_id=user_id)
            user_profile = None

        try:
            raw_question_text = str(getattr(question, "question_text", "") or "")
            persona, clean_question_text = self._extract_persona_and_clean_text(raw_question_text)
            result = await asyncio.wait_for(
                coordinator.run(
                    question_text=clean_question_text,
                    question_images=getattr(question, "question_images", None),
                    course_id=getattr(question, "course_id", None),
                    user_profile=user_profile,
                    persona=persona,
                    on_event=on_event,
                ),
                timeout=18,
            )
            result = self._repair_mojibake_payload(result)
            if self._contains_placeholder_noise(result.get("answer_text")) or self._contains_placeholder_noise(
                " ".join(str(item) for item in (result.get("question_analysis", {}).get("knowledge_points") or []))
            ):
                raise ValueError("generated placeholder-heavy tutoring answer")
        except Exception as e:
            logger.exception("tutoring.generate_failed", question_id=question_id)
            message = str(e)
            result = self._build_local_fallback_result(
                question_text=raw_question_text,
                course_id=getattr(question, "course_id", None),
                question_images=getattr(question, "question_images", None),
                failure_reason=(
                    "llm_billing_unavailable"
                    if self._looks_like_billing_error_message(message)
                    else message
                ),
            )
            if on_event:
                await on_event(
                    {
                        "chunk_type": "step",
                        "content": "fallback",
                        "metadata": {"label": "切换到本地兜底回答"},
                    }
                )
                await on_event(
                    {
                        "chunk_type": "text_delta",
                        "content": result["answer_text"],
                    }
                )

        if not str(result.get("answer_text") or "").strip():
            result = self._build_local_fallback_result(
                question_text=raw_question_text,
                course_id=getattr(question, "course_id", None),
                question_images=getattr(question, "question_images", None),
                failure_reason="empty tutoring answer",
            )

        try:
            return await self._persist_coordinator_result(question, result)
        except Exception:
            logger.exception("tutoring.persist_failed", question_id=question_id)
            fallback_result = result
            if not self._is_local_fallback_result(result):
                fallback_result = self._build_local_fallback_result(
                    question_text=raw_question_text,
                    course_id=getattr(question, "course_id", None),
                    question_images=getattr(question, "question_images", None),
                    failure_reason="persist_failed",
                )
            return await self._persist_result_without_review(question, fallback_result)

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
            filters.append(or_(TutoringQuestion.question_text.ilike(kw), answer_hits))

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
            persona, cleaned_question_text = self._extract_persona_and_clean_text(q.question_text)
            setattr(q, "question_text", cleaned_question_text)
            setattr(q, "persona", persona)
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
            assert_tutoring_text_allowed(request.user_feedback, field_label="鍙嶉")

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
                "message": "已有处理中人工升级记录，请耐心等待。",
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
            "message": "已提交人工处理，预计 2 小时内响应。",
        }

    async def list_escalations(
        self,
        user_id: int | None = None,
        *,
        course_id: int | None = None,
        escalation_status: int | None = None,
        assigned_expert_id: int | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> dict[str, Any]:
        filters: list[Any] = []
        if user_id is not None:
            question_match = select(TutoringQuestion.id).where(TutoringQuestion.user_id == user_id)
            if course_id is not None:
                question_match = question_match.where(TutoringQuestion.course_id == course_id)
            filters.append(EscalationRecord.question_id.in_(question_match))
        elif course_id is not None:
            course_match = select(TutoringQuestion.id).where(TutoringQuestion.course_id == course_id)
            filters.append(EscalationRecord.question_id.in_(course_match))
        if escalation_status is not None:
            filters.append(EscalationRecord.escalation_status == escalation_status)
        if assigned_expert_id is not None:
            filters.append(EscalationRecord.assigned_expert_id == assigned_expert_id)
        total_stmt = select(func.count()).select_from(EscalationRecord)
        if filters:
            total_stmt = total_stmt.where(and_(*filters))
        total = int((await self.db.execute(total_stmt)).scalar_one())

        stmt = select(EscalationRecord).order_by(EscalationRecord.create_time.desc())
        if filters:
            stmt = stmt.where(and_(*filters))
        stmt = stmt.offset((page - 1) * page_size).limit(page_size)
        result = await self.db.execute(stmt)
        items = list(result.scalars().all())

        return {
            "total": total,
            "page": page,
            "page_size": page_size,
            "items": items,
        }

    async def get_escalation_detail(self, escalation_id: int, *, user_id: int | None = None) -> EscalationRecord:
        stmt = select(EscalationRecord).where(EscalationRecord.id == escalation_id)
        escalation = (await self.db.execute(stmt)).scalar_one_or_none()
        if escalation is None:
            raise ValueError("升级记录不存在")
        if user_id is not None and escalation.user_id != user_id:
            raise ValueError("无权查看该升级记录")
        question = await self._get_question(escalation.question_id)
        latest_answer = await self._get_answer_by_question(escalation.question_id)
        setattr(escalation, "question_text", getattr(question, "question_text", None))
        setattr(escalation, "question_images", getattr(question, "question_images", None))
        setattr(escalation, "question_type", getattr(question, "question_type", None))
        setattr(escalation, "knowledge_points", getattr(question, "knowledge_points", None))
        setattr(escalation, "latest_answer_id", getattr(latest_answer, "id", None))
        setattr(escalation, "latest_answer_text", getattr(latest_answer, "answer_text", None))
        setattr(escalation, "latest_answer_source", getattr(latest_answer, "answer_source", None))
        return escalation

    async def assign_escalation(self, request: ExpertAssignmentRequest) -> dict[str, Any]:
        escalation = await self.get_escalation_detail(request.escalation_id)
        if escalation.escalation_status in [3, 4]:
            raise ValueError("鍗囩骇璁板綍宸茬粨鏉燂紝鏃犳硶閲嶆柊鍒嗛厤")

        now = datetime.now()
        escalation.assigned_expert_id = request.expert_id
        escalation.assign_time = now
        escalation.expert_notes = request.notes
        escalation.escalation_status = 1
        escalation.update_time = now
        await self.db.commit()

        return {
            "status": "success",
            "escalation_id": escalation.id,
            "assigned_expert_id": escalation.assigned_expert_id,
        }

    async def submit_expert_answer(self, request: ExpertAnswerSubmitRequest) -> dict[str, Any]:
        escalation = await self.get_escalation_detail(request.escalation_id)
        if escalation.escalation_status == 4:
            raise ValueError("鍗囩骇璁板綍宸插彇娑堬紝鏃犳硶鎻愪氦浜哄伐瑙ｇ瓟")

        question = await self._get_question(escalation.question_id)
        if question is None:
            raise ValueError("关联问题不存在")

        now = datetime.now()
        answer_id = self._generate_id()
        answer = TutoringAnswer(
            id=answer_id,
            question_id=question.id,
            session_id=question.session_id,
            answer_source=1,
            answerer_id=request.expert_id,
            answer_text=request.answer_text.strip(),
            answer_diagrams=request.answer_diagrams,
            answer_videos=request.answer_videos,
            reference_sources=request.reference_sources,
            confidence_score=Decimal("100.00"),
            generation_time=None,
            create_time=now,
            update_time=now,
        )
        self.db.add(answer)

        question.has_answer = True
        question.question_status = 1
        question.is_escalated = True
        question.update_time = now

        escalation.assigned_expert_id = request.expert_id
        escalation.escalation_status = 3
        escalation.expert_answer_id = answer_id
        escalation.complete_time = now
        escalation.expert_notes = request.expert_notes
        escalation.feedback_to_ai = bool(request.feedback_to_ai)
        escalation.update_time = now
        if escalation.create_time:
            escalation.response_time = max(1, int((now - escalation.create_time).total_seconds() // 60))

        await self.db.commit()
        return {
            "status": "success",
            "answer_id": answer_id,
            "escalation_id": escalation.id,
        }

    async def delete_history_item(self, user_id: int, question_id: int) -> dict[str, Any]:
        question = await self._get_question(question_id)
        if not question or question.user_id != user_id:
            raise ValueError("绛旂枒璁板綍涓嶅瓨鍦ㄦ垨鏃犳潈璁块棶")

        session_row = None
        if question.session_id:
            stmt = select(TutoringSession).where(TutoringSession.id == question.session_id)
            session_row = (await self.db.execute(stmt)).scalar_one_or_none()

        answers_stmt = select(TutoringAnswer).where(TutoringAnswer.question_id == question_id)
        answers = list((await self.db.execute(answers_stmt)).scalars().all())
        for answer in answers:
            await self.db.delete(answer)

        escalations_stmt = select(EscalationRecord).where(EscalationRecord.question_id == question_id)
        escalations = list((await self.db.execute(escalations_stmt)).scalars().all())
        for escalation in escalations:
            await self.db.delete(escalation)

        favorites_stmt = select(TutoringFavorite).where(TutoringFavorite.question_id == question_id)
        favorites = list((await self.db.execute(favorites_stmt)).scalars().all())
        for favorite in favorites:
            await self.db.delete(favorite)

        await self.db.delete(question)

        if session_row:
            session_row.question_count = max(0, int(session_row.question_count or 0) - 1)
            session_row.update_time = datetime.now()
            if session_row.question_count == 0:
                session_row.session_status = 1
                session_row.end_time = datetime.now()

        await self.db.commit()
        return {"status": "success"}
