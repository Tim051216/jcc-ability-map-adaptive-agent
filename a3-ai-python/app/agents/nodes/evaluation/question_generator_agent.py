"""Question generation agent."""

from __future__ import annotations

import asyncio
import json
import re
from typing import Any

from app.agents.state import LearningAgentState
from app.core.logging import logger
from app.integrations.llm.client import get_llm_client


QUESTION_GENERATION_TIMEOUT_SECONDS = 18


def _sanitize_text(text: str) -> str:
    """Remove characters that frequently break parsing or console encoding."""
    if not text:
        return ""

    sanitized_chars: list[str] = []
    for char in text:
        code = ord(char)
        if char in "\n\r\t":
            sanitized_chars.append(char)
            continue
        if code < 32:
            continue
        if 0xE000 <= code <= 0xF8FF:
            continue
        sanitized_chars.append(char)
    return "".join(sanitized_chars)


def _extract_json_array(text: str) -> str:
    if "```json" in text:
        return text.split("```json", 1)[1].split("```", 1)[0].strip()
    if "```" in text:
        fenced = text.split("```", 1)[1]
        return fenced.split("```", 1)[0].strip()

    start = text.find("[")
    end = text.rfind("]")
    if start == -1 or end == -1 or end < start:
        return ""
    return text[start : end + 1]


def _strip_json_comments(text: str) -> str:
    return re.sub(r"//.*?$", "", text, flags=re.MULTILINE)


def _normalize_options(question_type: int, options: Any) -> list[dict[str, str]]:
    if question_type == 3 and not options:
        return [{"key": "A", "value": "正确"}, {"key": "B", "value": "错误"}]

    normalized: list[dict[str, str]] = []
    if isinstance(options, list):
        for index, option in enumerate(options):
            key = chr(ord("A") + index)
            value = ""
            if isinstance(option, dict):
                key = str(option.get("key") or key)
                value = str(option.get("value") or "")
            else:
                value = str(option)
            if value:
                normalized.append({"key": key, "value": value})
    return normalized


def _build_fallback_question(
    *,
    knowledge_point: str,
    difficulty_level: int,
    question_type: int,
    index: int,
) -> dict[str, Any]:
    if question_type == 1:
        options = [
            {"key": "A", "value": f"{knowledge_point}的核心概念"},
            {"key": "B", "value": f"{knowledge_point}的无关概念"},
            {"key": "C", "value": f"{knowledge_point}的错误示例"},
            {"key": "D", "value": f"{knowledge_point}的边缘现象"},
        ]
        correct_answer = "A"
    elif question_type == 2:
        options = [
            {"key": "A", "value": f"{knowledge_point}的定义"},
            {"key": "B", "value": f"{knowledge_point}的应用场景"},
            {"key": "C", "value": f"{knowledge_point}的常见误区"},
            {"key": "D", "value": f"{knowledge_point}的实现方式"},
        ]
        correct_answer = "A,B,D"
    elif question_type == 3:
        options = [{"key": "A", "value": "正确"}, {"key": "B", "value": "错误"}]
        correct_answer = "A"
    else:
        options = []
        correct_answer = knowledge_point

    content_prefix = {
        1: "下列关于",
        2: "关于",
        3: "判断正误：",
        4: "请填空：",
        5: "请简述",
        6: "请编写代码说明",
    }.get(question_type, "请说明")

    return {
        "question_content": f"{content_prefix}{knowledge_point}的第{index}个基础问题。",
        "question_options": options,
        "correct_answer": correct_answer,
        "answer_analysis": f"这道题围绕{knowledge_point}的核心概念设计，用于覆盖基础掌握情况。",
        "knowledge_point": knowledge_point,
        "difficulty_reasoning": f"该题按照难度级别{difficulty_level}生成。",
        "question_type": question_type,
        "difficulty_level": difficulty_level,
        "quality_score": 0.6,
        "_fallback_used": True,
    }


def _is_question_relevant(question: dict[str, Any], knowledge_point: str) -> bool:
    expected = knowledge_point.strip().lower()
    if not expected:
        return True

    haystack = " ".join(
        [
            str(question.get("question_content", "")),
            str(question.get("answer_analysis", "")),
            str(question.get("difficulty_reasoning", "")),
        ]
    ).lower()
    return expected in haystack


def _distribute_question_counts(knowledge_points: list[str], total_count: int) -> list[tuple[str, int]]:
    points = [point for point in knowledge_points if point]
    if not points:
        return []

    requested = max(total_count, 1)
    selected_points = points[:requested]
    base = requested // len(selected_points)
    remainder = requested % len(selected_points)

    distribution: list[tuple[str, int]] = []
    for index, point in enumerate(selected_points):
        count = base + (1 if index < remainder else 0)
        if count > 0:
            distribution.append((point, count))
    return distribution


