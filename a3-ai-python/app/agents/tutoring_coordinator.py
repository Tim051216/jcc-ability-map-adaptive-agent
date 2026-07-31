"""
Tutoring coordinator.
Routes simple questions directly and defers resource generation for normal course questions.
"""

from __future__ import annotations

import re
import time
from collections.abc import Awaitable, Callable
from typing import Any

from app.agents.nodes.answer_generator_agent import AnswerGeneratorAgent
from app.agents.nodes.diagram_generator_agent import DiagramGeneratorAgent
from app.agents.nodes.question_analyzer_agent import QuestionAnalyzerAgent
from app.agents.nodes.video_recommender_agent import VideoRecommenderAgent
from app.core.logging import logger
from app.harness.runtime import emit as harness_emit
from app.harness.runtime import run_scope
from app.services.agent_runtime_logging_service import AgentRuntimeLoggingService

EmitFn = Callable[[dict[str, Any]], Awaitable[None]] | None


class TutoringCoordinator:
    """Coordinate tutoring flow and stream progress to websocket clients."""

    def __init__(self) -> None:
        self._analyzer = QuestionAnalyzerAgent()
        self._answer_gen = AnswerGeneratorAgent()
        self._diagram_gen = DiagramGeneratorAgent()
        self._video_rec = VideoRecommenderAgent()
        self._runtime_logger = AgentRuntimeLoggingService()

    async def _emit(self, on_event: EmitFn, payload: dict[str, Any]) -> None:
        harness_emit("stream_event", payload=payload)
        if on_event:
            await on_event(payload)

    async def _emit_answer_text_delta(self, on_event: EmitFn, chunk: str) -> None:
        await self._emit(
            on_event,
            {
                "chunk_type": "text_delta",
                "content": chunk,
            },
        )

    async def _emit_resource_update(
        self,
        on_event: EmitFn,
        *,
        diagrams: list[Any],
        videos: list[Any],
        reference_sources: list[dict[str, Any]],
        confidence: float,
        should_escalate: bool,
    ) -> None:
        await self._emit(
            on_event,
            {
                "chunk_type": "resource_update",
                "content": {
                    "diagrams": diagrams,
                    "videos": videos,
                    "reference_sources": reference_sources,
                    "confidence_score": confidence,
                    "should_escalate": should_escalate,
                },
            },
        )

    @staticmethod
    def _looks_like_light_conversation(question_text: str, question_images: list[str] | None) -> bool:
        if question_images:
            return False
        text = (question_text or "").strip()
        normalized = re.sub(r"\s+", "", text.lower())
        if not normalized:
            return False
        if normalized in {"你好", "您好", "hello", "hi", "嗨", "哈喽", "在吗", "在嘛", "老师好"}:
            return True
        if len(normalized) <= 16 and any(
            token in text
            for token in ("你是谁", "你叫什么", "你是灰原哀吗", "你是乌萨奇吗", "你有姐姐吗", "几点", "几号", "日期", "星期", "时间")
        ):
            return True
        if len(normalized) <= 24 and any(
            token in text for token in ("姐姐", "朋友", "喜欢", "会不会", "为什么", "聊聊", "陪我", "在吗")
        ):
            return True
        return False

    @staticmethod
    def _looks_like_realtime_query(question_text: str, question_images: list[str] | None) -> bool:
        if question_images:
            return False
        text = (question_text or "").strip()
        if not text:
            return False
        learning_context_tokens = (
            "学习",
            "复习",
            "课程",
            "章节",
            "这章",
            "本章",
            "顺序",
            "步骤",
            "重点",
            "怎么学",
            "如何学",
            "继续学",
            "安排",
        )
        if any(token in text for token in learning_context_tokens):
            return False
        realtime_tokens = (
            "天气",
            "气温",
            "温度",
            "下雨",
            "降雨",
            "降水",
            "空气质量",
            "最新",
            "实时",
            "今天",
            "今日",
        )
        if any(token in text for token in realtime_tokens):
            return True
        return bool(
            re.search(r"(现在|此刻|当前).{0,8}(几点|几号|日期|星期|时间)", text)
            or re.search(r"(几点|几号|日期|星期|时间).{0,8}(现在|此刻|当前)", text)
        )

    @staticmethod
    def _build_fast_light_analysis(question_text: str) -> dict[str, Any]:
        text = (question_text or "").strip()
        normalized = re.sub(r"\s+", "", text.lower())
        question_type = "通用问答"
        knowledge_points = ["通用交流"]
        intent = "轻问答"
        core_concept = text[:16] or "通用交流"
        specific_confusion = "用户在进行轻量问答或陪伴式交流。"

        if normalized in {"你好", "您好", "hello", "hi", "嗨", "哈喽", "在吗", "在嘛", "老师好"}:
            question_type = "日常交流"
            knowledge_points = ["基础问候"]
            intent = "日常交流"
            core_concept = "基础问候"
            specific_confusion = "用户在打招呼或确认导师是否在线。"
        elif any(token in text for token in ("你是谁", "你叫什么", "你是灰原哀吗", "你是乌萨奇吗")):
            question_type = "身份问答"
            knowledge_points = ["导师身份"]
            intent = "身份问答"
            core_concept = "导师身份"
            specific_confusion = "用户想确认导师身份或角色设定。"
        elif any(token in text for token in ("几点", "几号", "日期", "星期", "时间")):
            question_type = "通用问答"
            knowledge_points = ["通用事务"]
            intent = "通用问答"
            core_concept = "通用事务"
            specific_confusion = "用户在询问时间日期等通用信息。"
        elif any(token in text for token in ("姐姐", "朋友", "喜欢", "会不会", "为什么", "聊聊", "陪我", "在吗")):
            question_type = "闲聊陪伴"
            knowledge_points = ["自然闲聊"]
            intent = "闲聊陪伴"
            core_concept = "自然闲聊"
            specific_confusion = "用户在进行人设关系问答或轻社交陪伴交流。"

        return {
            "intent": intent,
            "core_concept": core_concept,
            "specific_confusion": specific_confusion,
            "has_code": False,
            "has_formula": False,
            "language": "zh",
            "image_count": 0,
            "question_type": question_type,
            "knowledge_points": knowledge_points,
            "difficulty_level": 1,
            "subject_area": "通用交流",
            "requires_calculation": False,
            "requires_reasoning": False,
            "expanded_context": "",
            "related_concepts": [],
            "similar_questions": [],
            "image_context": {
                "image_count": 0,
                "combined_text": "",
                "ocr_texts": [],
                "visual_hints": [],
            },
        }

    @staticmethod
    def _should_short_circuit(analysis: dict[str, Any], question_images: list[str] | None) -> bool:
        if question_images:
            return False
        question_type = str(analysis.get("question_type") or "")
        return question_type in AnswerGeneratorAgent.LIGHT_TYPES

    @staticmethod
    def _should_defer_resources(
        question_text: str,
        analysis: dict[str, Any],
        question_images: list[str] | None,
    ) -> bool:
        if question_images:
            return False
        question_type = str(analysis.get("question_type") or "")
        if question_type in AnswerGeneratorAgent.LIGHT_TYPES:
            return False
        return not AnswerGeneratorAgent._wants_video_recommendation(question_text)

    async def run(
        self,
        *,
        question_text: str,
        question_images: list[str] | None,
        course_id: int | None,
        user_profile: dict[str, Any] | None = None,
        persona: str | None = None,
        conversation_context: str | None = None,
        on_event: EmitFn = None,
        harness_run_id: str | None = None,
        harness_parent_run_id: str | None = None,
        harness_metadata: dict[str, Any] | None = None,
        harness_trace_dir: str | None = None,
    ) -> dict[str, Any]:
        input_data = {
            "question_text": question_text,
            "question_images": question_images or [],
            "course_id": course_id,
            "user_profile": user_profile,
            "persona": persona,
            "conversation_context": conversation_context,
        }
        async with run_scope(
            kind="tutoring",
            input_data=input_data,
            run_id=harness_run_id,
            parent_run_id=harness_parent_run_id,
            metadata=harness_metadata,
            trace_dir=harness_trace_dir,
        ) as recorder:
            result = await self._run_impl(
                question_text=question_text,
                question_images=question_images,
                course_id=course_id,
                user_profile=user_profile,
                persona=persona,
                conversation_context=conversation_context,
                on_event=on_event,
            )
            result["harness_run_id"] = recorder.run_id
            harness_emit("agent_output", output=result)
            return result

    async def _run_impl(
        self,
        *,
        question_text: str,
        question_images: list[str] | None,
        course_id: int | None,
        user_profile: dict[str, Any] | None = None,
        persona: str | None = None,
        conversation_context: str | None = None,
        on_event: EmitFn = None,
    ) -> dict[str, Any]:
        t0 = time.perf_counter()
        payload = {
            "course_id": course_id,
            "has_images": bool(question_images),
            "question_length": len(question_text or ""),
            "has_user_profile": bool(user_profile),
            "persona": persona or "haibara",
        }
        preclassified_light = self._looks_like_light_conversation(question_text, question_images)
        preclassified_realtime = self._looks_like_realtime_query(question_text, question_images)

        async with self._runtime_logger.track(
            agent_name="tutoring_coordinator",
            start_message="tutoring_coordinator started",
            success_message="tutoring_coordinator completed",
            start_payload=payload,
            success_payload_factory=lambda: {
                **payload,
                "duration_ms": int((time.perf_counter() - t0) * 1000),
            },
            error_message="tutoring_coordinator failed",
        ):
            if preclassified_light or preclassified_realtime:
                analysis = self._build_fast_light_analysis(question_text)
            else:
                await self._emit(
                    on_event,
                    {
                        "chunk_type": "step",
                        "content": "analyzing",
                        "metadata": {"label": "问题分析"},
                    },
                )

                async with self._runtime_logger.track(
                    agent_name="question_analyzer_agent",
                    start_message="question_analyzer_agent started",
                    success_message="question_analyzer_agent completed",
                    start_payload=payload,
                    error_message="question_analyzer_agent failed",
                ):
                    analysis = await self._analyzer.analyze_question(
                        question_text,
                        question_images=question_images,
                        course_id=course_id,
                    )

            if analysis.get("needs_clarification"):
                clarification = analysis.get("clarification_question") or "这个问题还需要再明确一下：你想问课程知识、查实时资料，还是让我调用工具处理？"
                confidence = float(analysis.get("intent_confidence") or 0)
                merged: dict[str, Any] = {
                    "answer_text": clarification,
                    "reference_sources": [],
                    "answer_diagrams": [],
                    "answer_videos": [],
                    "confidence_score": confidence,
                    "question_analysis": analysis,
                    "should_escalate": False,
                    "generation_time_ms": int((time.perf_counter() - t0) * 1000),
                }
                await self._emit(
                    on_event,
                    {
                        "chunk_type": "complete",
                        "content": {
                            "answer_text": clarification,
                            "diagrams": [],
                            "videos": [],
                            "reference_sources": [],
                            "confidence_score": confidence,
                            "should_escalate": False,
                        },
                    },
                )
                logger.info(
                    "tutoring.coordinator.clarification",
                    intent=analysis.get("intent"),
                    intent_confidence=confidence,
                )
                return merged

            should_short_circuit = (
                preclassified_light
                or preclassified_realtime
                or self._should_short_circuit(analysis, question_images)
                or self._looks_like_light_conversation(question_text, question_images)
            )

            if should_short_circuit:
                await self._emit(
                    on_event,
                    {
                        "chunk_type": "step",
                        "content": "answer_only",
                        "metadata": {"label": "直接回答"},
                    },
                )

                async with self._runtime_logger.track(
                    agent_name="answer_generator_agent",
                    start_message="answer_generator_agent started",
                    success_message="answer_generator_agent completed",
                    start_payload={**payload, "routing": "short_circuit"},
                    error_message="answer_generator_agent failed",
                ):
                    answer_result = await self._answer_gen.generate_answer(
                        question_text,
                        analysis,
                        question_images=question_images,
                        user_profile=user_profile,
                        course_id=course_id,
                        persona=persona,
                        conversation_context=conversation_context,
                        on_answer_chunk=lambda chunk: self._emit_answer_text_delta(on_event, chunk),
                    )

                confidence = float(answer_result.get("confidence_score") or 0)
                should_escalate = confidence < 60.0
                videos: list[Any] = []
                if AnswerGeneratorAgent._wants_video_recommendation(question_text):
                    async with self._runtime_logger.track(
                        agent_name="video_recommender_agent",
                        start_message="video_recommender_agent started",
                        success_message="video_recommender_agent completed",
                        start_payload={**payload, "routing": "short_circuit"},
                        error_message="video_recommender_agent failed",
                    ):
                        video_result = await self._video_rec.recommend_videos(
                            question_text,
                            analysis,
                            user_profile=user_profile,
                            course_id=course_id,
                        )
                        videos = (video_result.get("videos") or []) if video_result else []
                merged: dict[str, Any] = {
                    "answer_text": answer_result.get("answer_text", ""),
                    "reference_sources": answer_result.get("reference_sources") or [],
                    "answer_diagrams": [],
                    "answer_videos": videos,
                    "confidence_score": confidence,
                    "question_analysis": analysis,
                    "should_escalate": should_escalate,
                    "generation_time_ms": int((time.perf_counter() - t0) * 1000),
                }

                await self._emit(
                    on_event,
                    {
                        "chunk_type": "complete",
                        "content": {
                            "answer_text": merged["answer_text"],
                            "diagrams": [],
                            "videos": videos,
                            "reference_sources": merged["reference_sources"],
                            "confidence_score": confidence,
                            "should_escalate": should_escalate,
                        },
                    },
                )

                logger.info(
                    "tutoring.coordinator.short_circuit_done",
                    question_type=analysis.get("question_type"),
                    confidence=confidence,
                )
                return merged

            await self._emit(
                on_event,
                {
                    "chunk_type": "step",
                    "content": "generating",
                    "metadata": {"label": "生成首答"},
                },
            )

            async def run_answer() -> dict[str, Any]:
                async with self._runtime_logger.track(
                    agent_name="answer_generator_agent",
                    start_message="answer_generator_agent started",
                    success_message="answer_generator_agent completed",
                    start_payload=payload,
                    error_message="answer_generator_agent failed",
                ):
                    return await self._answer_gen.generate_answer(
                        question_text,
                        analysis,
                        question_images=question_images,
                        user_profile=user_profile,
                        course_id=course_id,
                        persona=persona,
                        conversation_context=conversation_context,
                        on_answer_chunk=lambda chunk: self._emit_answer_text_delta(on_event, chunk),
                    )

            async def run_video() -> dict[str, Any]:
                async with self._runtime_logger.track(
                    agent_name="video_recommender_agent",
                    start_message="video_recommender_agent started",
                    success_message="video_recommender_agent completed",
                    start_payload=payload,
                    error_message="video_recommender_agent failed",
                ):
                    return await self._video_rec.recommend_videos(
                        question_text,
                        analysis,
                        user_profile=user_profile,
                        course_id=course_id,
                    )

            async def run_diagram(answer_text: str) -> dict[str, Any]:
                async with self._runtime_logger.track(
                    agent_name="diagram_generator_agent",
                    start_message="diagram_generator_agent started",
                    success_message="diagram_generator_agent completed",
                    start_payload=payload,
                    error_message="diagram_generator_agent failed",
                ):
                    return await self._diagram_gen.generate_diagram(
                        question_text,
                        analysis,
                        answer_text,
                    )

            answer_result = await run_answer()
            confidence = float(answer_result.get("confidence_score") or 0)
            should_escalate = confidence < 60.0
            reference_sources = answer_result.get("reference_sources") or []
            answer_text = answer_result.get("answer_text", "")

            await self._emit(
                on_event,
                {
                    "chunk_type": "complete",
                    "content": {
                        "answer_text": answer_text,
                        "diagrams": [],
                        "videos": [],
                        "reference_sources": reference_sources,
                        "confidence_score": confidence,
                        "should_escalate": should_escalate,
                    },
                },
            )

            diagrams: list[Any] = []
            videos: list[Any] = []

            if self._should_defer_resources(question_text, analysis, question_images):
                await self._emit(
                    on_event,
                    {
                        "chunk_type": "step",
                        "content": "resource_backfill",
                        "metadata": {"label": "补充视频和图解"},
                    },
                )
                video_result = await run_video()

                await self._emit(
                    on_event,
                    {
                        "chunk_type": "step",
                        "content": "diagram",
                        "metadata": {"label": "补充图解"},
                    },
                )
                diagram_result = await run_diagram(answer_text)

                diagrams = diagram_result.get("diagrams") or []
                videos = (video_result.get("videos") or []) if video_result else []
                await self._emit_resource_update(
                    on_event,
                    diagrams=diagrams,
                    videos=videos,
                    reference_sources=reference_sources,
                    confidence=confidence,
                    should_escalate=should_escalate,
                )
            else:
                video_result = await run_video()
                await self._emit(
                    on_event,
                    {
                        "chunk_type": "step",
                        "content": "diagram",
                        "metadata": {"label": "生成图解"},
                    },
                )
                diagram_result = await run_diagram(answer_text)
                diagrams = diagram_result.get("diagrams") or []
                videos = (video_result.get("videos") or []) if video_result else []

            merged = {
                "answer_text": answer_text,
                "reference_sources": reference_sources,
                "answer_diagrams": diagrams,
                "answer_videos": videos,
                "confidence_score": confidence,
                "question_analysis": analysis,
                "should_escalate": should_escalate,
                "generation_time_ms": int((time.perf_counter() - t0) * 1000),
            }

            logger.info(
                "tutoring.coordinator.done",
                confidence=confidence,
                diagram_count=len(diagrams),
                video_count=len(videos),
            )
            return merged
