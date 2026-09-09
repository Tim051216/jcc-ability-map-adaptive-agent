import httpx
import re

from app.core.logging import get_logger
from app.integrations.llm.base import LLMMessage
from app.integrations.llm.provider_factory import get_llm_provider

logger = get_logger(__name__)


def _extract_course_title(course_name: str, context_chunks: list[dict]) -> str:
    for chunk in context_chunks[:4]:
        text = "\n".join(
            [
                str(chunk.get("title", "")),
                str(chunk.get("content", "")),
            ]
        )
        match = re.search(r"课程名称[:：]\s*([^\n]+)", text)
        if match:
            return match.group(1).strip()
    return course_name


def _build_rule_based_answer(question: str, course_name: str, context_chunks: list[dict]) -> str | None:
    normalized = (question or "").strip()
    if not normalized:
        return None

    detected_course_name = _extract_course_title(course_name, context_chunks)
    top_titles = [str(chunk.get("title", "")).strip() for chunk in context_chunks[:4] if str(chunk.get("title", "")).strip()]

    asks_course_name = "课程名称" in normalized or "什么课" in normalized or "识别到的课程" in normalized
    asks_learning_advice = any(keyword in normalized for keyword in ["学习建议", "怎么学", "如何学", "先学什么", "学习路径"])

    if asks_course_name and asks_learning_advice:
        lines = [
            f"直接结论：我识别到的课程名称是《{detected_course_name}》。",
            "",
            "学习建议：先看课程总览和课程画像，明确章节结构、考核方式和资料入口，再按章节知识图谱推进学习。",
        ]
        if top_titles:
            lines.extend(
                [
                    "",
                    "可以优先从这些材料开始：",
                    *[f"- {title}" for title in top_titles[:3]],
                ]
            )
        return "\n".join(lines)

    if asks_course_name:
        return f"我识别到的课程名称是《{detected_course_name}》。"

    if asks_learning_advice:
        lines = [
            f"建议先从《{detected_course_name}》的课程总览、课程画像和章节知识图谱开始，先建立整体框架，再进入实验、案例和考核资料。",
        ]
        if top_titles:
            lines.append("优先阅读材料：")
            lines.extend(f"- {title}" for title in top_titles[:3])
        return "\n".join(lines)

    return None


class AnswerService:
    async def answer_with_context(
        self,
        question: str,
        course_name: str,
        context_chunks: list[dict],
    ) -> str:
        if not context_chunks:
            return (
                f"当前没有检索到与 {course_name} 相关的可用知识片段。"
                "请先确认课程是否已经完成知识入库，或换一个更具体的问题。"
            )

        rule_based_answer = _build_rule_based_answer(question, course_name, context_chunks)
        if rule_based_answer:
            return rule_based_answer

        context = "\n\n".join(
            f"[{index + 1}] {chunk.get('title', '未命名片段')}\n{chunk.get('content', '')}"
            for index, chunk in enumerate(context_chunks[:4])
        )
        messages = [
            LLMMessage(
                role="system",
                content=(
                    "你是软件技术专业群的岗课赛教学实训助手。请严格基于给定知识片段回答，不要编造片段中没有的信息；回答尽量说明对应岗位能力、课程知识和实训/竞赛产出。"
                    "回答时先给出直接结论，再给出简洁解释。"
                    "如果问题与片段不匹配，请明确说明你无法从当前片段中得到答案。"
                ),
            ),
            LLMMessage(
                role="user",
                content=(
                    f"课程：{course_name}\n"
                    f"问题：{question}\n\n"
                    f"知识片段：\n{context}"
                ),
            ),
        ]

        provider = get_llm_provider()
        last_error: Exception | None = None
        for attempt in range(2):
            try:
                return await provider.generate(messages)
            except (httpx.HTTPError, ValueError, KeyError, IndexError) as exc:
                last_error = exc
                logger.warning(
                    "answer_service.llm_retry",
                    attempt=attempt + 1,
                    course_name=course_name,
                    question=question,
                    error=str(exc),
                )

        logger.warning(
            "answer_service.fallback",
            course_name=course_name,
            question=question,
            error=str(last_error) if last_error else "unknown",
        )
        top_hit = context_chunks[0]
        answer_parts = [
            f"基于 {course_name} 的知识库检索，我先给你一个直接回答：",
            top_hit.get("content", ""),
        ]
        if len(context_chunks) > 1:
            answer_parts.append("你还可以继续参考这些相关知识点：")
            answer_parts.extend(
                f"- {chunk.get('title', '未命名片段')}" for chunk in context_chunks[1:4]
            )
        return "\n\n".join(answer_parts)
