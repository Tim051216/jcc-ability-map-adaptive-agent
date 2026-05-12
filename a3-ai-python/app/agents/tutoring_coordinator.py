"""
智能辅导多智能体协调：问题分析 → 解答与视频（并行）→ 图解 → 聚合。
"""
from __future__ import annotations

import asyncio
import time
from collections.abc import Awaitable, Callable
from typing import Any

from app.agents.nodes.answer_generator_agent import AnswerGeneratorAgent
from app.agents.nodes.diagram_generator_agent import DiagramGeneratorAgent
from app.agents.nodes.question_analyzer_agent import QuestionAnalyzerAgent
from app.agents.nodes.video_recommender_agent import VideoRecommenderAgent
from app.core.logging import logger

EmitFn = Callable[[dict[str, Any]], Awaitable[None]] | None


class TutoringCoordinator:
    """编排辅导链路，可选事件回调用于 WebSocket 进度推送。"""

    def __init__(self) -> None:
        self._analyzer = QuestionAnalyzerAgent()
        self._answer_gen = AnswerGeneratorAgent()
        self._diagram_gen = DiagramGeneratorAgent()
        self._video_rec = VideoRecommenderAgent()

    async def _emit(self, on_event: EmitFn, payload: dict[str, Any]) -> None:
        if on_event:
            await on_event(payload)

    async def run(
        self,
        *,
        question_text: str,
        question_images: list[str] | None,
        course_id: int | None,
        user_profile: dict[str, Any] | None = None,
        on_event: EmitFn = None,
    ) -> dict[str, Any]:
        t0 = time.perf_counter()
        await self._emit(
            on_event,
            {
                "chunk_type": "step",
                "content": "analyzing",
                "metadata": {"label": "问题分析"},
            },
        )

        analysis = await self._analyzer.analyze_question(
            question_text,
            question_images=question_images,
            course_id=course_id,
        )

        await self._emit(
            on_event,
            {
                "chunk_type": "step",
                "content": "generating",
                "metadata": {"label": "生成解答与视频推荐"},
            },
        )

        answer_task = self._answer_gen.generate_answer(
            question_text,
            analysis,
            user_profile=user_profile,
            course_id=course_id,
        )
        video_task = self._video_rec.recommend_videos(
            question_text,
            analysis,
            user_profile=user_profile,
            course_id=course_id,
        )
        answer_result, video_result = await asyncio.gather(answer_task, video_task)

        await self._emit(
            on_event,
            {
                "chunk_type": "step",
                "content": "diagram",
                "metadata": {"label": "生成图解"},
            },
        )

        diagram_result = await self._diagram_gen.generate_diagram(
            question_text,
            analysis,
            answer_result.get("answer_text", ""),
        )

        diagrams = diagram_result.get("diagrams") or []
        videos = (video_result.get("videos") or []) if video_result else []
        confidence = float(answer_result.get("confidence_score") or 0)
        should_escalate = confidence < 60.0

        merged: dict[str, Any] = {
            "answer_text": answer_result.get("answer_text", ""),
            "reference_sources": answer_result.get("reference_sources") or [],
            "answer_diagrams": diagrams,
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
                    "diagrams": diagrams,
                    "videos": videos,
                    "reference_sources": merged["reference_sources"],
                    "confidence_score": confidence,
                    "should_escalate": should_escalate,
                },
            },
        )

        logger.info(
            "tutoring.coordinator.done",
            confidence=confidence,
            diagram_count=len(diagrams),
            video_count=len(videos),
        )
        return merged
