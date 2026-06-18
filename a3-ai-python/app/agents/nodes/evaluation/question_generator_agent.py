"""Question generation agent."""

from __future__ import annotations

import asyncio
import json
import re
from typing import Any

from app.agents.state import LearningAgentState
from app.core.logging import logger
from app.integrations.llm.client import get_llm_client


QUESTION_GENERATION_TIMEOUT_SECONDS = 45


def _sanitize_text(text: str) -> str:
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
            value = value.strip()
            if value:
                normalized.append({"key": key.strip(), "value": value})
    return normalized


def _build_fallback_question(
    *,
    knowledge_point: str,
    difficulty_level: int,
    question_type: int,
    index: int,
    course_context: str = "",
) -> dict[str, Any]:
    point = knowledge_point.strip() or "当前知识点"
    context_hint = course_context.strip()
    normalized_type = question_type or 1

    if normalized_type == 1:
        prompt = (
            f"在 {context_hint or '当前课程'} 的学习中，关于“{point}”的说法，哪一项最符合软件工程课程中的标准理解？"
        )
        options = [
            {"key": "A", "value": f"准确说明 {point} 的目标、边界或核心作用"},
            {"key": "B", "value": f"把 {point} 直接等同于后续编码或上线动作"},
            {"key": "C", "value": f"只关注表面术语，不考虑业务约束与场景"},
            {"key": "D", "value": f"把 {point} 误认为与本章节无关的外围工作"},
        ]
        correct_answer = "A"
        analysis = f"{point} 的考查重点是核心定义、使用边界和在课程语境中的真实作用，不应和开发后续动作混淆。"
    elif normalized_type == 2:
        prompt = f"关于“{point}”，下面哪些表述是合理的？"
        options = [
            {"key": "A", "value": f"体现 {point} 的基本定义"},
            {"key": "B", "value": f"体现 {point} 的适用场景"},
            {"key": "C", "value": f"混淆 {point} 与其他知识点的错误说法"},
            {"key": "D", "value": f"体现 {point} 在实际项目中的落地方式"},
        ]
        correct_answer = "A,B,D"
        analysis = f"多选题会同时覆盖 {point} 的定义、场景和应用，错误项通常来自知识点混淆。"
    elif normalized_type == 3:
        prompt = f"判断正误：{point} 只需要记住概念，不需要结合实际场景理解。"
        options = [{"key": "A", "value": "正确"}, {"key": "B", "value": "错误"}]
        correct_answer = "B"
        analysis = f"{point} 不是纯记忆型内容，课程测评更强调能否放回真实情境中理解。"
    elif normalized_type == 4:
        prompt = f"填空：{point} 的核心目标是 __________。"
        options = []
        correct_answer = point
        analysis = f"填空题通常考查 {point} 的标准表述或关键目标。"
    elif normalized_type == 5:
        prompt = f"请简要说明 {point} 在当前课程中的作用，并给出一个典型应用场景。"
        options = []
        correct_answer = point
        analysis = f"简答题会同时检查对 {point} 的概念理解和场景表达能力。"
    else:
        prompt = f"请围绕 {point} 编写一段能体现其应用的代码或伪代码。"
        options = []
        correct_answer = point
        analysis = f"编程题要求把 {point} 落到实际实现或流程表达上。"

    return {
        "question_content": prompt,
        "question_options": options,
        "correct_answer": correct_answer,
        "answer_analysis": analysis,
        "knowledge_point": point,
        "difficulty_reasoning": f"该题按难度等级 {difficulty_level} 生成，用于覆盖 {point} 的核心掌握情况。",
        "question_type": normalized_type,
        "difficulty_level": difficulty_level,
        "quality_score": 0.6,
        "_fallback_used": True,
        "_fallback_index": index,
    }


def _is_question_relevant(question: dict[str, Any], knowledge_point: str) -> bool:
    expected = knowledge_point.strip().lower()
    if not expected:
        return True

    question_content = str(question.get("question_content", "")).strip()
    answer_analysis = str(question.get("answer_analysis", "")).strip()
    normalized_point = str(question.get("knowledge_point", "")).strip().lower()

    if normalized_point and normalized_point == expected:
        return True

    haystack = " ".join(
        [
            question_content,
            answer_analysis,
            str(question.get("difficulty_reasoning", "")),
        ]
    ).lower()
    if expected in haystack:
        return True

    compact_expected = re.sub(r"\s+", "", expected)
    compact_haystack = re.sub(r"\s+", "", haystack)
    return bool(compact_expected and compact_expected in compact_haystack)


def _distribute_question_counts(knowledge_points: list[str], total_count: int) -> list[tuple[str, int]]:
    points = [point.strip() for point in knowledge_points if point and point.strip()]
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
                    temperature=0.55,
                    max_tokens=2200,
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
                        course_context=course_context,
                    )
                    for index in range(max(count, 1))
                ]
            else:
                for question in questions:
                    question["knowledge_point"] = knowledge_point

            questions = questions[: max(count, 1)]
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
                error_repr=repr(exc),
                error_type=exc.__class__.__name__,
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
                    course_context=course_context,
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
        context_section = f"\n课程背景：\n{course_context.strip()}" if course_context.strip() else ""
        return f"""
你是一名严谨的课程命题老师，需要围绕“{knowledge_point}”生成可以直接用于在线测评的正式题目。

知识点：{knowledge_point}
难度层级：{difficulty_desc}
题目类型：{type_desc}
生成数量：{count}{context_section}

出题要求：
1. 题目必须是课程知识题，不要输出学习建议、产品推荐、视频推荐、复习提醒或 AI 助手话术。
2. 题干要具体，优先考查定义理解、概念辨析、场景判断、流程步骤、方法比较、错误识别。
3. 如果是选择题，选项要像真实考试题，干扰项合理，长度接近，不能明显凑数。
4. 解析必须解释为什么正确、为什么其余选项不合适，不能只写一句“因为定义如此”。
5. 输出内容必须紧扣“{knowledge_point}”，不要泛化到其他章节，不要改写成宽泛学习态度题。
6. 如果课程背景里出现软件工程等课程信息，请优先按该课程语境命题。
7. `knowledge_point` 字段必须写回“{knowledge_point}”。
8. 只返回 JSON 数组，不要返回 Markdown，不要加任何额外说明。

JSON 格式：
[
  {{
    "question_content": "题干",
    "question_options": [
      {{"key": "A", "value": "选项A"}},
      {{"key": "B", "value": "选项B"}},
      {{"key": "C", "value": "选项C"}},
      {{"key": "D", "value": "选项D"}}
    ],
    "correct_answer": "A",
    "answer_analysis": "解析",
    "knowledge_point": "{knowledge_point}",
    "difficulty_reasoning": "这道题为什么符合当前难度"
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
        if 12 <= len(content) <= 280:
            score += 0.3
        elif content:
            score += 0.15

        options = question.get("question_options", [])
        if question.get("question_type") in [1, 2, 3]:
            if len(options) >= 4:
                score += 0.3
            elif len(options) >= 2:
                score += 0.2
        else:
            score += 0.3

        if question.get("correct_answer"):
            score += 0.2

        analysis = question.get("answer_analysis", "")
        if len(analysis) >= 24:
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
                        question.pop("_fallback_index", None)
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
                        question.pop("_fallback_index", None)
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