class QuestionGeneratorAgent:
    """Generate evaluation questions with parsing and fallback safeguards."""

    def __init__(self) -> None:
        self.llm_client = get_llm_client()

    async def generate_questions(
        self,
        knowledge_point: str,
        difficulty_level: int,
        question_type: int,
        count: int = 1,
        course_context: str = "",
    ) -> list[dict[str, Any]]:
        difficulty_map = {1: "基础", 2: "进阶", 3: "提高"}
        type_map = {
            1: "单选题",
            2: "多选题",
            3: "判断题",
            4: "填空题",
            5: "简答题",
            6: "编程题",
        }

        prompt = self._build_generation_prompt(
            knowledge_point=knowledge_point,
            difficulty_desc=difficulty_map.get(difficulty_level, "基础"),
            type_desc=type_map.get(question_type, "单选题"),
            count=count,
            course_context=course_context,
        )

        try:
            response = await asyncio.wait_for(
                self.llm_client.chat_completion(
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.7,
                    max_tokens=2000,
                ),
                timeout=QUESTION_GENERATION_TIMEOUT_SECONDS,
            )
            raw_content = getattr(response, "content", "") or response.get("content", "")
            questions = self._parse_questions(raw_content, question_type, difficulty_level)
            questions = [question for question in questions if _is_question_relevant(question, knowledge_point)]
            if not questions:
                logger.warning(
                    "question generation returned no relevant questions; using fallback",
                    knowledge_point=knowledge_point,
                    question_type=question_type,
                    difficulty_level=difficulty_level,
                    requested_count=count,
                )
                questions = [
                    _build_fallback_question(
                        knowledge_point=knowledge_point,
                        difficulty_level=difficulty_level,
                        question_type=question_type,
                        index=index + 1,
                    )
                    for index in range(max(count, 1))
                ]
            else:
                for question in questions:
                    question["knowledge_point"] = knowledge_point

            for question in questions:
                question["quality_score"] = await self._assess_quality(question)

            logger.info(
                "question generation completed",
                count=len(questions),
                knowledge_point=knowledge_point,
                difficulty_level=difficulty_level,
                question_type=question_type,
            )
            return questions
        except Exception as exc:
            logger.error(
                "question generation failed; using fallback",
                error=str(exc),
                knowledge_point=knowledge_point,
                question_type=question_type,
                difficulty_level=difficulty_level,
                timeout_seconds=QUESTION_GENERATION_TIMEOUT_SECONDS,
            )
            return [
                _build_fallback_question(
                    knowledge_point=knowledge_point,
                    difficulty_level=difficulty_level,
                    question_type=question_type,
                    index=index + 1,
                )
                for index in range(max(count, 1))
            ]

    def _build_generation_prompt(
        self,
        knowledge_point: str,
        difficulty_desc: str,
        type_desc: str,
        count: int,
        course_context: str,
    ) -> str:
        context_section = f"\n课程背景:\n{course_context}" if course_context else ""
        return f"""
你是一位专业的教育测评专家，请根据以下要求生成高质量题目。

知识点: {knowledge_point}
难度层级: {difficulty_desc}
题目类型: {type_desc}
生成数量: {count}{context_section}

请直接返回 JSON 数组，不要输出额外说明。格式如下：
[
  {{
    "question_content": "题目内容",
    "question_options": [{{"key": "A", "value": "选项A"}}],
    "correct_answer": "正确答案",
    "answer_analysis": "答案解析",
    "knowledge_point": "{knowledge_point}",
    "difficulty_reasoning": "难度设计说明"
  }}
]
""".strip()

    def _parse_questions(
        self,
        content: str,
        question_type: int,
        difficulty_level: int,
    ) -> list[dict[str, Any]]:
        sanitized_content = _sanitize_text(content)
        json_str = _extract_json_array(sanitized_content)
        if not json_str:
            logger.warning("question parsing found no json array")
            return []

        try:
            parsed = json.loads(_strip_json_comments(json_str))
        except json.JSONDecodeError as exc:
            logger.warning("question json parse failed", error=str(exc))
            return []

        if not isinstance(parsed, list):
            logger.warning("question payload is not a list")
            return []

        normalized_questions: list[dict[str, Any]] = []
        for item in parsed:
            if not isinstance(item, dict):
                continue

            knowledge_point = str(item.get("knowledge_point") or "").strip()
            question = {
                "question_content": str(item.get("question_content") or "").strip(),
                "question_options": _normalize_options(question_type, item.get("question_options", [])),
                "correct_answer": str(item.get("correct_answer") or "").strip(),
                "answer_analysis": str(item.get("answer_analysis") or "").strip(),
                "knowledge_point": knowledge_point,
                "difficulty_reasoning": str(item.get("difficulty_reasoning") or "").strip(),
                "question_type": question_type,
                "difficulty_level": difficulty_level,
            }

            if not question["question_content"]:
                continue
            if question_type in {1, 2, 3} and not question["question_options"]:
                continue
            if not question["correct_answer"]:
                continue

            normalized_questions.append(question)

        return normalized_questions

    async def _assess_quality(self, question: dict[str, Any]) -> float:
        score = 0.0

        content = question.get("question_content", "")
        if 10 <= len(content) <= 500:
            score += 0.3
        elif content:
            score += 0.15

        options = question.get("question_options", [])
        if question.get("question_type") in [1, 2, 3]:
            if len(options) >= 2:
                score += 0.3
            elif options:
                score += 0.15
        else:
            score += 0.3

        if question.get("correct_answer"):
            score += 0.2

        analysis = question.get("answer_analysis", "")
        if len(analysis) >= 20:
            score += 0.2
        elif analysis:
            score += 0.1

        return round(score, 2)

    async def generate_layered_questions(
        self,
        knowledge_points: list[str],
        course_context: str = "",
    ) -> dict[str, list[dict[str, Any]]]:
        layered_questions = {"basic": [], "intermediate": [], "advanced": []}

        for knowledge_point in knowledge_points:
            layered_questions["basic"].extend(
                await self.generate_questions(
                    knowledge_point=knowledge_point,
                    difficulty_level=1,
                    question_type=1,
                    count=2,
                    course_context=course_context,
                )
            )
            layered_questions["intermediate"].extend(
                await self.generate_questions(
                    knowledge_point=knowledge_point,
                    difficulty_level=2,
                    question_type=2,
                    count=1,
                    course_context=course_context,
                )
            )
            layered_questions["advanced"].extend(
                await self.generate_questions(
                    knowledge_point=knowledge_point,
                    difficulty_level=3,
                    question_type=5,
                    count=1,
                    course_context=course_context,
                )
            )

        logger.info(
            "layered question generation completed",
            basic=len(layered_questions["basic"]),
            intermediate=len(layered_questions["intermediate"]),
            advanced=len(layered_questions["advanced"]),
        )
        return layered_questions


