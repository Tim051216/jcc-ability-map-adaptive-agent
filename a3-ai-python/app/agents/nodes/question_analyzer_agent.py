"""
Question analyzer agent.
Responsible for understanding, classifying, and expanding tutoring questions.
"""

from __future__ import annotations

import asyncio
import base64
import re
from typing import Any

import httpx

from app.core.logging import logger
from app.integrations.llm.client import get_llm_client
from app.schemas.rag import RagSearchRequest
from app.services.rag_service import RagService
from app.services.tutoring_ocr_service import extract_text_from_base64_image


def _zh(value: str) -> str:
    return value.encode("ascii").decode("unicode_escape")


class QuestionAnalyzerAgent:
    """Analyze tutoring questions before answer generation."""

    LLM_STEP_TIMEOUT_SECONDS = 4.5
    COURSE_QUESTION_HINT_PATTERNS: tuple[str, ...] = (
        _zh(r"\u4ec0\u4e48\u662f"),
        _zh(r"\u4e3a\u4ec0\u4e48"),
        _zh(r"\u600e\u4e48"),
        _zh(r"\u5982\u4f55"),
        _zh(r"\u533a\u522b"),
        _zh(r"\u5173\u7cfb"),
        _zh(r"\u4f5c\u7528"),
        _zh(r"\u539f\u7406"),
        _zh(r"\u6d41\u7a0b"),
        _zh(r"\u6b65\u9aa4"),
        _zh(r"\u4f8b\u5b50"),
        _zh(r"\u7b97\u6cd5"),
        _zh(r"\u516c\u5f0f"),
        _zh(r"\u4ee3\u7801"),
        _zh(r"\u51fd\u6570"),
        _zh(r"\u6570\u636e\u5e93"),
        _zh(r"\u7f51\u7edc"),
        _zh(r"\u8f6f\u4ef6"),
        _zh(r"\u6d4b\u8bd5"),
        _zh(r"\u56de\u5f52\u6d4b\u8bd5"),
        _zh(r"\u9700\u6c42\u5206\u6790"),
        _zh(r"\u6982\u8981\u8bbe\u8ba1"),
    )

    _LIGHT_INTENT_TO_RESULT: dict[str, dict[str, Any]] = {
        "greeting": {
            "intent": "日常交流",
            "core_concept": "基础问候",
            "specific_confusion": "用户在进行轻量寒暄或确认导师是否在线。",
            "question_type": "日常交流",
            "knowledge_points": ["基础问候"],
        },
        "identity": {
            "intent": "身份问答",
            "core_concept": "导师身份",
            "specific_confusion": "用户想确认导师是谁、是什么角色。",
            "question_type": "身份问答",
            "knowledge_points": ["导师身份"],
        },
        "capability": {
            "intent": "能力问答",
            "core_concept": "导师能力",
            "specific_confusion": "用户想了解导师能提供哪些帮助。",
            "question_type": "能力问答",
            "knowledge_points": ["导师能力"],
        },
        "meta": {
            "intent": "元对话",
            "core_concept": "对话方式",
            "specific_confusion": "用户在询问回答风格、工作方式或系统行为。",
            "question_type": "元对话",
            "knowledge_points": ["对话方式"],
        },
        "social": {
            "intent": "闲聊陪伴",
            "core_concept": "自然闲聊",
            "specific_confusion": "用户在闲聊、表达情绪，或希望导师像真人一样接话。",
            "question_type": "闲聊陪伴",
            "knowledge_points": ["自然闲聊"],
        },
        "utility": {
            "intent": "通用问答",
            "core_concept": "通用事务",
            "specific_confusion": "用户在询问时间、日期或简单事务，不属于课程知识问答。",
            "question_type": "通用问答",
            "knowledge_points": ["通用事务"],
        },
    }

    def __init__(self) -> None:
        self.llm_client = get_llm_client()
        self.rag_service = RagService()

    @staticmethod
    def _normalize(text: str) -> str:
        value = (text or "").strip().lower()
        return re.sub(r"\s+", "", value)

    @classmethod
    def _is_small_talk(cls, question_text: str) -> bool:
        normalized = cls._normalize(question_text)
        return normalized in {
            "你好",
            "您好",
            "hello",
            "hi",
            "嗨",
            "哈喽",
            "在吗",
            "在嘛",
            "老师好",
        }

    @classmethod
    def _is_identity_question(cls, question_text: str) -> bool:
        normalized = cls._normalize(question_text)
        if normalized in {
            "你是谁",
            "你叫什么",
            "你叫什么名字",
            "你是干嘛的",
            "你是不是ai",
            "你是真的吗",
            "介绍一下你自己",
            "你是灰原哀吗",
            "你多大了",
        }:
            return True
        identity_patterns = (
            r"^你是谁[啊呢呀吗]?$",
            r"^你叫什么(名字)?[啊呢呀吗]?$",
            r"^你是干嘛的[啊呢呀吗]?$",
            r"^你是不是ai[啊呢呀吗]?$",
            r"^你是真的吗[啊呢呀吗]?$",
            r"^介绍(一下)?你自己[啊呢呀吗]?$",
            r"^你是灰原哀吗$",
            r"^你多大了[啊呢呀吗]?$",
        )
        return any(re.search(pattern, normalized) for pattern in identity_patterns)

    @classmethod
    def _is_persona_relationship_question(cls, question_text: str) -> bool:
        normalized = cls._normalize(question_text)
        patterns = (
            _zh(
                r"(\u4f60\u7684\u59d0\u59d0\u662f\u8c01|\u4f60\u6709\u59d0\u59d0\u5417|"
                r"\u4f60\u59d0\u59d0\u662f\u8c01|\u4f60\u7684\u54e5\u54e5\u662f\u8c01|"
                r"\u4f60\u6709\u54e5\u54e5\u5417|\u4f60\u54e5\u54e5\u662f\u8c01|"
                r"\u4f60\u7684\u59b9\u59b9\u662f\u8c01|\u4f60\u6709\u59b9\u59b9\u5417|"
                r"\u4f60\u7684\u5f1f\u5f1f\u662f\u8c01|\u4f60\u6709\u5f1f\u5f1f\u5417|"
                r"\u4f60\u7684\u5bb6\u4eba\u662f\u8c01|\u4f60\u5bb6\u91cc\u8fd8\u6709\u8c01|"
                r"\u4f60\u7684\u5bb6\u4eba\u90fd\u6709\u8c01|\u4f60\u7684\u4eb2\u4eba\u662f\u8c01|"
                r"\u4f60\u548c\u8c01\u662f\u4e00\u5bb6\u4eba)"
            ),
        )
        return any(re.search(pattern, normalized) for pattern in patterns)

    @classmethod
    def _is_capability_question(cls, question_text: str) -> bool:
        normalized = cls._normalize(question_text)
        return bool(
            re.search(
                r"你.*(能做什么|可以做什么|可以干什么|会什么|会做什么|能帮我做什么|能帮什么)",
                normalized,
            )
        )

    @classmethod
    def _is_meta_question(cls, question_text: str) -> bool:
        normalized = cls._normalize(question_text)
        return bool(
            re.search(
                r"(你写的提示词|提示词|你怎么回答|为什么回答这么慢|是不是降级|是不是真实模型|你怎么工作的|你的风格)",
                normalized,
            )
        )

    @classmethod
    def _is_social_chat(cls, question_text: str) -> bool:
        normalized = cls._normalize(question_text)
        if cls._is_persona_relationship_question(question_text):
            return True
        return bool(
            re.search(
                r"(陪我聊聊|聊聊天|我有点烦|我有点紧张|有点焦虑|有点难受|你会不会无聊|你觉得呢|你说呢|我是不是很笨|我能学会吗|安慰我|鼓励我|夸夸我|今天好累|不想学了|想摆烂|你最好的朋友是谁|你喜欢什么|你平时都在干嘛|你平时干嘛|你平时喜欢什么|你会做梦吗|你会生气吗|你会难过吗|你最在意谁|你和柯南关系怎么样|你喜欢柯南吗)",
                normalized,
            )
        )

    @classmethod
    def _is_utility_question(cls, question_text: str) -> bool:
        normalized = cls._normalize(question_text)
        return bool(
            re.search(
                r"(现在几点|几点了|今天几号|今天星期几|当前时间|日期是多少|北京时间)",
                normalized,
            )
        )

    @classmethod
    def _looks_like_course_question(cls, question_text: str) -> bool:
        normalized = cls._normalize(question_text)
        if not normalized:
            return False
        if len(normalized) >= 18:
            return True
        if any(token in (question_text or "") for token in cls.COURSE_QUESTION_HINT_PATTERNS):
            return True
        if re.search(r"[A-Za-z_]{3,}\s*\(", question_text or ""):
            return True
        if re.search(r"[=><+\-/*]", question_text or ""):
            return True
        if re.search(r"\d{2,}", question_text or ""):
            return True
        return False

    async def analyze_question(
        self,
        question_text: str,
        question_images: list[str] | None = None,
        course_id: int | None = None,
    ) -> dict[str, Any]:
        logger.info(
            "question_analyzer.start",
            question_length=len(question_text or ""),
            image_count=len(question_images or []),
            course_id=course_id,
        )

        if not question_images and not self._looks_like_course_question(question_text):
            light_intent = await self._classify_light_conversation_intent(question_text)
            if light_intent in self._LIGHT_INTENT_TO_RESULT:
                result = self._build_light_intent_result(light_intent)
                logger.info(
                    "question_analyzer.completed",
                    question_type=result.get("question_type"),
                    difficulty_level=result.get("difficulty_level"),
                    knowledge_points=result.get("knowledge_points"),
                    mode="light_intent",
                )
                return result

        image_context = await self._extract_image_context(question_images)
        effective_question_text = self._build_effective_question_text(question_text, image_context)

        understanding = self._heuristic_understanding(effective_question_text, question_images)
        classification = self._heuristic_classification(effective_question_text, understanding)
        expansion = await self._expand_question_fast(effective_question_text, classification, course_id)

        result = {
            **understanding,
            **classification,
            **expansion,
            "image_context": image_context,
        }

        logger.info(
            "question_analyzer.completed",
            question_type=result.get("question_type"),
            difficulty_level=result.get("difficulty_level"),
            knowledge_points=result.get("knowledge_points"),
            mode="fast_heuristic",
        )
        return result

    async def _classify_light_conversation_intent(self, question_text: str) -> str | None:
        normalized = self._normalize(question_text)
        if not normalized:
            return None
        if self._looks_like_course_question(question_text):
            return None

        if self._is_small_talk(question_text):
            return "greeting"
        if self._is_identity_question(question_text):
            return "identity"
        if self._is_capability_question(question_text):
            return "capability"
        if self._is_meta_question(question_text):
            return "meta"
        if self._is_social_chat(question_text):
            return "social"
        if self._is_utility_question(question_text):
            return "utility"
        if len(normalized) <= 14 and ("你" in question_text or "吗" in question_text or "呢" in question_text):
            return "social"
        # 首 token 优先：轻问句意图判断完全走本地规则，避免再额外等待一轮模型分类。
        if len(normalized) <= 24 and any(token in question_text for token in ("你", "姐姐", "朋友", "喜欢", "会不会", "为什么")):
            return "social"
        if len(normalized) <= 24 and any(token in question_text for token in ("几点", "几号", "日期", "星期", "时间")):
            return "utility"
        return None

    @classmethod
    def _build_light_intent_result(cls, light_intent: str) -> dict[str, Any]:
        mapping = cls._LIGHT_INTENT_TO_RESULT[light_intent]
        return {
            **mapping,
            "has_code": False,
            "has_formula": False,
            "language": "zh",
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

    async def _expand_question_fast(
        self,
        question_text: str,
        classification: dict[str, Any],
        course_id: int | None = None,
    ) -> dict[str, Any]:
        result = self._heuristic_expansion(classification)
        result["similar_questions"] = []
        return result

    async def _extract_image_context(self, question_images: list[str] | None = None) -> dict[str, Any]:
        result = {
            "image_count": len(question_images or []),
            "combined_text": "",
            "ocr_texts": [],
            "visual_hints": [],
        }
        if not question_images:
            return result

        combined_parts: list[str] = []
        hint_set: set[str] = set()
        for index, url in enumerate(question_images[:3], start=1):
            try:
                text, hints = await self._extract_text_from_image_source(url)
            except Exception as exc:
                logger.warning("question_analyzer.image_context_failed", url=url, error=str(exc))
                text, hints = "", ["unreadable"]

            cleaned = re.sub(r"\s+", " ", text or "").strip()
            if cleaned:
                combined_parts.append(f"图片{index}: {cleaned[:400]}")
            hint_set.update(hints)
            result["ocr_texts"].append(
                {
                    "url": url,
                    "text": cleaned[:500],
                    "visual_hints": hints,
                }
            )

        result["combined_text"] = "\n".join(combined_parts)
        result["visual_hints"] = sorted(hint_set)
        return result

    async def _extract_text_from_image_source(self, image_source: str) -> tuple[str, list[str]]:
        if not image_source:
            return "", []

        if image_source.startswith("data:"):
            text, _, _ = extract_text_from_base64_image(image_source)
            return text, self._infer_visual_hints(text)

        timeout = httpx.Timeout(6.0, connect=3.0)
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
            response = await client.get(image_source)
            response.raise_for_status()

        content_type = response.headers.get("content-type", "image/png").split(";", 1)[0].strip() or "image/png"
        image_base64 = base64.b64encode(response.content).decode("ascii")
        text, _, _ = extract_text_from_base64_image(f"data:{content_type};base64,{image_base64}")
        return text, self._infer_visual_hints(text)

    @staticmethod
    def _build_effective_question_text(question_text: str, image_context: dict[str, Any]) -> str:
        combined_text = str(image_context.get("combined_text") or "").strip()
        if not combined_text:
            return question_text
        return f"{question_text}\n\n[图片 OCR 内容]\n{combined_text}"

    @staticmethod
    def _infer_visual_hints(text: str) -> list[str]:
        hints: list[str] = []
        if any(token in text for token in ("def ", "class ", "{", "}", "Exception", "import ")):
            hints.append("code")
        if any(token in text for token in ("=", "+", "-", "*", "/", "sin", "cos", "log", "y=")):
            hints.append("formula")
        if any(token in text for token in ("流程", "步骤", "开始", "结束", "判断")):
            hints.append("diagram")
        if any(token in text for token in ("表", "列", "accuracy", "loss")):
            hints.append("table_or_chart")
        return hints

    @staticmethod
    def _extract_keywords(text: str) -> list[str]:
        parts = re.findall(r"[\u4e00-\u9fff]{2,}|[A-Za-z][A-Za-z0-9_-]{2,}", text or "")
        seen: set[str] = set()
        out: list[str] = []
        for part in parts:
            lowered = part.lower()
            if lowered in seen:
                continue
            seen.add(lowered)
            out.append(part)
            if len(out) >= 5:
                break
        return out

    def _heuristic_understanding(
        self,
        question_text: str,
        question_images: list[str] | None = None,
    ) -> dict[str, Any]:
        keywords = self._extract_keywords(question_text)
        has_code = any(token in question_text for token in ("def ", "class ", "public ", "Exception", "{", "}"))
        has_formula = any(token in question_text for token in ("=", "+", "-", "*", "/", "公式", "求", "证明"))
        intent = "代码调试" if has_code else "概念理解"
        if any(word in question_text for word in ("怎么", "如何", "步骤", "方法")):
            intent = "解题方法"
        return {
            "intent": intent,
            "core_concept": (keywords[0] if keywords else question_text[:30]) or "未知主题",
            "specific_confusion": "需要围绕题干中的核心概念与提问方式进一步解释。",
            "has_code": has_code,
            "has_formula": has_formula,
            "language": "zh",
            "image_count": len(question_images or []),
        }

    def _heuristic_classification(self, question_text: str, understanding: dict[str, Any]) -> dict[str, Any]:
        keywords = self._extract_keywords(question_text)
        question_type = "代码调试" if understanding.get("has_code") else "概念理解"
        if any(word in question_text for word in ("如何", "怎么", "步骤", "方法")):
            question_type = "解题方法"
        difficulty = 3 if len(question_text) > 80 else 2
        return {
            "question_type": question_type,
            "knowledge_points": keywords or [understanding.get("core_concept", "未知主题")],
            "difficulty_level": difficulty,
            "subject_area": "编程" if understanding.get("has_code") else "通用课程",
            "requires_calculation": bool(understanding.get("has_formula")),
            "requires_reasoning": True,
        }

    @staticmethod
    def _heuristic_expansion(classification: dict[str, Any]) -> dict[str, Any]:
        points = [str(x) for x in classification.get("knowledge_points", []) if x]
        if points:
            expanded_context = f"可优先围绕 {' / '.join(points[:3])} 建立定义、区别和场景理解。"
        else:
            expanded_context = "建议先从定义、特点和应用场景三个角度理解当前问题。"
        return {
            "expanded_context": expanded_context,
            "related_concepts": points[1:4],
            "similar_questions": [],
        }


async def question_analyzer_node(state: dict[str, Any]) -> dict[str, Any]:
    """LangGraph node wrapper for question analysis."""

    agent = QuestionAnalyzerAgent()

    question_text = state.get("question_text", "")
    question_images = state.get("question_images")
    course_id = state.get("course_id")

    analysis = await agent.analyze_question(question_text, question_images, course_id)

    state["question_analysis"] = analysis

    trace = state.get("execution_trace", [])
    trace.append(f"question_analyzer:type={analysis.get('question_type')}")
    state["execution_trace"] = trace

    return state
