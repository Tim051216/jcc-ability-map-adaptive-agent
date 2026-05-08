import httpx

from app.core.logging import get_logger
from app.integrations.llm.base import LLMMessage
from app.integrations.llm.provider_factory import get_llm_provider

logger = get_logger(__name__)


class AnswerService:
    async def answer_with_context(
        self,
        question: str,
        course_name: str,
        context_chunks: list[dict],
    ) -> str:
        if not context_chunks:
            return (
                f"当前没有检索到 {course_name} 的可用知识片段。"
                "请先确认课程是否已经完成知识入库，或者换一个更具体的问题。"
            )

        context = "\n\n".join(
            f"[{index + 1}] {chunk.get('title', '未命名片段')}\n{chunk.get('content', '')}"
            for index, chunk in enumerate(context_chunks[:4])
        )
        messages = [
            LLMMessage(
                role="system",
                content=(
                    "你是高校课程学习助手。请严格基于给定知识片段回答，"
                    "不要编造片段中没有的信息。回答时先给出直接结论，"
                    "再给出简洁解释。"
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
