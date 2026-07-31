"""Persistent sliding-window memory for tutoring conversations."""

from __future__ import annotations

import asyncio
import re
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.logging import logger
from app.db.models.tutoring import (
    TutoringAnswer,
    TutoringQuestion,
    TutoringSessionMemory,
)
from app.integrations.llm.client import get_llm_client


@dataclass(frozen=True)
class ConversationTurn:
    question_id: int
    question: str
    answer: str

    def render(self) -> str:
        return f"用户：{self.question.strip()}\n导师：{self.answer.strip()}"


_session_locks: dict[int, asyncio.Lock] = {}


class TutoringShortTermMemoryService:
    """Build bounded context and persist summaries of aged-out turns."""

    def __init__(self, db: AsyncSession, llm_client: Any | None = None) -> None:
        self.db = db
        self.llm_client = llm_client or get_llm_client()

    @staticmethod
    def estimate_tokens(text: str) -> int:
        """Conservative tokenizer-independent estimate for Chinese and Latin text."""

        if not text:
            return 0
        chinese = len(re.findall(r"[\u3400-\u9fff]", text))
        remainder = re.sub(r"[\u3400-\u9fff]", "", text)
        latin_words = len(re.findall(r"[A-Za-z0-9_]+", remainder))
        punctuation = len(re.findall(r"[^\sA-Za-z0-9_]", remainder))
        return max(1, chinese + latin_words * 2 + punctuation)

    @classmethod
    def _truncate_to_tokens(cls, text: str, max_tokens: int) -> str:
        if max_tokens <= 0:
            return ""
        if cls.estimate_tokens(text) <= max_tokens:
            return text
        low, high = 0, len(text)
        while low < high:
            mid = (low + high + 1) // 2
            if cls.estimate_tokens(text[:mid]) <= max_tokens:
                low = mid
            else:
                high = mid - 1
        return text[:low].rstrip() + "…"

    async def _load_turns(self, session_id: int, user_id: int) -> list[ConversationTurn]:
        stmt = (
            select(TutoringQuestion.id, TutoringQuestion.question_text, TutoringAnswer.answer_text)
            .join(TutoringAnswer, TutoringAnswer.question_id == TutoringQuestion.id)
            .where(
                TutoringQuestion.session_id == session_id,
                TutoringQuestion.user_id == user_id,
                TutoringQuestion.has_answer.is_(True),
            )
            .order_by(TutoringQuestion.create_time.asc(), TutoringQuestion.id.asc())
        )
        rows = (await self.db.execute(stmt)).all()
        return [
            ConversationTurn(int(row[0]), str(row[1] or ""), str(row[2] or ""))
            for row in rows
        ]

    async def _load_memory(self, session_id: int, user_id: int) -> TutoringSessionMemory | None:
        stmt = (
            select(TutoringSessionMemory)
            .where(
                TutoringSessionMemory.session_id == session_id,
                TutoringSessionMemory.user_id == user_id,
            )
            .with_for_update()
        )
        return (await self.db.execute(stmt)).scalar_one_or_none()

    @staticmethod
    def _turns_after_marker(
        turns: list[ConversationTurn], marker: int | None
    ) -> list[ConversationTurn]:
        if marker is None:
            return turns
        for index, turn in enumerate(turns):
            if turn.question_id == marker:
                return turns[index + 1 :]
        return [turn for turn in turns if turn.question_id > marker]

    async def _summarize(self, previous_summary: str, turns: list[ConversationTurn]) -> str:
        rendered = "\n\n".join(turn.render() for turn in turns)
        prompt = (
            "请把下面的导师会话压缩成可供后续回答使用的短期记忆。\n"
            "只保留用户目标、已确认事实、偏好、关键结论、未解决问题和必要指代；"
            "不要添加原文没有的信息，不要写寒暄，不要回答新问题。\n"
            f"摘要不超过 {settings.tutoring_memory_summary_max_tokens} Token。\n\n"
            f"已有摘要：\n{previous_summary or '无'}\n\n"
            f"本次待合并对话：\n{rendered}"
        )
        try:
            response = await asyncio.wait_for(
                self.llm_client.chat_completion(
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.1,
                    max_tokens=settings.tutoring_memory_summary_max_tokens,
                    model=settings.llm_fast_model,
                ),
                timeout=min(float(settings.llm_timeout_seconds), 8.0),
            )
            summary = str(response.choices[0].message.content or "").strip()
            if summary:
                return self._truncate_to_tokens(
                    summary,
                    settings.tutoring_memory_summary_max_tokens,
                )
        except Exception as exc:
            logger.warning(
                "tutoring.memory_summary_failed",
                error=repr(exc),
                turn_count=len(turns),
            )

        fallback_parts = [previous_summary.strip()] if previous_summary.strip() else []
        fallback_parts.extend(turn.render() for turn in turns)
        return self._truncate_to_tokens(
            "\n".join(fallback_parts),
            settings.tutoring_memory_summary_max_tokens,
        )

    async def _persist_summary(
        self,
        *,
        memory: TutoringSessionMemory | None,
        session_id: int,
        user_id: int,
        summary: str,
        marker: int,
    ) -> TutoringSessionMemory:
        now = datetime.now()
        if memory is None:
            memory = TutoringSessionMemory(
                session_id=session_id,
                user_id=user_id,
                summary_text=summary,
                summarized_through_question_id=marker,
                summary_token_count=self.estimate_tokens(summary),
                version=1,
                create_time=now,
                update_time=now,
            )
            self.db.add(memory)
        else:
            memory.summary_text = summary
            memory.summarized_through_question_id = marker
            memory.summary_token_count = self.estimate_tokens(summary)
            memory.version = int(memory.version or 0) + 1
            memory.update_time = now
        await self.db.commit()
        return memory

    def _render_context(self, summary: str, turns: list[ConversationTurn]) -> str:
        parts: list[str] = []
        if summary.strip():
            parts.append(f"历史摘要：\n{summary.strip()}")
        if turns:
            parts.append("最近完整对话：\n" + "\n\n".join(turn.render() for turn in turns))
        context = "\n\n".join(parts)
        max_tokens = settings.tutoring_memory_max_tokens
        if self.estimate_tokens(context) <= max_tokens:
            return context

        bounded_parts: list[str] = []
        summary_budget = min(
            settings.tutoring_memory_summary_max_tokens,
            max_tokens // 4,
        )
        if summary.strip() and summary_budget > 0:
            bounded_parts.append(
                "历史摘要：\n" + self._truncate_to_tokens(summary.strip(), summary_budget)
            )

        if turns:
            labels_budget = 12 + len(turns) * 8
            available = max(1, max_tokens - summary_budget - labels_budget)
            per_turn_budget = max(1, available // len(turns))
            rendered_turns = [
                self._truncate_to_tokens(turn.render(), per_turn_budget) for turn in turns
            ]
            bounded_parts.append("最近完整对话：\n" + "\n\n".join(rendered_turns))
        return self._truncate_to_tokens("\n\n".join(bounded_parts), max_tokens)

    async def build_context(self, *, session_id: int, user_id: int) -> str:
        lock = _session_locks.setdefault(session_id, asyncio.Lock())
        async with lock:
            turns = await self._load_turns(session_id, user_id)
            memory = await self._load_memory(session_id, user_id)
            summary = str(memory.summary_text or "") if memory else ""
            marker = memory.summarized_through_question_id if memory else None
            unsummarized = self._turns_after_marker(turns, marker)

            raw_context = self._render_context(summary, unsummarized)
            trigger = max(
                1,
                int(
                    settings.tutoring_memory_max_tokens
                    * settings.tutoring_memory_trigger_ratio
                ),
            )
            recent_count = max(2, int(settings.tutoring_memory_recent_turns))
            if self.estimate_tokens(raw_context) < trigger or len(unsummarized) <= recent_count:
                return raw_context

            aged_turns = unsummarized[:-recent_count]
            recent_turns = unsummarized[-recent_count:]
            merged_summary = await self._summarize(summary, aged_turns)
            memory = await self._persist_summary(
                memory=memory,
                session_id=session_id,
                user_id=user_id,
                summary=merged_summary,
                marker=aged_turns[-1].question_id,
            )
            logger.info(
                "tutoring.memory_compacted",
                session_id=session_id,
                summarized_turns=len(aged_turns),
                recent_turns=len(recent_turns),
                version=memory.version,
            )
            return self._render_context(merged_summary, recent_turns)
