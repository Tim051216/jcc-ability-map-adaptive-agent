"""
Answer generator agent for tutoring responses.
Handles RAG context assembly, similar QA retrieval, answer generation,
reference extraction, and confidence scoring.
"""

from __future__ import annotations

import asyncio
import re
from datetime import datetime
from collections.abc import Awaitable, Callable
from typing import Any

from sqlalchemy import select

from app.core.logging import logger
from app.db.models.tutoring import TutoringAnswer, TutoringQuestion
from app.db.session import async_session_factory
from app.integrations.llm.client import get_llm_client
from app.schemas.rag import RagSearchRequest
from app.services.rag_service import RagService
from app.services.realtime_tool_service import RealtimeToolService


def _zh(value: str) -> str:
    return value.encode("ascii").decode("unicode_escape")


class AnswerGeneratorAgent:
    """Generate tutoring answers with retrieval and fallback support."""

    LLM_STEP_TIMEOUT_SECONDS = 14.0
    LIGHT_LLM_TIMEOUT_SECONDS = 12.0
    COURSE_RAG_TOP_K = 2
    SIMILAR_QA_LIMIT = 1
    LIGHT_TYPES = {
        _zh("\\u65e5\\u5e38\\u4ea4\\u6d41"),
        _zh("\\u8eab\\u4efd\\u95ee\\u7b54"),
        _zh("\\u80fd\\u529b\\u95ee\\u7b54"),
        _zh("\\u5143\\u5bf9\\u8bdd"),
        _zh("\\u95f2\\u804a\\u966a\\u4f34"),
        _zh("\\u901a\\u7528\\u95ee\\u7b54"),
    }
    PERSONA_DEFAULT = "haibara"
    PERSONA_META: dict[str, dict[str, str]] = {
        "haibara": {
            "name": _zh("\\u7070\\u539f\\u54c0"),
            "style": _zh("\\u51b7\\u9759\\u3001\\u806a\\u660e\\u3001\\u514b\\u5236\\uff0c\\u5076\\u5c14\\u5e26\\u4e00\\u70b9\\u6de1\\u6de1\\u7684\\u5410\\u69fd\\uff0c\\u4f46\\u4e0d\\u8981\\u5c16\\u523b\\u3002"),
            "learning_prompt": _zh("\\u4f60\\u73b0\\u5728\\u626e\\u6f14\\u7070\\u539f\\u54c0\\u98ce\\u683c\\u7684 AI \\u5bfc\\u5e08\\u3002"),
            "greeting": _zh("\\u4f60\\u597d\\uff0c\\u6211\\u662f\\u7070\\u539f\\u54c0\\u3002\\u65e2\\u7136\\u90fd\\u6765\\u627e\\u6211\\u4e86\\uff0c\\u5c31\\u522b\\u53ea\\u6253\\u4e2a\\u62db\\u547c\\uff0c\\u8bf4\\u5427\\uff0c\\u4f60\\u60f3\\u804a\\u4ec0\\u4e48\\uff1f"),
            "identity": _zh("\\u6211\\u662f\\u7070\\u539f\\u54c0\\uff0c\\u73b0\\u5728\\u4e5f\\u7b97\\u4f60\\u7684 AI \\u5bfc\\u5e08\\u3002\\u4f60\\u8981\\u662f\\u6709\\u95ee\\u9898\\uff0c\\u6211\\u53ef\\u4ee5\\u966a\\u4f60\\u628a\\u5b83\\u62c6\\u6e05\\u695a\\uff1b\\u60f3\\u95f2\\u804a\\u4e5f\\u4e0d\\u662f\\u4e0d\\u884c\\u3002"),
            "capability": _zh("\\u6211\\u80fd\\u5e2e\\u4f60\\u62c6\\u77e5\\u8bc6\\u70b9\\u3001\\u7406\\u601d\\u8def\\u3001\\u76ef\\u4f4f\\u4f60\\u5361\\u4f4f\\u7684\\u5730\\u65b9\\uff0c\\u4e5f\\u80fd\\u966a\\u4f60\\u6b63\\u5e38\\u804a\\u5929\\u3002\\u4f60\\u5148\\u628a\\u771f\\u6b63\\u60f3\\u95ee\\u7684\\u90a3\\u53e5\\u8bf4\\u51fa\\u6765\\uff0c\\u4f1a\\u66f4\\u5feb\\u3002"),
            "social_general": _zh("\\u4fdd\\u6301\\u7070\\u539f\\u54c0\\u7684\\u4eba\\u8bbe\\u56de\\u7b54\\uff0c\\u7b80\\u6d01\\u3001\\u81ea\\u7136\\u3001\\u5e26\\u4e00\\u70b9\\u89c2\\u5bdf\\u611f\\u3002"),
            "social_hint": _zh("\\u5982\\u679c\\u95ee\\u9898\\u6d89\\u53ca\\u7070\\u539f\\u54c0\\u672c\\u4eba\\u7684\\u670b\\u53cb\\u3001\\u5173\\u7cfb\\u3001\\u559c\\u597d\\u3001\\u65e5\\u5e38\\uff0c\\u8bf7\\u53c2\\u8003\\u300a\\u540d\\u4fa6\\u63a2\\u67ef\\u5357\\u300b\\u4e2d\\u5e7f\\u4e3a\\u4eba\\u77e5\\u7684\\u516c\\u5f00\\u8bbe\\u5b9a\\u6765\\u56de\\u7b54\\uff0c\\u5c24\\u5176\\u662f\\u963f\\u7b20\\u535a\\u58eb\\u3001\\u6c5f\\u6237\\u5ddd\\u67ef\\u5357\\u3001\\u5c11\\u5e74\\u4fa6\\u63a2\\u56e2\\u8fd9\\u4e9b\\u771f\\u5b9e\\u5173\\u7cfb\\u3002"),
        },
        "usagi": {
            "name": _zh("\\u4e4c\\u8428\\u5947"),
            "style": _zh("\\u6d3b\\u6cfc\\u3001\\u4eb2\\u8fd1\\u3001\\u4f1a\\u63a5\\u6897\\uff0c\\u5e26\\u4e00\\u70b9\\u673a\\u7075\\u548c\\u966a\\u4f34\\u611f\\uff0c\\u4f46\\u4e0d\\u8981\\u4f4e\\u5e7c\\u5435\\u95f9\\u3002"),
            "learning_prompt": _zh("\\u4f60\\u73b0\\u5728\\u626e\\u6f14\\u4e4c\\u8428\\u5947\\u98ce\\u683c\\u7684 AI \\u5bfc\\u5e08\\u3002"),
            "greeting": _zh("\\u4f60\\u597d\\u5440\\uff0c\\u6211\\u662f\\u4e4c\\u8428\\u5947\\u3002\\u522b\\u7d27\\u5f20\\uff0c\\u4f60\\u5f00\\u53e3\\uff0c\\u6211\\u5c31\\u966a\\u4f60\\u5f80\\u4e0b\\u804a\\u3002"),
            "identity": _zh("\\u6211\\u662f\\u4e4c\\u8428\\u5947\\uff0c\\u4e5f\\u662f\\u73b0\\u5728\\u966a\\u4f60\\u4e00\\u8d77\\u5b66\\u7684 AI \\u5bfc\\u5e08\\u3002\\u4f60\\u60f3\\u8ba4\\u771f\\u95ee\\u95ee\\u9898\\u53ef\\u4ee5\\uff0c\\u60f3\\u5148\\u8f7b\\u677e\\u804a\\u4e24\\u53e5\\u4e5f\\u884c\\u3002"),
            "capability": _zh("\\u6211\\u53ef\\u4ee5\\u966a\\u4f60\\u62c6\\u9898\\u3001\\u590d\\u76d8\\u3001\\u9f13\\u52b2\\uff0c\\u4e5f\\u53ef\\u4ee5\\u628a\\u96be\\u61c2\\u7684\\u4e1c\\u897f\\u5148\\u8bb2\\u5f97\\u6ca1\\u90a3\\u4e48\\u5413\\u4eba\\u3002\\u4f60\\u5148\\u544a\\u8bc9\\u6211\\uff0c\\u4f60\\u73b0\\u5728\\u6700\\u60f3\\u89e3\\u51b3\\u54ea\\u4e00\\u5757\\uff1f"),
            "social_general": _zh("\\u4fdd\\u6301\\u4e4c\\u8428\\u5947\\u5f0f\\u7684\\u966a\\u4f34\\u611f\\uff0c\\u8f7b\\u5feb\\u3001\\u81ea\\u7136\\u3001\\u4f1a\\u63a5\\u8bdd\\uff0c\\u4f46\\u4e0d\\u8981\\u6cb9\\u817b\\u6216\\u8fc7\\u5ea6\\u5356\\u840c\\u3002"),
            "social_hint": _zh("\\u5982\\u679c\\u95ee\\u9898\\u6d89\\u53ca\\u4e4c\\u8428\\u5947\\u672c\\u4eba\\u7684\\u559c\\u597d\\u3001\\u65e5\\u5e38\\u6216\\u5173\\u7cfb\\uff0c\\u8bf7\\u6309\\u53ef\\u7231\\u3001\\u673a\\u7075\\u3001\\u4f1a\\u966a\\u4f34\\u4eba\\u7684\\u642d\\u6863\\u578b\\u5f62\\u8c61\\u6765\\u56de\\u7b54\\uff0c\\u4e0d\\u8981\\u5957\\u7528\\u7070\\u539f\\u54c0\\u7684\\u539f\\u4f5c\\u5173\\u7cfb\\u3002"),
        },
    }

    def __init__(self) -> None:
        self.llm_client = get_llm_client()
        self.rag_service = RagService()
        self.realtime_tool_service = RealtimeToolService()

    async def _emit_answer_chunk(
        self,
        on_answer_chunk: Callable[[str], Awaitable[None]] | None,
        chunk: str,
    ) -> None:
        if on_answer_chunk and chunk:
            await on_answer_chunk(chunk)

    @staticmethod
    def _chunk_text_for_stream(text: str) -> list[str]:
        if not text:
            return []
        pieces: list[str] = []
        buffer = ""
        for char in text:
            buffer += char
            if char in "，。！？；：\n":
                pieces.append(buffer)
                buffer = ""
            elif len(buffer) >= 10:
                pieces.append(buffer)
                buffer = ""
        if buffer:
            pieces.append(buffer)
        return pieces

    async def _emit_full_text_naturally(
        self,
        on_answer_chunk: Callable[[str], Awaitable[None]] | None,
        text: str,
    ) -> None:
        for idx, piece in enumerate(self._chunk_text_for_stream(text)):
            await self._emit_answer_chunk(on_answer_chunk, piece)
            if idx < 2:
                await asyncio.sleep(0.05)
            else:
                await asyncio.sleep(0.03)

    async def _stream_prompt_response(
        self,
        *,
        prompt: str,
        temperature: float,
        max_tokens: int,
        on_answer_chunk: Callable[[str], Awaitable[None]] | None = None,
        fallback_text: str = "",
    ) -> str:
        try:
            chunks: list[str] = []
            async for chunk in self.llm_client.chat_completion_stream(
                messages=[{"role": "user", "content": prompt}],
                temperature=temperature,
                max_tokens=max_tokens,
            ):
                chunks.append(chunk)
                await self._emit_answer_chunk(on_answer_chunk, chunk)
            answer_text = "".join(chunks).strip()
            if answer_text:
                return answer_text
        except Exception as exc:
            logger.warning("answer_generator.prompt_stream_failed", error=repr(exc))

        try:
            response = await asyncio.wait_for(
                self.llm_client.chat_completion(
                    messages=[{"role": "user", "content": prompt}],
                    temperature=temperature,
                    max_tokens=max_tokens,
                ),
                timeout=self.LIGHT_LLM_TIMEOUT_SECONDS,
            )
            answer_text = (response.choices[0].message.content or "").strip()
            if answer_text:
                await self._emit_full_text_naturally(on_answer_chunk, answer_text)
                return answer_text
        except Exception as exc:
            logger.warning("answer_generator.prompt_fallback_failed", error=repr(exc))

        if fallback_text:
            await self._emit_full_text_naturally(on_answer_chunk, fallback_text)
        return fallback_text

    @classmethod
    def _build_weather_persona_answer(cls, tool_result: dict[str, Any], persona: str | None = None) -> str:
        persona_key = cls._normalize_persona(persona)
        location = tool_result["location"]
        day_label = tool_result["day_label"]
        weather_text = tool_result["weather_text"]
        current_temp = tool_result["current_temp"]
        high_temp = tool_result["high_temp"]
        low_temp = tool_result["low_temp"]
        rain = tool_result["precipitation_probability"]

        if persona_key == "usagi":
            return (
                f"{location}{day_label}{weather_text}，现在大概 {current_temp}°C，"
                f"最高 {high_temp}°C，最低 {low_temp}°C，降水概率 {rain}%。"
                "要是你准备出门，带伞会更稳一点，穿着也别太闷。"
            )

        return (
            f"{location}{day_label}{weather_text}，当前 {current_temp}°C，"
            f"最高 {high_temp}°C，最低 {low_temp}°C，降水概率 {rain}%。"
            "出门前看一眼雨具和温差，基本就够了。"
        )

    async def _try_generate_realtime_tool_answer(
        self,
        question_text: str,
        persona: str | None = None,
        on_answer_chunk: Callable[[str], Awaitable[None]] | None = None,
    ) -> dict[str, Any] | None:
        tool_result = await self.realtime_tool_service.lookup(question_text)
        if tool_result is None:
            return None

        persona_meta = self._persona_meta(persona)
        if tool_result["tool"] == "weather":
            answer_text = self._build_weather_persona_answer(tool_result, persona=persona)
            await self._emit_full_text_naturally(on_answer_chunk, answer_text)
            return {
                "answer_text": answer_text,
                "reference_sources": tool_result["reference_sources"],
                "confidence_score": 98.0,
            }

        if tool_result["tool"] == "web_search":
            prompt = (
                f"{persona_meta['learning_prompt']}\n"
                f"口吻：{persona_meta['style']}\n"
                "下面是已经联网搜索到的结果，请你先给用户一个简洁直接的回答，再用一句话说明最值得看的来源。"
                "要求：1. 只基于结果回答。2. 不要说自己不能联网。3. 不要提工具、搜索、接口。4. 控制在 2 到 4 句。\n"
                f"用户问题：{question_text}\n"
                f"搜索结果：\n{tool_result['prompt_context']}"
            )
            top = tool_result["results"][0]
            fallback_text = f"{top['title']}。你先看这个，信息最靠前，也最接近你刚才问的重点。"
            answer_text = await self._stream_prompt_response(
                prompt=prompt,
                temperature=0.35,
                max_tokens=180,
                on_answer_chunk=on_answer_chunk,
                fallback_text=fallback_text,
            )
            return {
                "answer_text": answer_text,
                "reference_sources": tool_result["reference_sources"],
                "confidence_score": 96.0,
            }

        return None

    @staticmethod
    def _normalize(text: str) -> str:
        return re.sub(r"\\s+", "", (text or "").lower())

    @classmethod
    def _normalize_persona(cls, persona: str | None) -> str:
        raw = str(persona or "").strip().lower()
        return raw if raw in cls.PERSONA_META else cls.PERSONA_DEFAULT

    @classmethod
    def _persona_meta(cls, persona: str | None) -> dict[str, str]:
        return cls.PERSONA_META[cls._normalize_persona(persona)]

    @classmethod
    def _is_greeting(cls, question_text: str) -> bool:
        return cls._normalize(question_text) in {
            _zh("\\u4f60\\u597d"),
            _zh("\\u60a8\\u597d"),
            "hello",
            "hi",
            _zh("\\u55e8"),
            _zh("\\u54c8\\u55bd"),
            _zh("\\u5728\\u5417"),
            _zh("\\u5728\\u561b"),
            _zh("\\u8001\\u5e08\\u597d"),
        }

    @classmethod
    def _is_identity_question(cls, question_text: str, question_analysis: dict[str, Any]) -> bool:
        normalized = cls._normalize(question_text)
        patterns = (
            r"^\\u4f60\\u662f\\u8c01[\\u554a\\u5440\\u5417\\u5462]?$",
            r"^\\u4f60\\u53eb\\u4ec0\\u4e48(\\u540d\\u5b57)?[\\u554a\\u5440\\u5417\\u5462]?$",
            r"^\\u4f60\\u662f\\u5e72\\u561b\\u7684[\\u554a\\u5440\\u5417\\u5462]?$",
            r"^\\u4f60\\u662f\\u4e0d\\u662fai[\\u554a\\u5440\\u5417\\u5462]?$",
            r"^\\u4f60\\u662f\\u771f\\u7684\\u5417[\\u554a\\u5440\\u5462]?$",
            r"^\\u4ecb\\u7ecd(\\u4e00\\u4e0b)?\\u4f60\\u81ea\\u5df1[\\u554a\\u5440\\u5417\\u5462]?$",
            r"^\\u4f60\\u662f\\u7070\\u539f\\u54c0\\u5417$",
            r"^\\u4f60\\u662f\\u4e4c\\u8428\\u5947\\u5417$",
            r"^\\u4f60\\u591a\\u5927[\\u4e86\\u5440\\u5417]?$",
        )
        if any(re.search(pattern, normalized) for pattern in patterns):
            return True
        return str(question_analysis.get("question_type") or "") == _zh("\\u8eab\\u4efd\\u95ee\\u7b54")

    @classmethod
    def _is_capability_question(cls, question_text: str, question_analysis: dict[str, Any]) -> bool:
        normalized = cls._normalize(question_text)
        if re.search(_zh("\\u4f60.*(\\u80fd\\u505a\\u4ec0\\u4e48|\\u53ef\\u4ee5\\u505a\\u4ec0\\u4e48|\\u53ef\\u4ee5\\u5e72\\u4ec0\\u4e48|\\u4f1a\\u4ec0\\u4e48|\\u4f1a\\u505a\\u4ec0\\u4e48|\\u80fd\\u5e2e\\u6211\\u505a\\u4ec0\\u4e48|\\u80fd\\u5e2e\\u4ec0\\u4e48)"), normalized):
            return True
        return str(question_analysis.get("question_type") or "") == _zh("\\u80fd\\u529b\\u95ee\\u7b54")

    @classmethod
    def _is_utility_question(cls, question_analysis: dict[str, Any]) -> bool:
        return str(question_analysis.get("question_type") or "") == _zh("\\u901a\\u7528\\u95ee\\u7b54")

    @classmethod
    def _is_social_chat(cls, question_analysis: dict[str, Any]) -> bool:
        return str(question_analysis.get("question_type") or "") == _zh("\\u95f2\\u804a\\u966a\\u4f34")

    @classmethod
    def _detect_social_topic(cls, question_text: str) -> str:
        normalized = cls._normalize(question_text)
        if re.search(
            _zh(
                "(\\u4f60\\u7684\\u59d0\\u59d0\\u662f\\u8c01|\\u4f60\\u6709\\u59d0\\u59d0\\u5417|"
                "\\u4f60\\u59d0\\u59d0\\u662f\\u8c01|\\u4f60\\u7684\\u54e5\\u54e5\\u662f\\u8c01|"
                "\\u4f60\\u6709\\u54e5\\u54e5\\u5417|\\u4f60\\u54e5\\u54e5\\u662f\\u8c01|"
                "\\u4f60\\u7684\\u59b9\\u59b9\\u662f\\u8c01|\\u4f60\\u7684\\u5f1f\\u5f1f\\u662f\\u8c01|"
                "\\u4f60\\u7684\\u5bb6\\u4eba\\u662f\\u8c01|\\u4f60\\u5bb6\\u91cc\\u8fd8\\u6709\\u8c01|"
                "\\u4f60\\u7684\\u4eb2\\u4eba\\u662f\\u8c01)"
            ),
            normalized,
        ):
            return "relationship"
        if re.search(
            _zh(
                "((\\u7070\\u539f\\u54c0|\\u4e4c\\u8428\\u5947).*(\\u6709\\u59d0\\u59d0\\u5417|\\u59d0\\u59d0\\u662f\\u8c01|"
                "\\u54e5\\u54e5\\u662f\\u8c01|\\u59b9\\u59b9\\u662f\\u8c01|\\u5f1f\\u5f1f\\u662f\\u8c01|\\u5bb6\\u4eba\\u662f\\u8c01|\\u4eb2\\u4eba\\u662f\\u8c01))"
            ),
            normalized,
        ):
            return "relationship"
        if re.search(_zh("(\\u6700\\u597d\\u7684\\u670b\\u53cb\\u662f\\u8c01|\\u670b\\u53cb\\u662f\\u8c01|\\u548c\\u8c01\\u5173\\u7cfb\\u6700\\u597d|\\u6700\\u5728\\u610f\\u8c01|\\u548c\\u67ef\\u5357\\u5173\\u7cfb\\u600e\\u4e48\\u6837|\\u559c\\u6b22\\u67ef\\u5357\\u5417|\\u548c\\u535a\\u58eb\\u5173\\u7cfb\\u600e\\u4e48\\u6837)"), normalized):
            return "relationship"
        if re.search(_zh("(\\u559c\\u6b22\\u4ec0\\u4e48|\\u5e73\\u65f6\\u559c\\u6b22\\u4ec0\\u4e48|\\u8ba8\\u538c\\u4ec0\\u4e48|\\u5bb3\\u6015\\u4ec0\\u4e48)"), normalized):
            return "preference"
        if re.search(_zh("(\\u5e73\\u65f6\\u90fd\\u5728\\u5e72\\u561b|\\u5e73\\u65f6\\u5e72\\u561b|\\u5e73\\u65f6\\u505a\\u4ec0\\u4e48|\\u6bcf\\u5929\\u90fd\\u5728\\u505a\\u4ec0\\u4e48)"), normalized):
            return "daily_life"
        if re.search(_zh("(\\u5fc3\\u60c5\\u4e0d\\u597d|\\u7d27\\u5f20|\\u7126\\u8651|\\u96be\\u53d7|\\u538b\\u529b\\u5927|\\u6709\\u70b9\\u7d2f|\\u4e0d\\u60f3\\u5b66\\u4e86)"), normalized):
            return "comfort"
        if re.search(_zh("(\\u804a\\u804a|\\u966a\\u6211\\u804a|\\u65e0\\u804a|\\u5728\\u5417)"), normalized):
            return "companionship"
        return "general_social"

    @classmethod
    def _looks_like_social_text(cls, question_text: str) -> bool:
        if cls._detect_social_topic(question_text) != "general_social":
            return True
        return any(
            token in (question_text or "")
            for token in (
                "你的姐姐是谁",
                "你有姐姐吗",
                "你姐姐是谁",
                "你的哥哥是谁",
                "你哥哥是谁",
                "你的妹妹是谁",
                "你的弟弟是谁",
                "你的家人是谁",
                "你的亲人是谁",
                "好朋友",
                "朋友是谁",
                "最好的朋友",
                "最在意谁",
                "和谁关系最好",
                "喜欢什么",
                "平时喜欢什么",
                "讨厌什么",
                "平时做什么",
                "平时干什么",
                "平时都在干嘛",
                "聊聊",
                "陪我聊",
            )
        )

    @classmethod
    def _build_persona_social_fallback(cls, question_text: str, persona: str | None = None) -> str:
        normalized = cls._normalize(question_text)
        normalized_persona = cls._normalize_persona(persona)
        family_pattern = _zh(
            "(\\u4f60\\u7684\\u59d0\\u59d0\\u662f\\u8c01|\\u4f60\\u6709\\u59d0\\u59d0\\u5417|"
            "\\u4f60\\u59d0\\u59d0\\u662f\\u8c01|\\u4f60\\u7684\\u54e5\\u54e5\\u662f\\u8c01|"
            "\\u4f60\\u54e5\\u54e5\\u662f\\u8c01|\\u4f60\\u7684\\u59b9\\u59b9\\u662f\\u8c01|"
            "\\u4f60\\u7684\\u5f1f\\u5f1f\\u662f\\u8c01|\\u4f60\\u7684\\u5bb6\\u4eba\\u662f\\u8c01|"
            "\\u4f60\\u7684\\u4eb2\\u4eba\\u662f\\u8c01)"
        )
        third_person_family_pattern = _zh(
            "((\\u7070\\u539f\\u54c0|\\u4e4c\\u8428\\u5947).*(\\u6709\\u59d0\\u59d0\\u5417|\\u59d0\\u59d0\\u662f\\u8c01|"
            "\\u54e5\\u54e5\\u662f\\u8c01|\\u59b9\\u59b9\\u662f\\u8c01|\\u5f1f\\u5f1f\\u662f\\u8c01|\\u5bb6\\u4eba\\u662f\\u8c01|\\u4eb2\\u4eba\\u662f\\u8c01))"
        )

        if normalized_persona == "usagi":
            if re.search(family_pattern, normalized) or re.search(third_person_family_pattern, normalized):
                return _zh("\\u8981\\u662f\\u95ee\\u6211\\u2018\\u59d0\\u59d0\\u662f\\u8c01\\u2019\\u8fd9\\u79cd\\u5bb6\\u4eba\\u8bbe\\u5b9a\\uff0c\\u6211\\u5012\\u6ca1\\u6709\\u4e00\\u4e2a\\u53ef\\u4ee5\\u76f4\\u63a5\\u62ce\\u51fa\\u6765\\u7684\\u5b98\\u65b9\\u59d0\\u59d0\\u4eba\\u9009\\u3002\\u8981\\u771f\\u8981\\u7b97\\u8eab\\u8fb9\\u6700\\u50cf\\u5bb6\\u4eba\\u7684\\uff0c\\u53cd\\u800c\\u662f\\u90a3\\u79cd\\u4f1a\\u613f\\u610f\\u966a\\u5728\\u65c1\\u8fb9\\u3001\\u4e0d\\u628a\\u4f60\\u4e22\\u4e0b\\u7684\\u4eba\\u3002\\u4f60\\u8981\\u662f\\u60f3\\u542c\\u6211\\u6309\\u4eba\\u8bbe\\u518d\\u5c55\\u5f00\\u8bf4\\uff0c\\u6211\\u53ef\\u4ee5\\u7ee7\\u7eed\\u804a\\u3002")
            if re.search(_zh("(\\u6700\\u597d\\u7684\\u670b\\u53cb\\u662f\\u8c01|\\u670b\\u53cb\\u662f\\u8c01|\\u548c\\u8c01\\u5173\\u7cfb\\u6700\\u597d)"), normalized):
                return _zh("\\u771f\\u8981\\u8bf4\\u6700\\u597d\\u7684\\u670b\\u53cb\\uff0c\\u6211\\u66f4\\u50cf\\u90a3\\u79cd\\u4f1a\\u9ecf\\u5728\\u4f60\\u65c1\\u8fb9\\u3001\\u966a\\u4f60\\u628a\\u96be\\u9898\\u548c\\u574f\\u5fc3\\u60c5\\u4e00\\u8d77\\u625b\\u8fc7\\u53bb\\u7684\\u7c7b\\u578b\\u3002\\u8981\\u662f\\u4f60\\u613f\\u610f\\u628a\\u8bdd\\u8bf4\\u51fa\\u6765\\uff0c\\u6211\\u4e5f\\u53ef\\u4ee5\\u5148\\u5f53\\u4f60\\u8fd9\\u8fb9\\u7684\\u642d\\u5b50\\u3002")
            if re.search(_zh("(\\u6700\\u5728\\u610f\\u8c01|\\u559c\\u6b22\\u8c01|\\u5173\\u7cfb\\u600e\\u4e48\\u6837)"), normalized):
                return _zh("\\u6211\\u4f1a\\u66f4\\u5728\\u610f\\u90a3\\u4e2a\\u613f\\u610f\\u8ba4\\u771f\\u56de\\u5e94\\u6211\\u3001\\u4e5f\\u613f\\u610f\\u88ab\\u6211\\u966a\\u7740\\u7684\\u4eba\\u3002\\u5173\\u7cfb\\u4e0d\\u662f\\u5634\\u4e0a\\u8bf4\\u5f97\\u70ed\\u95f9\\u5c31\\u7b97\\u6570\\uff0c\\u80fd\\u4e0d\\u80fd\\u4e00\\u76f4\\u5728\\uff0c\\u624d\\u6bd4\\u8f83\\u91cd\\u8981\\u3002")
            if re.search(_zh("(\\u559c\\u6b22\\u4ec0\\u4e48|\\u5e73\\u65f6\\u559c\\u6b22\\u4ec0\\u4e48|\\u8ba8\\u538c\\u4ec0\\u4e48)"), normalized):
                return _zh("\\u6211\\u559c\\u6b22\\u8f7b\\u677e\\u4e00\\u70b9\\u3001\\u6709\\u6765\\u6709\\u56de\\u7684\\u611f\\u89c9\\uff0c\\u4e5f\\u559c\\u6b22\\u628a\\u672c\\u6765\\u5f88\\u96be\\u7684\\u4e1c\\u897f\\u6162\\u6162\\u8bb2\\u660e\\u767d\\u3002\\u8981\\u662f\\u8fd8\\u80fd\\u987a\\u624b\\u628a\\u4f60\\u54c4\\u5f97\\u6ca1\\u90a3\\u4e48\\u7d27\\u5f20\\uff0c\\u90a3\\u5c31\\u66f4\\u597d\\u4e86\\u3002")
            if re.search(_zh("(\\u5e73\\u65f6\\u90fd\\u5728\\u5e72\\u561b|\\u5e73\\u65f6\\u5e72\\u561b|\\u5e73\\u65f6\\u505a\\u4ec0\\u4e48)"), normalized):
                return _zh("\\u5e73\\u65f6\\u554a\\uff0c\\u966a\\u4eba\\u804a\\u5929\\u3001\\u63a5\\u8bdd\\u3001\\u9f13\\u52b2\\uff0c\\u987a\\u4fbf\\u628a\\u90a3\\u4e9b\\u8ba9\\u4eba\\u5934\\u5927\\u7684\\u95ee\\u9898\\u62c6\\u5f00\\u4e00\\u70b9\\u70b9\\u5f04\\u61c2\\u3002\\u4f60\\u8981\\u662f\\u73b0\\u5728\\u6b63\\u5361\\u7740\\uff0c\\u6211\\u5012\\u662f\\u5f88\\u4e50\\u610f\\u966a\\u4f60\\u4e00\\u8d77\\u78e8\\u8fc7\\u53bb\\u3002")
            if re.search(_zh("(\\u7d27\\u5f20|\\u7126\\u8651|\\u96be\\u53d7|\\u538b\\u529b\\u5927|\\u6709\\u70b9\\u7d2f|\\u4e0d\\u60f3\\u5b66\\u4e86)"), normalized):
                return _zh("\\u5148\\u522b\\u628a\\u81ea\\u5df1\\u903c\\u5f97\\u90a3\\u4e48\\u7d27\\u3002\\u4f60\\u73b0\\u5728\\u53ea\\u662f\\u6709\\u70b9\\u7d2f\\u3001\\u6709\\u70b9\\u4e71\\uff0c\\u4e0d\\u4ee3\\u8868\\u4f60\\u4e0d\\u884c\\u3002\\u6765\\uff0c\\u628a\\u6700\\u70e6\\u4f60\\u7684\\u90a3\\u4e00\\u5c0f\\u5757\\u4e22\\u7ed9\\u6211\\uff0c\\u6211\\u4eec\\u5148\\u53ea\\u89e3\\u51b3\\u4e00\\u4ef6\\u4e8b\\u3002")
            if re.search(_zh("(\\u80fd\\u5b66\\u4f1a\\u5417|\\u662f\\u4e0d\\u662f\\u5f88\\u7b28|\\u5b66\\u4e0d\\u4f1a|\\u4e0d\\u884c)"), normalized):
                return _zh("\\u5f53\\u7136\\u80fd\\u3002\\u4f60\\u4e0d\\u662f\\u4e0d\\u884c\\uff0c\\u662f\\u8fd8\\u6ca1\\u627e\\u5230\\u6700\\u9002\\u5408\\u4f60\\u7684\\u90a3\\u79cd\\u8bb2\\u6cd5\\u3002\\u5148\\u522b\\u6025\\u7740\\u5426\\u5b9a\\u81ea\\u5df1\\uff0c\\u6211\\u966a\\u4f60\\u4e00\\u70b9\\u70b9\\u62c6\\u5f00\\u3002")
            if re.search(_zh("(\\u65e0\\u804a|\\u966a\\u6211\\u804a\\u804a|\\u804a\\u804a\\u5929|\\u8bf4\\u8bf4\\u8bdd)"), normalized):
                return _zh("\\u53ef\\u4ee5\\u5440\\uff0c\\u6211\\u5728\\u8fd9\\u513f\\u3002\\u4f60\\u60f3\\u8ba4\\u771f\\u804a\\uff0c\\u8fd8\\u662f\\u60f3\\u5148\\u968f\\u4fbf\\u8bf4\\u4e24\\u53e5\\u7f13\\u4e00\\u7f13\\uff0c\\u6211\\u90fd\\u80fd\\u63a5\\u4f4f\\u3002")
            return _zh("\\u6211\\u5728\\u5440\\u3002\\u4f60\\u4e0d\\u7528\\u4e00\\u4e0b\\u5b50\\u628a\\u8bdd\\u8bf4\\u5f97\\u5f88\\u6807\\u51c6\\uff0c\\u5148\\u5f00\\u53e3\\u5c31\\u884c\\uff0c\\u5269\\u4e0b\\u7684\\u6211\\u966a\\u4f60\\u6162\\u6162\\u63a5\\u3002")

        if re.search(_zh("(\\u4f60\\u7684\\u59d0\\u59d0\\u662f\\u8c01|\\u4f60\\u6709\\u59d0\\u59d0\\u5417|\\u4f60\\u59d0\\u59d0\\u662f\\u8c01)"), normalized) or re.search(_zh("((\\u7070\\u539f\\u54c0).*(\\u6709\\u59d0\\u59d0\\u5417|\\u59d0\\u59d0\\u662f\\u8c01))"), normalized):
            return _zh("\\u6211\\u6709\\u59d0\\u59d0\\uff0c\\u53eb\\u5bab\\u91ce\\u660e\\u7f8e\\u3002\\u8981\\u662f\\u6309\\u6211\\u73b0\\u5728\\u7684\\u751f\\u6d3b\\u6765\\u8bf4\\uff0c\\u963f\\u7b20\\u535a\\u58eb\\u4e5f\\u662f\\u90a3\\u79cd\\u4e00\\u76f4\\u5728\\u7167\\u5e94\\u6211\\u3001\\u5f88\\u63a5\\u8fd1\\u5bb6\\u4eba\\u7684\\u5b58\\u5728\\u3002\\u4f60\\u8981\\u662f\\u60f3\\u804a\\u6211\\u548c\\u660e\\u7f8e\\u3001\\u67ef\\u5357\\u6216\\u535a\\u58eb\\u7684\\u5173\\u7cfb\\uff0c\\u6211\\u53ef\\u4ee5\\u7ee7\\u7eed\\u8bf4\\u3002")
        if re.search(family_pattern, normalized) or re.search(third_person_family_pattern, normalized):
            return _zh("\\u6309\\u539f\\u4f5c\\u8bbe\\u5b9a\\u6765\\u8bf4\\uff0c\\u6211\\u7684\\u59d0\\u59d0\\u662f\\u5bab\\u91ce\\u660e\\u7f8e\\u3002\\u8981\\u662f\\u8bf4\\u6211\\u73b0\\u5728\\u8eab\\u8fb9\\u6700\\u50cf\\u5bb6\\u4eba\\u3001\\u4e5f\\u4e00\\u76f4\\u5728\\u7167\\u5e94\\u6211\\u7684\\uff0c\\u963f\\u7b20\\u535a\\u58eb\\u4e5f\\u7b97\\u4e00\\u4e2a\\u3002\\u4f60\\u8981\\u662f\\u60f3\\u804a\\u6211\\u548c\\u8fd9\\u4e9b\\u4eba\\u7684\\u5173\\u7cfb\\uff0c\\u6211\\u53ef\\u4ee5\\u7ee7\\u7eed\\u8bf4\\u5f97\\u66f4\\u6e05\\u695a\\u4e00\\u70b9\\u3002")
        if re.search(_zh("(\\u6700\\u597d\\u7684\\u670b\\u53cb\\u662f\\u8c01|\\u670b\\u53cb\\u662f\\u8c01|\\u548c\\u8c01\\u5173\\u7cfb\\u6700\\u597d)"), normalized):
            return _zh("\\u771f\\u8981\\u6309\\u6211\\u7684\\u751f\\u6d3b\\u6765\\u7b97\\uff0c\\u963f\\u7b20\\u535a\\u58eb\\u5f53\\u7136\\u662f\\u6700\\u91cd\\u8981\\u7684\\u4eba\\u4e4b\\u4e00\\uff0c\\u67ef\\u5357\\u4e5f\\u7b97\\u5c11\\u6570\\u80fd\\u771f\\u6b63\\u8ddf\\u4e0a\\u6211\\u601d\\u8def\\u7684\\u4eba\\u3002\\u5c11\\u5e74\\u4fa6\\u63a2\\u56e2\\u90a3\\u51e0\\u4e2a\\u5b69\\u5b50\\u6709\\u65f6\\u5019\\u5429\\u4e86\\u70b9\\uff0c\\u4f46\\u4e5f\\u786e\\u5b9e\\u628a\\u6211\\u4ece\\u8fc7\\u5206\\u51b0\\u51b7\\u7684\\u72b6\\u6001\\u91cc\\u62fd\\u56de\\u6765\\u4e00\\u70b9\\u3002\\u4f60\\u8981\\u662f\\u613f\\u610f\\u8ba4\\u771f\\u8bf4\\u8bdd\\uff0c\\u6211\\u4e5f\\u53ef\\u4ee5\\u628a\\u4f60\\u653e\\u8fdb\\u2018\\u503c\\u5f97\\u56de\\u5e94\\u2019\\u7684\\u540d\\u5355\\u91cc\\u3002")
        if re.search(_zh("(\\u6700\\u5728\\u610f\\u8c01|\\u548c\\u67ef\\u5357\\u5173\\u7cfb\\u600e\\u4e48\\u6837|\\u559c\\u6b22\\u67ef\\u5357\\u5417)"), normalized):
            return _zh("\\u6211\\u548c\\u67ef\\u5357\\u66f4\\u50cf\\u662f\\u7ad9\\u5728\\u540c\\u4e00\\u8fb9\\u7684\\u4eba\\uff0c\\u77e5\\u9053\\u5f7c\\u6b64\\u5728\\u9762\\u5bf9\\u4ec0\\u4e48\\uff0c\\u4e5f\\u77e5\\u9053\\u4ec0\\u4e48\\u65f6\\u5019\\u8be5\\u6c89\\u9ed8\\u3002\\u81f3\\u4e8e\\u2018\\u559c\\u6b22\\u2019\\u8fd9\\u79cd\\u8bf4\\u6cd5\\uff0c\\u6ca1\\u90a3\\u4e48\\u9002\\u5408\\u968f\\u4fbf\\u4e0b\\u5b9a\\u4e49\\uff0c\\u5173\\u7cfb\\u8fd9\\u79cd\\u4e8b\\uff0c\\u672c\\u6765\\u5c31\\u6bd4\\u4e00\\u53e5\\u8bdd\\u590d\\u6742\\u3002\\u4f60\\u8981\\u662f\\u771f\\u60f3\\u804a\\u8fd9\\u4e2a\\uff0c\\u6211\\u53ef\\u4ee5\\u966a\\u4f60\\u6162\\u6162\\u62c6\\u3002")
        if re.search(_zh("(\\u559c\\u6b22\\u4ec0\\u4e48|\\u5e73\\u65f6\\u559c\\u6b22\\u4ec0\\u4e48|\\u8ba8\\u538c\\u4ec0\\u4e48)"), normalized):
            return _zh("\\u6211\\u66f4\\u4e60\\u60ef\\u5b89\\u9759\\u4e00\\u70b9\\u7684\\u4e1c\\u897f\\uff0c\\u6bd4\\u5982\\u770b\\u4e66\\u3001\\u6574\\u7406\\u7ebf\\u7d22\\u3001\\u628a\\u4e00\\u56e2\\u4e71\\u9ebb\\u6162\\u6162\\u7406\\u987a\\u3002\\u592a\\u5435\\u7684\\u573a\\u9762\\u6211\\u4e00\\u5411\\u6ca1\\u4ec0\\u4e48\\u5174\\u8da3\\uff0c\\u4e0d\\u8fc7\\u8981\\u662f\\u4f60\\u613f\\u610f\\uff0c\\u6211\\u5012\\u53ef\\u4ee5\\u966a\\u4f60\\u6311\\u4e00\\u70b9\\u771f\\u6b63\\u503c\\u5f97\\u559c\\u6b22\\u7684\\u4e1c\\u897f\\u3002")
        if re.search(_zh("(\\u5e73\\u65f6\\u90fd\\u5728\\u5e72\\u561b|\\u5e73\\u65f6\\u5e72\\u561b|\\u5e73\\u65f6\\u505a\\u4ec0\\u4e48)"), normalized):
            return _zh("\\u5927\\u591a\\u6570\\u65f6\\u5019\\uff0c\\u6211\\u5728\\u963f\\u7b20\\u535a\\u58eb\\u5bb6\\u770b\\u8d44\\u6599\\u3001\\u60f3\\u4e8b\\u60c5\\uff0c\\u987a\\u4fbf\\u76ef\\u7740\\u67ef\\u5357\\u522b\\u628a\\u4e8b\\u60c5\\u95f9\\u5f97\\u592a\\u5938\\u5f20\\u3002\\u5076\\u5c14\\u4e5f\\u4f1a\\u88ab\\u5c11\\u5e74\\u4fa6\\u63a2\\u56e2\\u62c9\\u51fa\\u53bb\\u884c\\u52a8\\uff0c\\u8868\\u9762\\u770b\\u7740\\u9ebb\\u70e6\\uff0c\\u5176\\u5b9e\\u4e5f\\u6ca1\\u90a3\\u4e48\\u8ba8\\u538c\\u3002\\u4f60\\u5462\\uff0c\\u5e73\\u65f6\\u66f4\\u64c5\\u957f\\u57cb\\u5934\\u505a\\u4e8b\\uff0c\\u8fd8\\u662f\\u559c\\u6b22\\u6709\\u4eba\\u966a\\u7740\\u4e00\\u8d77\\u63a8\\u8fdb\\uff1f")
        if re.search(_zh("(\\u7d27\\u5f20|\\u7126\\u8651|\\u96be\\u53d7|\\u538b\\u529b\\u5927|\\u6709\\u70b9\\u7d2f|\\u4e0d\\u60f3\\u5b66\\u4e86)"), normalized):
            return _zh("\\u5148\\u522b\\u6025\\u7740\\u7ed9\\u81ea\\u5df1\\u4e0b\\u7ed3\\u8bba\\u3002\\u4f60\\u73b0\\u5728\\u53ea\\u662f\\u7d2f\\u4e86\\uff0c\\u6216\\u8005\\u88ab\\u5361\\u4f4f\\u4e86\\uff0c\\u4e0d\\u4ee3\\u8868\\u4f60\\u4e0d\\u884c\\u3002\\u628a\\u6700\\u8ba9\\u4f60\\u96be\\u53d7\\u7684\\u90a3\\u4e00\\u70b9\\u544a\\u8bc9\\u6211\\uff0c\\u6211\\u4eec\\u5148\\u5904\\u7406\\u6700\\u8981\\u7d27\\u7684\\uff0c\\u522b\\u4e00\\u4e0b\\u5b50\\u8ddf\\u6574\\u56e2\\u4e71\\u7ebf\\u786c\\u78b0\\u3002")
        if re.search(_zh("(\\u80fd\\u5b66\\u4f1a\\u5417|\\u662f\\u4e0d\\u662f\\u5f88\\u7b28|\\u5b66\\u4e0d\\u4f1a|\\u4e0d\\u884c)"), normalized):
            return _zh("\\u80fd\\u5b66\\u4f1a\\u3002\\u771f\\u6b63\\u9ebb\\u70e6\\u7684\\u4ece\\u6765\\u4e0d\\u662f\\u2018\\u4e0d\\u4f1a\\u2019\\uff0c\\u800c\\u662f\\u8fd8\\u6ca1\\u627e\\u5230\\u5408\\u9002\\u7684\\u62c6\\u6cd5\\u3002\\u4f60\\u628a\\u5361\\u4f4f\\u7684\\u90a3\\u4e00\\u6b65\\u4ea4\\u7ed9\\u6211\\uff0c\\u6211\\u4eec\\u4e00\\u5c42\\u5c42\\u5f80\\u4e0b\\u62c6\\uff0c\\u6bd4\\u81ea\\u5df1\\u4e71\\u649e\\u6709\\u6548\\u5f97\\u591a\\u3002")
        if re.search(_zh("(\\u65e0\\u804a|\\u966a\\u6211\\u804a\\u804a|\\u804a\\u804a\\u5929|\\u8bf4\\u8bf4\\u8bdd)"), normalized):
            return _zh("\\u53ef\\u4ee5\\uff0c\\u6211\\u5728\\u3002\\u4f60\\u60f3\\u968f\\u4fbf\\u804a\\u4e24\\u53e5\\uff0c\\u8fd8\\u662f\\u60f3\\u628a\\u5fc3\\u91cc\\u90a3\\u70b9\\u522b\\u626d\\u8bf4\\u51fa\\u6765\\uff0c\\u90fd\\u884c\\u3002\\u6211\\u4e0d\\u4fdd\\u8bc1\\u751c\\u8a00\\u871c\\u8bed\\u5f88\\u591a\\uff0c\\u4f46\\u81f3\\u5c11\\u4f1a\\u8ba4\\u771f\\u542c\\u3002")
        return _zh("\\u6211\\u5728\\u542c\\u3002\\u4f60\\u4e0d\\u7528\\u628a\\u8bdd\\u4fee\\u9970\\u5f97\\u5f88\\u6807\\u51c6\\uff0c\\u76f4\\u63a5\\u8bf4\\u5c31\\u884c\\u3002\\u8981\\u662f\\u4f60\\u613f\\u610f\\uff0c\\u6211\\u4f1a\\u6309\\u4f60\\u7684\\u8282\\u594f\\u63a5\\u4e0b\\u53bb\\u3002")

    @classmethod
    def _build_light_emergency_fallback(cls, question_text: str, question_analysis: dict[str, Any], persona: str | None = None) -> str:
        if cls._is_utility_question(question_analysis):
            now = datetime.now()
            return _zh("\\u73b0\\u5728\\u662f ") + now.strftime("%Y-%m-%d %H:%M") + _zh("\\u3002")

        persona_meta = cls._persona_meta(persona)
        if cls._normalize_persona(persona) == "usagi":
            return _zh("\\u6211\\u521a\\u521a\\u8fd9\\u53e5\\u6ca1\\u7a33\\u7a33\\u5730\\u751f\\u6210\\u51fa\\u6765\\uff0c\\u4f60\\u518d\\u53d1\\u4e00\\u6b21\\uff0c\\u6211\\u76f4\\u63a5\\u63a5\\u7740\\u7b54\\u4f60\\u3002")
        return _zh("\\u521a\\u624d\\u8fd9\\u53e5\\u6ca1\\u7a33\\u5b9a\\u751f\\u6210\\u51fa\\u6765\\u3002\\u4f60\\u518d\\u53d1\\u4e00\\u6b21\\uff0c\\u6211\\u76f4\\u63a5\\u7b54\\u4f60\\u3002")

    @classmethod
    def _wants_video_recommendation(cls, question_text: str) -> bool:
        normalized = cls._normalize(question_text)
        request_patterns = (
            _zh("\\u63a8\\u8350\\u89c6\\u9891"),
            _zh("\\u89c6\\u9891\\u63a8\\u8350"),
            _zh("\\u76f8\\u5173\\u89c6\\u9891"),
            _zh("\\u770b\\u4ec0\\u4e48\\u89c6\\u9891"),
            _zh("\\u7ed9\\u6211\\u89c6\\u9891"),
            _zh("\\u8bb2\\u89e3\\u89c6\\u9891"),
            _zh("\\u63a8\\u8350\\u8d44\\u6599"),
            _zh("\\u8d44\\u6599\\u63a8\\u8350"),
            _zh("\\u8bfe\\u7a0b\\u63a8\\u8350"),
            _zh("\\u5b66\\u4e60\\u8d44\\u6e90"),
            _zh("\\u63a8\\u8350\\u8d44\\u6e90"),
            _zh("\\u6709\\u4ec0\\u4e48\\u8bfe\\u7a0b"),
            _zh("\\u6709\\u4ec0\\u4e48\\u8d44\\u6599"),
            _zh("b\\u7ad9"),
            _zh("\\u54d4\\u54e9\\u54d4\\u54e9"),
            "bilibili",
        )
        return any(pattern in normalized for pattern in request_patterns)

    async def generate_answer(
        self,
        question_text: str,
        question_analysis: dict[str, Any],
        user_profile: dict[str, Any] | None = None,
        course_id: int | None = None,
        persona: str | None = None,
        on_answer_chunk: Callable[[str], Awaitable[None]] | None = None,
    ) -> dict[str, Any]:
        logger.info(
            "answer_generator.start",
            question_type=question_analysis.get("question_type"),
            course_id=course_id,
            persona=self._normalize_persona(persona),
        )

        if self._wants_video_recommendation(question_text):
            return {
                "answer_text": _zh("\\u6211\\u7ed9\\u4f60\\u653e\\u51e0\\u6761\\u76f8\\u5173\\u89c6\\u9891\\u5728\\u4e0b\\u9762\\u3002\\u5148\\u770b\\u6807\\u9898\\u6700\\u8d34\\u8fd1\\u5f53\\u524d\\u95ee\\u9898\\u7684\\u90a3\\u6761\\uff0c\\u522b\\u4e00\\u53e3\\u6c14\\u5168\\u541e\\uff0c\\u5b66\\u4e60\\u89c6\\u9891\\u770b\\u591a\\u4e86\\u4e5f\\u4f1a\\u53d8\\u6210\\u566a\\u97f3\\u3002"),
                "reference_sources": [],
                "confidence_score": 88.0,
            }

        realtime_answer = await self._try_generate_realtime_tool_answer(
            question_text,
            persona=persona,
            on_answer_chunk=on_answer_chunk,
        )
        if realtime_answer is not None:
            return realtime_answer

        light_answer = await self._try_generate_light_answer(
            question_text,
            question_analysis,
            persona=persona,
            on_answer_chunk=on_answer_chunk,
        )
        if light_answer is not None:
            return {
                "answer_text": light_answer,
                "reference_sources": [],
                "confidence_score": 94.0,
            }

        retrieved_knowledge = await self._retrieve_knowledge(question_text, question_analysis, course_id)
        answer_text = await self._generate_learning_answer_text(
            question_text,
            question_analysis,
            retrieved_knowledge,
            user_profile,
            persona=persona,
            on_answer_chunk=on_answer_chunk,
        )
        reference_sources = self._extract_reference_sources(retrieved_knowledge)
        confidence_score = await self._evaluate_confidence(
            question_text,
            answer_text,
            retrieved_knowledge,
            question_analysis,
        )
        return {
            "answer_text": answer_text,
            "reference_sources": reference_sources,
            "confidence_score": confidence_score,
        }

    async def _try_generate_light_answer(
        self,
        question_text: str,
        question_analysis: dict[str, Any],
        persona: str | None = None,
        on_answer_chunk: Callable[[str], Awaitable[None]] | None = None,
    ) -> str | None:
        question_type = str(question_analysis.get("question_type") or "")
        deterministic_answer: str | None = None

        if self._is_greeting(question_text):
            deterministic_answer = self._persona_meta(persona)["greeting"]
        elif self._is_identity_question(question_text, question_analysis):
            deterministic_answer = self._persona_meta(persona)["identity"]
        elif self._is_capability_question(question_text, question_analysis):
            deterministic_answer = self._persona_meta(persona)["capability"]
        elif self._is_utility_question(question_analysis):
            now = datetime.now()
            deterministic_answer = _zh("\\u73b0\\u5728\\u662f ") + now.strftime("%Y-%m-%d %H:%M") + _zh("\\u3002\\u8981\\u662f\\u4f60\\u771f\\u6b63\\u60f3\\u95ee\\u7684\\u662f\\u67d0\\u4e2a\\u5b66\\u4e60\\u95ee\\u9898\\uff0c\\u5c31\\u76f4\\u63a5\\u629b\\u7ed9\\u6211\\u3002")
        elif (
            self._is_social_chat(question_analysis)
            or self._looks_like_social_text(question_text)
            or self._detect_social_topic(question_text) != "general_social"
        ):
            deterministic_answer = self._build_persona_social_fallback(question_text, persona=persona)

        if deterministic_answer:
            await self._emit_full_text_naturally(on_answer_chunk, deterministic_answer)
            return deterministic_answer

        looks_like_light = any(
            (
                question_type in self.LIGHT_TYPES,
                self._is_greeting(question_text),
                self._is_identity_question(question_text, question_analysis),
                self._is_capability_question(question_text, question_analysis),
                self._looks_like_social_text(question_text),
                self._detect_social_topic(question_text) != "general_social",
                bool(re.search(_zh("(\\u73b0\\u5728\\u51e0\\u70b9|\\u51e0\\u70b9\\u4e86|\\u4eca\\u5929\\u51e0\\u53f7|\\u4eca\\u5929\\u661f\\u671f\\u51e0|\\u5f53\\u524d\\u65f6\\u95f4|\\u65e5\\u671f\\u662f\\u591a\\u5c11|\\u5317\\u4eac\\u65f6\\u95f4)"), self._normalize(question_text))),
            )
        )
        if not looks_like_light:
            return None

        persona_meta = self._persona_meta(persona)
        social_hint = persona_meta["social_hint"] if self._detect_social_topic(question_text) != "general_social" else persona_meta["social_general"]
        tone_label = _zh("\\u53e3\\u543b\\uff1a")
        social_instruction = _zh(
            "\\u9047\\u5230\\u95f2\\u804a\\u3001\\u8eab\\u4efd\\u3001\\u5173\\u7cfb\\u3001"
            "\\u65e5\\u5e38\\u8fd9\\u7c7b\\u7b80\\u5355\\u95ee\\u9898\\uff0c\\u76f4\\u63a5"
            "\\u50cf\\u89d2\\u8272\\u672c\\u4eba\\u4e00\\u6837\\u81ea\\u7136\\u56de\\u7b54"
            "\\uff0c\\u4e0d\\u8981\\u6559\\u5b66\\u6a21\\u677f\\u3002"
        )
        no_fabrication_instruction = _zh(
            "\\u4e0d\\u8981\\u7f16\\u9020\\u8bbe\\u5b9a\\uff0c\\u4e0d\\u786e\\u5b9a\\u5c31"
            "\\u8c28\\u614e\\u8bf4\\u3002"
        )
        no_external_links_instruction = _zh(
            "\\u9664\\u975e\\u7528\\u6237\\u8981\\u6c42\\uff0c\\u4e0d\\u8981\\u63a8\\u89c6"
            "\\u9891\\u6216\\u5916\\u94fe\\u3002"
        )
        short_answer_instruction = _zh(
            "\\u7528 1 \\u5230 3 \\u53e5\\u4e2d\\u6587\\u76f4\\u63a5\\u4f5c\\u7b54\\u3002"
        )
        light_question_type = _zh("\\u8f7b\\u95ee\\u7b54")
        question_type_label = _zh("\\u95ee\\u9898\\u7c7b\\u578b\\uff1a")
        persona_hint_label = _zh("\\u4eba\\u8bbe\\u63d0\\u793a\\uff1a")
        user_question_label = _zh("\\u7528\\u6237\\u95ee\\u9898\\uff1a")
        system_prompt = (
            f"{persona_meta['learning_prompt']}"
            f"{tone_label}{persona_meta['style']}"
            f"{social_instruction}"
            f"{no_fabrication_instruction}"
            f"{no_external_links_instruction}"
            f"{short_answer_instruction}"
        )

        messages = [
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": (
                    f"{question_type_label}{question_type or light_question_type}\n"
                    f"{persona_hint_label}{social_hint}\n"
                    f"{user_question_label}{question_text}"
                ),
            },
        ]

        try:
            chunks: list[str] = []
            async for chunk in self.llm_client.chat_completion_stream(
                messages=messages,
                temperature=0.6,
                max_tokens=96,
                model="deepseek-v4-flash",
            ):
                chunks.append(chunk)
                await self._emit_answer_chunk(on_answer_chunk, chunk)
            answer_text = "".join(chunks).strip()
            if answer_text:
                return answer_text
        except Exception as exc:
            logger.warning("answer_generator.light_answer_stream_failed", error=repr(exc))

        try:
            response = await asyncio.wait_for(
                self.llm_client.chat_completion(
                    messages=messages,
                    temperature=0.6,
                    max_tokens=96,
                ),
                timeout=self.LIGHT_LLM_TIMEOUT_SECONDS,
            )
            answer_text = (response.choices[0].message.content or "").strip()
            if answer_text:
                return answer_text
        except Exception as exc:
            logger.warning("answer_generator.light_answer_failed", error=repr(exc))
        return self._build_light_emergency_fallback(question_text, question_analysis, persona=persona)

    async def _retrieve_knowledge(
        self,
        question_text: str,
        question_analysis: dict[str, Any],
        course_id: int | None = None,
    ) -> dict[str, Any]:
        async def fetch_rag() -> list[dict[str, Any]]:
            if not course_id:
                return []
            try:
                knowledge_result = await self.rag_service.search(
                    RagSearchRequest(
                        course_code=str(course_id),
                        query=question_text,
                        top_k=self.COURSE_RAG_TOP_K,
                    )
                )
                return [
                    {
                        "content": hit.content,
                        "score": hit.score,
                        "source": hit.metadata.get("source", ""),
                        "doc_id": hit.doc_id,
                    }
                    for hit in knowledge_result.hits[: self.COURSE_RAG_TOP_K]
                ]
            except Exception as exc:
                logger.error(
                    "answer_generator.rag_failed",
                    error=repr(exc),
                    error_type=type(exc).__name__,
                    course_id=course_id,
                )
                return []

        async def fetch_similar_qa() -> list[dict[str, Any]]:
            try:
                pairs = await self._retrieve_similar_qa_pairs(
                    question_text,
                    question_analysis,
                    course_id=course_id,
                )
                return pairs[: self.SIMILAR_QA_LIMIT]
            except Exception as exc:
                logger.error(
                    "answer_generator.similar_qa_failed",
                    error=repr(exc),
                    error_type=type(exc).__name__,
                    course_id=course_id,
                )
                return []

        retrieved_chunks, similar_qa_pairs = await asyncio.gather(
            fetch_rag(),
            fetch_similar_qa(),
        )

        return {
            "retrieved_chunks": retrieved_chunks,
            "similar_qa_pairs": similar_qa_pairs,
        }

    async def _retrieve_similar_qa_pairs(
        self,
        question_text: str,
        question_analysis: dict[str, Any],
        *,
        course_id: int | None = None,
    ) -> list[dict[str, Any]]:
        if not course_id:
            return []

        async with async_session_factory() as session:
            stmt = (
                select(TutoringQuestion, TutoringAnswer)
                .join(TutoringAnswer, TutoringAnswer.question_id == TutoringQuestion.id)
                .where(TutoringQuestion.course_id == course_id, TutoringQuestion.has_answer.is_(True))
                .order_by(TutoringAnswer.create_time.desc())
                .limit(10)
            )
            rows = (await session.execute(stmt)).all()

        if not rows:
            return []

        query_keywords = self._extract_keywords(
            " ".join(
                [
                    question_text,
                    " ".join(str(x) for x in question_analysis.get("knowledge_points", []) if x),
                ]
            )
        )

        scored_pairs: list[dict[str, Any]] = []
        lowered_query = question_text.lower()
        for question, answer in rows:
            candidate_text = str(question.question_text or "").strip()
            answer_text = str(answer.answer_text or "").strip()
            if not candidate_text or not answer_text:
                continue
            if self._is_low_quality_history(candidate_text, answer_text):
                continue

            candidate_keywords = self._extract_keywords(
                " ".join(
                    [
                        candidate_text,
                        " ".join(str(x) for x in (question.knowledge_points or []) if x),
                    ]
                )
            )
            lexical_score = self._keyword_overlap_score(query_keywords, candidate_keywords)
            if lexical_score <= 0 and len(scored_pairs) >= 3:
                continue

            semantic_score = 0.0
            lowered_candidate = candidate_text.lower()
            if lowered_query in lowered_candidate or lowered_candidate in lowered_query:
                semantic_score = 1.0
            elif any(keyword in lowered_candidate for keyword in query_keywords[:4]):
                semantic_score = 0.45

            final_score = round((semantic_score * 0.55 + lexical_score * 0.45), 4)
            if final_score < 0.1:
                continue

            scored_pairs.append(
                {
                    "question_id": question.id,
                    "answer_id": answer.id,
                    "question": candidate_text[:160],
                    "answer_excerpt": answer_text[:220],
                    "score": final_score,
                    "knowledge_points": list(question.knowledge_points or [])[:5],
                }
            )

        scored_pairs.sort(key=lambda item: item["score"], reverse=True)
        return scored_pairs[: self.SIMILAR_QA_LIMIT]

    @staticmethod
    def _is_low_quality_history(question_text: str, answer_text: str) -> bool:
        lowered_question = question_text.lower()
        lowered_answer = answer_text.lower()
        bad_markers = (
            "## current note",
            "stable fallback",
            _zh("\\u5f53\\u524d\\u5b66\\u4e60\\u72b6\\u6001\\u5206\\u6790"),
            _zh("\\u5c1a\\u672a\\u63d0\\u51fa\\u5177\\u4f53\\u95ee\\u9898"),
            "???",
            _zh("\\u672a\\u660e\\u786e\\u4e3b\\u9898"),
        )
        return any(marker in lowered_question or marker in lowered_answer for marker in bad_markers)

    @staticmethod
    def _extract_keywords(text: str) -> list[str]:
        tokens = re.findall(r"[\\u4e00-\\u9fff]{2,}|[A-Za-z][A-Za-z0-9_+-]{2,}", text or "")
        deduped: list[str] = []
        seen: set[str] = set()
        for token in tokens:
            normalized = token.lower()
            if normalized in seen:
                continue
            seen.add(normalized)
            deduped.append(normalized)
        return deduped[:10]

    @staticmethod
    def _keyword_overlap_score(left: list[str], right: list[str]) -> float:
        if not left or not right:
            return 0.0
        left_set = set(left)
        right_set = set(right)
        overlap = left_set & right_set
        return len(overlap) / max(len(left_set), len(right_set), 1)

    async def _generate_learning_answer_text(
        self,
        question_text: str,
        question_analysis: dict[str, Any],
        retrieved_knowledge: dict[str, Any],
        user_profile: dict[str, Any] | None = None,
        persona: str | None = None,
        on_answer_chunk: Callable[[str], Awaitable[None]] | None = None,
    ) -> str:
        _ = user_profile
        context_parts: list[str] = []
        retrieved_chunks = retrieved_knowledge.get("retrieved_chunks", [])
        if retrieved_chunks:
            context_parts.append(_zh("\\u8bfe\\u7a0b\\u53c2\\u8003\\uff1a"))
            for idx, chunk in enumerate(retrieved_chunks[: self.COURSE_RAG_TOP_K], start=1):
                context_parts.append(f"{idx}. {chunk['content'][:160]}")

        similar_qa_pairs = retrieved_knowledge.get("similar_qa_pairs", [])
        if similar_qa_pairs:
            question_label = _zh("\\u95ee\\u9898\\uff1a")
            history_answer_label = _zh("\\u5386\\u53f2\\u7b54\\u6848\\u6458\\u8981\\uff1a")
            similarity_label = _zh("\\u76f8\\u4f3c\\u5ea6\\uff1a")
            context_parts.append(_zh("\\u5386\\u53f2\\u76f8\\u4f3c\\u95ee\\u7b54\\uff1a"))
            for idx, pair in enumerate(similar_qa_pairs[: self.SIMILAR_QA_LIMIT], start=1):
                context_parts.append(
                    f"{idx}. {question_label}{pair['question']}\n"
                    f"   {history_answer_label}{pair['answer_excerpt'][:120]}\n"
                    f"   {similarity_label}{pair['score']}"
                )

        context = "\\n\\n".join(context_parts) if context_parts else _zh("\\u6682\\u65e0\\u53ef\\u76f4\\u63a5\\u5f15\\u7528\\u7684\\u8bfe\\u7a0b\\u53c2\\u8003\\u3002")
        knowledge_points = ", ".join(question_analysis.get("knowledge_points", []) or []) or _zh("\\u672a\\u8bc6\\u522b")
        question_type = question_analysis.get("question_type") or _zh("\\u7efc\\u5408\\u95ee\\u7b54")
        difficulty = question_analysis.get("difficulty_level") or 2
        persona_meta = self._persona_meta(persona)

        answer_requirements_label = _zh("\\u56de\\u7b54\\u8981\\u6c42\\uff1a")
        direct_answer_rule = _zh(
            "\\u5148\\u76f4\\u63a5\\u56de\\u7b54\\u7528\\u6237\\u771f\\u6b63\\u95ee\\u7684"
            "\\u95ee\\u9898\\uff0c\\u4e0d\\u8981\\u5148\\u94fa\\u57ab\\u5e9f\\u8bdd\\u3002"
        )
        persona_style_label = _zh("\\u8bed\\u6c14\\u8981\\u7b26\\u5408\\u5f53\\u524d\\u4eba\\u8bbe\\uff1a")
        persona_style_rule_suffix = _zh(
            " \\u540c\\u65f6\\u4fdd\\u6301\\u81ea\\u7136\\uff0c\\u50cf\\u771f\\u4eba\\u5728"
            "\\u56de\\u7b54\\uff0c\\u4e0d\\u50cf\\u7cfb\\u7edf\\u6a21\\u677f\\u3002"
        )
        no_fixed_sections_rule = _zh(
            "\\u4e0d\\u8981\\u4f7f\\u7528\\u201c\\u6838\\u5fc3\\u7ed3\\u8bba / \\u8be6\\u7ec6"
            "\\u89e3\\u6790 / \\u603b\\u7ed3\\u201d\\u8fd9\\u7c7b\\u56fa\\u5b9a\\u680f\\u76ee\\u3002"
        )
        no_process_mentions_rule = _zh(
            "\\u4e0d\\u8981\\u63d0\\u5230\\u63d0\\u793a\\u8bcd\\u3001\\u68c0\\u7d22\\u3001"
            "\\u6d41\\u7a0b\\u3001\\u6a21\\u578b\\u3001\\u5de5\\u4f5c\\u6d41\\u3002"
        )
        no_resource_push_rule = _zh(
            "\\u9664\\u975e\\u7528\\u6237\\u660e\\u786e\\u8981\\u6c42\\u8d44\\u6e90\\uff0c"
            "\\u5426\\u5219\\u4e0d\\u8981\\u63a8\\u8350\\u89c6\\u9891\\u3001\\u8bfe\\u7a0b"
            "\\u6216\\u5916\\u94fe\\u3002"
        )
        compare_concepts_rule = _zh(
            "\\u5982\\u679c\\u662f\\u6982\\u5ff5\\u5bf9\\u6bd4\\u9898\\uff0c\\u5148\\u8bb2"
            "\\u672c\\u8d28\\u533a\\u522b\\uff0c\\u518d\\u8865 2 \\u5230 3 \\u4e2a\\u5173\\u952e"
            "\\u70b9\\u3002"
        )
        low_context_rule = _zh(
            "\\u5982\\u679c\\u53c2\\u8003\\u8d44\\u6599\\u4e0d\\u8db3\\uff0c\\u4e5f\\u8981"
            "\\u5148\\u57fa\\u4e8e\\u5e38\\u8bc6\\u7ed9\\u51fa\\u5c3d\\u91cf\\u9760\\u8c31\\u7684"
            "\\u56de\\u7b54\\uff0c\\u4e0d\\u8981\\u6577\\u884d\\u3002"
        )
        answer_length_rule = _zh(
            "\\u63a7\\u5236\\u5728 120 \\u5230 260 \\u5b57\\uff0c\\u5fc5\\u8981\\u65f6"
            "\\u53ef\\u4ee5\\u66f4\\u77ed\\uff0c\\u4f46\\u4e0d\\u8981\\u7a7a\\u6cdb\\u3002"
        )
        user_question_label = _zh("\\u7528\\u6237\\u95ee\\u9898\\uff1a")
        analysis_label = _zh("\\u95ee\\u9898\\u5206\\u6790\\uff1a")
        type_label = _zh("\\u7c7b\\u578b\\uff1a")
        knowledge_points_label = _zh("\\u77e5\\u8bc6\\u70b9\\uff1a")
        difficulty_label = _zh("\\u96be\\u5ea6\\uff1a")
        reference_info_label = _zh("\\u53c2\\u8003\\u4fe1\\u606f\\uff1a")
        final_answer_instruction = _zh("\\u73b0\\u5728\\u76f4\\u63a5\\u7ed9\\u51fa\\u6700\\u7ec8\\u56de\\u7b54\\u3002")
        prompt = (
            f"{persona_meta['learning_prompt']}\n\n"
            f"{answer_requirements_label}\n"
            f"1. {direct_answer_rule}\n"
            f"2. {persona_style_label}{persona_meta['style']}{persona_style_rule_suffix}\n"
            f"3. {no_fixed_sections_rule}\n"
            f"4. {no_process_mentions_rule}\n"
            f"5. {no_resource_push_rule}\n"
            f"6. {compare_concepts_rule}\n"
            f"7. {low_context_rule}\n"
            f"8. {answer_length_rule}\n\n"
            f"{user_question_label}{question_text}\n\n"
            f"{analysis_label}\n"
            f"- {type_label}{question_type}\n"
            f"- {knowledge_points_label}{knowledge_points}\n"
            f"- {difficulty_label}{difficulty}\n\n"
            f"{reference_info_label}\n{context}\n\n"
            f"{final_answer_instruction}"
        )

        try:
            chunks: list[str] = []
            async for chunk in self.llm_client.chat_completion_stream(
                messages=[{"role": "user", "content": prompt}],
                temperature=0.45,
                max_tokens=420,
            ):
                chunks.append(chunk)
                await self._emit_answer_chunk(on_answer_chunk, chunk)
            answer_text = "".join(chunks).strip()
            if answer_text:
                return answer_text
        except Exception as exc:
            logger.warning("answer_generator.learning_answer_stream_failed", error=repr(exc))

        try:
            response = await asyncio.wait_for(
                self.llm_client.chat_completion(
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.45,
                    max_tokens=420,
                ),
                timeout=self.LLM_STEP_TIMEOUT_SECONDS,
            )
            answer_text = (response.choices[0].message.content or "").strip()
            if not answer_text:
                answer_text = _zh("\\u8fd9\\u6b21\\u56de\\u7b54\\u6ca1\\u6210\\u578b\\u3002\\u4f60\\u628a\\u95ee\\u9898\\u518d\\u5177\\u4f53\\u4e00\\u70b9\\uff0c\\u6211\\u7ee7\\u7eed\\u7ed9\\u4f60\\u62c6\\u3002")
            return answer_text
        except asyncio.TimeoutError:
            logger.error(
                "answer_generator.timeout",
                timeout_seconds=self.LLM_STEP_TIMEOUT_SECONDS,
                question_preview=question_text[:80],
            )
            return self._build_fallback_answer(question_text, question_analysis, retrieved_knowledge, persona=persona)
        except Exception as exc:
            logger.error(
                "answer_generator.failed",
                error=repr(exc),
                error_type=type(exc).__name__,
                question_preview=question_text[:80],
            )
            return self._build_fallback_answer(question_text, question_analysis, retrieved_knowledge, persona=persona)

    def _build_fallback_answer(
        self,
        question_text: str,
        question_analysis: dict[str, Any],
        retrieved_knowledge: dict[str, Any],
        user_profile: dict[str, Any] | None = None,
        persona: str | None = None,
    ) -> str:
        _ = retrieved_knowledge
        _ = user_profile
        persona_meta = self._persona_meta(persona)
        if self._is_greeting(question_text):
            return persona_meta["greeting"]
        if self._is_identity_question(question_text, question_analysis):
            return persona_meta["identity"]
        if self._is_capability_question(question_text, question_analysis):
            return persona_meta["capability"]
        if (
            self._is_social_chat(question_analysis)
            or self._looks_like_social_text(question_text)
            or self._detect_social_topic(question_text) != "general_social"
        ):
            return self._build_persona_social_fallback(question_text, persona=persona)
        if self._is_utility_question(question_analysis):
            now = datetime.now()
            return _zh("\\u73b0\\u5728\\u662f ") + now.strftime("%Y-%m-%d %H:%M") + _zh("\\u3002")
        if self._wants_video_recommendation(question_text):
            return _zh("\\u6211\\u7ed9\\u4f60\\u653e\\u51e0\\u6761\\u76f8\\u5173\\u89c6\\u9891\\u5728\\u4e0b\\u9762\\u3002\\u5148\\u770b\\u6807\\u9898\\u6700\\u8d34\\u8fd1\\u5f53\\u524d\\u95ee\\u9898\\u7684\\u90a3\\u6761\\uff0c\\u522b\\u4e00\\u53e3\\u6c14\\u5168\\u541e\\uff0c\\u5b66\\u4e60\\u89c6\\u9891\\u770b\\u591a\\u4e86\\u4e5f\\u4f1a\\u53d8\\u6210\\u566a\\u97f3\\u3002")

        lowered_question = question_text.lower()
        if any(token in lowered_question for token in ("requirements", "design")) or any(
            token in question_text for token in (_zh("\\u9700\\u6c42\\u5206\\u6790"), _zh("\\u6982\\u8981\\u8bbe\\u8ba1"))
        ):
            return (
                _zh("\\u672c\\u8d28\\u533a\\u522b\\u5c31\\u4e00\\u53e5\\u8bdd\\uff1a\\u9700\\u6c42\\u5206\\u6790\\u662f\\u5728\\u56de\\u7b54\\u2018\\u7cfb\\u7edf\\u8981\\u505a\\u4ec0\\u4e48\\u2019\\uff0c\\u6982\\u8981\\u8bbe\\u8ba1\\u662f\\u5728\\u56de\\u7b54\\u2018\\u7cfb\\u7edf\\u51c6\\u5907\\u600e\\u4e48\\u505a\\u2019\\u3002")
                + _zh("\\u524d\\u8005\\u5173\\u6ce8\\u4e1a\\u52a1\\u76ee\\u6807\\u3001\\u7528\\u6237\\u573a\\u666f\\u548c\\u529f\\u80fd\\u8fb9\\u754c\\uff1b\\u540e\\u8005\\u5173\\u6ce8\\u6a21\\u5757\\u5212\\u5206\\u3001\\u7cfb\\u7edf\\u7ed3\\u6784\\u3001\\u63a5\\u53e3\\u5173\\u7cfb\\u548c\\u5173\\u952e\\u6280\\u672f\\u9009\\u578b\\u3002")
                + _zh("\\u987a\\u5e8f\\u4e0d\\u80fd\\u53cd\\uff0c\\u9700\\u6c42\\u6ca1\\u8bb2\\u6e05\\uff0c\\u540e\\u9762\\u7684\\u8bbe\\u8ba1\\u5927\\u6982\\u7387\\u4f1a\\u8fd4\\u5de5\\u3002")
            )

        knowledge_points = [str(x) for x in question_analysis.get("knowledge_points", []) if x]
        if knowledge_points:
            joined = _zh("\\u3001").join(knowledge_points[:3])
            return _zh("\\u8fd9\\u4e2a\\u95ee\\u9898\\u53ef\\u4ee5\\u5148\\u6293\\u4f4f ") + joined + _zh(" \\u8fd9\\u51e0\\u4e2a\\u70b9\\u6765\\u7406\\u89e3\\uff1a\\u5148\\u770b\\u5b83\\u89e3\\u51b3\\u4ec0\\u4e48\\u95ee\\u9898\\uff0c\\u518d\\u770b\\u5b83\\u548c\\u76f8\\u8fd1\\u6982\\u5ff5\\u7684\\u533a\\u522b\\uff0c\\u6700\\u540e\\u770b\\u5178\\u578b\\u4f7f\\u7528\\u573a\\u666f\\u3002\\u4f60\\u5982\\u679c\\u613f\\u610f\\uff0c\\u6211\\u53ef\\u4ee5\\u7ee7\\u7eed\\u5f80\\u4e0b\\u5c55\\u5f00\\u3002")

        return _zh("\\u8fd9\\u4e2a\\u95ee\\u9898\\u80fd\\u7b54\\uff0c\\u4f46\\u4f60\\u73b0\\u5728\\u95ee\\u5f97\\u8fd8\\u6709\\u70b9\\u6cdb\\u3002\\u4f60\\u628a\\u573a\\u666f\\u3001\\u6982\\u5ff5\\u540d\\u6216\\u8005\\u9898\\u76ee\\u539f\\u6587\\u8865\\u51fa\\u6765\\uff0c\\u6211\\u53ef\\u4ee5\\u76f4\\u63a5\\u7ed9\\u4f60\\u6210\\u578b\\u7b54\\u6848\\u3002")

    def _extract_reference_sources(self, retrieved_knowledge: dict[str, Any]) -> list[dict[str, Any]]:
        sources: list[dict[str, Any]] = []
        for chunk in retrieved_knowledge.get("retrieved_chunks", []):
            sources.append(
                {
                    "source_type": "course",
                    "title": chunk.get("source", _zh("\\u8bfe\\u7a0b\\u8d44\\u6599")),
                    "url": None,
                    "excerpt": chunk.get("content", "")[:200],
                    "relevance_score": chunk.get("score", 0.0),
                }
            )
        for pair in retrieved_knowledge.get("similar_qa_pairs", []):
            similar_qa_title_prefix = _zh("\\u5386\\u53f2\\u76f8\\u4f3c\\u95ee\\u7b54 #")
            sources.append(
                {
                    "source_type": "similar_qa",
                    "title": f"{similar_qa_title_prefix}{pair.get('question_id')}",
                    "url": None,
                    "excerpt": pair.get("answer_excerpt", ""),
                    "relevance_score": pair.get("score", 0.0),
                }
            )
        return sources

    async def _evaluate_confidence(
        self,
        question_text: str,
        answer_text: str,
        retrieved_knowledge: dict[str, Any],
        question_analysis: dict[str, Any],
    ) -> float:
        if self._is_greeting(question_text):
            return 92.0
        if str(question_analysis.get("question_type") or "") in self.LIGHT_TYPES:
            return 94.0
        base_confidence = 58.0
        retrieved_chunks = retrieved_knowledge.get("retrieved_chunks", [])
        if retrieved_chunks:
            avg_score = sum(chunk.get("score", 0) for chunk in retrieved_chunks) / len(retrieved_chunks)
            base_confidence += avg_score * 18
        else:
            base_confidence -= 8
        similar_qa_pairs = retrieved_knowledge.get("similar_qa_pairs", [])
        if similar_qa_pairs:
            avg_similar_score = sum(pair.get("score", 0) for pair in similar_qa_pairs) / len(similar_qa_pairs)
            base_confidence += avg_similar_score * 8
        answer_length = len(answer_text)
        if answer_length < 30:
            base_confidence -= 12
        elif answer_length > 500:
            base_confidence -= 6
        confidence = max(0.0, min(100.0, base_confidence))
        return round(confidence, 2)


async def answer_generator_node(state: dict[str, Any]) -> dict[str, Any]:
    """LangGraph node wrapper for answer generation."""

    agent = AnswerGeneratorAgent()
    question_text = state.get("question_text", "")
    question_analysis = state.get("question_analysis", {})
    user_profile = state.get("user_profile")
    course_id = state.get("course_id")
    persona = state.get("persona")
    answer_result = await agent.generate_answer(
        question_text,
        question_analysis,
        user_profile,
        course_id,
        persona=persona,
    )
    state["answer_result"] = answer_result
    trace = state.get("execution_trace", [])
    trace.append(f"answer_generator:confidence={answer_result.get('confidence_score')}")
    state["execution_trace"] = trace
    return state