async def question_generator_node(state: LearningAgentState) -> LearningAgentState:
    """Runtime-logged node wrapper for monitoring."""
    from app.services.agent_runtime_logging_service import AgentRuntimeLoggingService

    agent = QuestionGeneratorAgent()
    runtime_logger = AgentRuntimeLoggingService()

    knowledge_points = state.get("knowledge_points", [])
    difficulty_level = state.get("difficulty_level", 1)
    question_type = state.get("question_type", 1)
    question_count = state.get("question_count", 5)
    course_context = state.get("course_context", "")
    generate_layered = state.get("generate_layered", False)

    try:
        async with runtime_logger.track(
            agent_name="question_generator_agent",
            start_message="question_generator_agent started",
            success_message="question_generator_agent completed",
            start_payload={
                "knowledge_points": knowledge_points,
                "difficulty_level": difficulty_level,
                "question_type": question_type,
                "question_count": question_count,
                "generate_layered": generate_layered,
            },
            success_payload_factory=lambda: {
                "generated_count": len(state.get("generated_questions", [])),
                "fallback_count": state.get("fallback_count", 0),
                "fallback_knowledge_points": state.get("fallback_knowledge_points", []),
                "timeout_seconds": QUESTION_GENERATION_TIMEOUT_SECONDS,
                "trace_size": len(state.get("execution_trace", [])),
            },
            success_status_factory=lambda: "degraded" if state.get("fallback_count", 0) else "ok",
            success_message_factory=lambda: (
                "question_generator_agent completed with fallback"
                if state.get("fallback_count", 0)
                else "question_generator_agent completed"
            ),
            error_message="question_generator_agent failed",
        ):
            if generate_layered:
                layered_questions = await agent.generate_layered_questions(
                    knowledge_points=knowledge_points,
                    course_context=course_context,
                )
                fallback_knowledge_points = sorted(
                    {
                        str(question.get("knowledge_point") or "").strip()
                        for questions in layered_questions.values()
                        for question in questions
                        if question.get("_fallback_used")
                    }
                )
                for questions in layered_questions.values():
                    for question in questions:
                        question.pop("_fallback_used", None)
                state["layered_questions"] = layered_questions
                state["generated_questions"] = (
                    layered_questions["basic"]
                    + layered_questions["intermediate"]
                    + layered_questions["advanced"]
                )
                state["fallback_knowledge_points"] = fallback_knowledge_points
                state["fallback_count"] = len(fallback_knowledge_points)
            else:
                tasks = [
                    agent.generate_questions(
                        knowledge_point=knowledge_point,
                        difficulty_level=difficulty_level,
                        question_type=question_type,
                        count=assigned_count,
                        course_context=course_context,
                    )
                    for knowledge_point, assigned_count in _distribute_question_counts(knowledge_points, question_count)
                ]
                question_batches = await asyncio.gather(*tasks) if tasks else []
                questions: list[dict[str, Any]] = []
                fallback_knowledge_points: list[str] = []
                for batch in question_batches:
                    fallback_points = [
                        str(question.get("knowledge_point") or "").strip()
                        for question in batch
                        if question.get("_fallback_used")
                    ]
                    if fallback_points:
                        fallback_knowledge_points.append(fallback_points[0])
                    for question in batch:
                        question.pop("_fallback_used", None)
                    questions.extend(batch)
                state["generated_questions"] = questions
                state["fallback_knowledge_points"] = fallback_knowledge_points
                state["fallback_count"] = len(fallback_knowledge_points)

            trace = state.get("execution_trace", [])
            trace.append("question_generator")
            state["execution_trace"] = trace
    except Exception as exc:
        logger.error("question generator node failed", error=str(exc))
        state["error"] = str(exc)

    return state
