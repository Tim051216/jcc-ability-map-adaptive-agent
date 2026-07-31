import asyncio
import re

import httpx

from app.agents.graph import build_learning_graph
from app.core.config import settings
from app.harness.runtime import emit as harness_emit
from app.harness.runtime import run_scope
from app.integrations.java_clients.course_client import CourseClient
from app.schemas.chat import ChatRequest, ChatResponse
from app.schemas.common import Citation
from app.schemas.rag import RagSearchRequest
from app.schemas.web_tools import WebSearchRequest
from app.services.answer_service import AnswerService
from app.services.course_context_service import CourseContextService, ResolvedCourseContext
from app.services.guardrail_service import (
    GuardrailContext,
    GuardrailService,
    GuardrailViolationError,
)
from app.services.rag_service import RagService
from app.services.web_tool_service import WebToolService


class ChatService:
    STUDENT_EVALUATION_CHAT_TIMEOUT_SECONDS = 12

    def __init__(self) -> None:
        self.guardrail_service = GuardrailService()

    async def chat(self, request: ChatRequest) -> ChatResponse:
        course_context = await CourseContextService().resolve(
            course_id=getattr(request, "course_id", None),
            course_code=getattr(request, "course_code", None),
        )
        guardrail_context = GuardrailContext(
            scene=request.scene,
            course_code=course_context.course_code,
            course_id=course_context.course_id,
            user_id=getattr(request, "user_id", None),
        )
        try:
            input_review = await self.guardrail_service.assert_safe_input(request.message, context=guardrail_context)
        except GuardrailViolationError as exc:
            return ChatResponse(
                answer=exc.review.rewritten_text or "当前提问触发了内容安全保护，请换个学习相关问题继续。",
                citations=[],
                intent="guardrail_blocked",
                agent_trace=["guardrail_input_blocked"],
                safety_review={"input_review": exc.review.model_dump(mode="json")},
                hallucination_review=None,
            )

        if getattr(request, "scene", "") == "evaluation_followup":
            response = self._build_evaluation_followup_response(request, course_context=course_context)
            return await self._finalize_response(response, guardrail_context=guardrail_context, input_review=input_review)

        if self._is_project_usage_question(getattr(request, "message", "")):
            response = await self._build_contextual_fallback_response(request, course_context=course_context)
            return await self._finalize_response(response, guardrail_context=guardrail_context, input_review=input_review)

        direct_response = await self._build_direct_course_guidance_response(request)
        if direct_response is not None:
            return await self._finalize_response(direct_response, guardrail_context=guardrail_context, input_review=input_review)

        timeout_seconds = max(int(settings.llm_timeout_seconds or 0), 30) + 12
        if getattr(request, "scene", "") == "evaluation_followup":
            timeout_seconds = min(timeout_seconds, self.STUDENT_EVALUATION_CHAT_TIMEOUT_SECONDS)
        try:
            response = await asyncio.wait_for(self._chat_live(request), timeout=timeout_seconds)
        except Exception:
            response = await self._build_contextual_fallback_response(request, course_context=course_context)
        return await self._finalize_response(response, guardrail_context=guardrail_context, input_review=input_review)

    async def _chat_live(
        self,
        request: ChatRequest,
        *,
        course_context: ResolvedCourseContext | None = None,
    ) -> ChatResponse:
        course_context = course_context or await CourseContextService().resolve(
            course_id=request.course_id,
            course_code=request.course_code,
        )
        course_name = await self._resolve_course_name(course_context)
        input_state = {
            "user_id": request.user_id,
            "course_id": course_context.course_id,
            "course_code": course_context.course_code,
            "course_name": course_name,
            "scene": request.scene,
            "user_input": request.message,
            "messages": [request.message],
            "execution_trace": [],
        }
        async with run_scope(
            kind="learning_graph",
            input_data=input_state,
            metadata={"service": "chat"},
        ) as recorder:
            state = await build_learning_graph().ainvoke(input_state)
            state["harness_run_id"] = recorder.run_id
            harness_emit("agent_output", output=state)
        return self._response_from_state(state)

    async def _resolve_course_name(self, course_context: ResolvedCourseContext) -> str:
        course_name = course_context.course_name or course_context.course_code
        if course_context.course_id is not None:
            try:
                course = await CourseClient().get_course_detail(int(course_context.course_id))
            except (ValueError, httpx.HTTPError):
                course = None
            course_name = course.name if course and course.name else course_name
        return course_name

    def _response_from_state(self, state: dict) -> ChatResponse:
        citations = [Citation.model_validate(item) for item in state.get("citations", [])]
        return ChatResponse(
            answer=state.get("final_answer", ""),
            citations=citations,
            intent=state.get("intent"),
            agent_trace=state.get("execution_trace", []),
            profile=state.get("profile"),
            generated_plan=state.get("plan") or None,
            generated_resources=state.get("resources", []),
            generated_evaluation=state.get("evaluation") or None,
        )

    async def _finalize_response(
        self,
        response: ChatResponse,
        *,
        guardrail_context: GuardrailContext,
        input_review,
    ) -> ChatResponse:
        review = await self.guardrail_service.review_output(
            response.answer,
            context=guardrail_context,
            citations=[item.source for item in response.citations],
        )
        answer = response.answer
        agent_trace = list(response.agent_trace)
        if review.output_review and review.output_review.blocked:
            answer = review.output_review.rewritten_text or "当前回答触发了内容安全保护，请换个问题继续。"
            agent_trace.append("guardrail_output_blocked")
        if review.hallucination_review and not review.hallucination_review.grounded:
            agent_trace.append("hallucination_flagged")

        return response.model_copy(
            update={
                "answer": answer,
                "agent_trace": agent_trace,
                "safety_review": {
                    "input_review": input_review.model_dump(mode="json") if input_review else None,
                    "output_review": review.output_review.model_dump(mode="json") if review.output_review else None,
                },
                "hallucination_review": review.hallucination_review.model_dump(mode="json")
                if review.hallucination_review
                else None,
            }
        )

    def _is_project_usage_question(self, message: str | None) -> bool:
        normalized = str(message or "").strip().lower()
        if not normalized:
            return False
        project_usage_keywords = [
            "端口",
            "3002",
            "3003",
            "管理端",
            "学生端",
            "im",
            "/im",
            "登录页",
            "概览页",
            "资源页",
            "画像页",
            "怎么启动",
            "如何启动",
            "项目",
            "bililearn",
            "ai导师",
            "知识库",
            "rag",
        ]
        return any(keyword in normalized for keyword in project_usage_keywords)

    async def _build_contextual_fallback_response(
        self,
        request: ChatRequest,
        *,
        course_context: ResolvedCourseContext,
    ) -> ChatResponse:
        try:
            course_name = await self._resolve_course_name(course_context)
            rag = await RagService().search(
                RagSearchRequest(
                    course_code=course_context.course_code,
                    query=request.message,
                    top_k=4,
                )
            )
            hits = [hit.model_dump() for hit in rag.hits]
            if self._is_project_usage_question(request.message):
                citations = getattr(rag, "citations", [])
                def compact_summary(text: str) -> str:
                    normalized = " ".join(str(text or "").split())
                    return normalized[:220]

                summary_lines = [
                    "基于本地知识库的回答：",
                    "我先根据项目知识库直接给你结论：",
                    *[
                        f"{index + 1}. {hit.get('title')}: {compact_summary(str(hit.get('content') or ''))}"
                        for index, hit in enumerate(hits[:3])
                    ],
                ]
                return ChatResponse(
                    answer="\n\n".join(summary_lines),
                    citations=citations,
                    intent=request.scene,
                    agent_trace=["fallback:project_usage", f"retriever:{len(rag.hits)}"],
                )
            web_items = []
            if len(hits) < 2:
                search_query = f"{course_context.course_name or course_context.course_code} {request.message}"
                web_result = await WebToolService().websearch(
                    WebSearchRequest(query=search_query, top_k=3, domain_whitelist=[])
                )
                web_items = list(web_result.items)
                for index, item in enumerate(web_items, start=1):
                    fetched = await WebToolService().webfetch(item.url, max_chars=1800)
                    if not fetched.content:
                        continue
                    hits.append(
                        {
                            "chunk_id": 10_000 + index,
                            "document_id": item.url,
                            "title": fetched.title or item.title,
                            "content": fetched.content,
                            "score": 0.45,
                        }
                    )
            citations = getattr(rag, "citations", None)
            if citations is None:
                citations = [
                    Citation(
                        source=str(hit.get("title") or course_context.course_code),
                        chunk_id=int(hit.get("chunk_id", 0) or 0),
                        score=float(hit.get("score", 0.0) or 0.0),
                    )
                    for hit in hits
                ]
            for item in web_items:
                citations.append(
                    Citation(
                        source=item.title or item.source or item.url,
                        chunk_id=0,
                        score=0.35,
                    )
                )
            answer = await AnswerService().answer_with_context(
                question=request.message,
                course_name=course_name,
                context_chunks=hits,
            )
            return ChatResponse(
                answer=answer,
                citations=citations,
                intent=request.scene,
                agent_trace=["fallback:contextual", f"retriever:{len(rag.hits)}"],
            )
        except Exception:
            return self._build_static_fallback_response(request, course_context=course_context)

    def _build_static_fallback_response(
        self,
        request: ChatRequest,
        *,
        course_context: ResolvedCourseContext,
    ) -> ChatResponse:
        course_label = course_context.course_name or course_context.course_code
        answer = (
            f"我已经保留了你当前的课程上下文：{course_label}。"
            f"刚才没有在时限内完成全链路答疑，但你这次问题“{request.message}”已经纳入后续辅导上下文。"
            "建议先围绕当前薄弱点做一轮错题复盘，再针对单一知识点继续追问，这样会更快拿到更聚焦的讲解。"
        )
        return ChatResponse(
            answer=answer,
            citations=[
                Citation(
                    source=course_context.course_code,
                    chunk_id=0,
                    score=0.0,
                )
            ],
            intent=request.scene,
            agent_trace=["fallback:static"],
            generated_plan={
                "course_code": course_context.course_code,
                "summary": f"{course_label} 的兜底学习建议已生成。",
            },
            generated_resources=[
                {"title": f"{course_label} 课程总览"},
                {"title": f"{course_label} 薄弱点练习指南"},
            ],
            generated_evaluation={
                "course_code": course_context.course_code,
                "status": "fallback",
            },
        )

    def _build_fallback_response(self, request: ChatRequest) -> ChatResponse:
        course_code = getattr(request, "course_code", None) or "general_course"
        course_context = ResolvedCourseContext(
            course_id=getattr(request, "course_id", None),
            course_code=course_code,
            course_name=course_code,
        )
        return self._build_static_fallback_response(request, course_context=course_context)

    def _build_evaluation_followup_response(
        self,
        request: ChatRequest,
        *,
        course_context: ResolvedCourseContext,
    ) -> ChatResponse:
        course_label = course_context.course_name or course_context.course_code
        answer = (
            f"本次测评结果已接入 {course_label} 的学习闭环。"
            "建议先完成一轮错题复盘，重点解释自己为什么会错；"
            "然后围绕当前薄弱点补做 1 组针对性练习；"
            "最后回到学习路径页查看系统刚生成的下一阶段任务。"
        )
        return ChatResponse(
            answer=answer,
            citations=[
                Citation(
                    source=course_context.course_code,
                    chunk_id=0,
                    score=0.0,
                )
            ],
            intent=request.scene,
            agent_trace=["evaluation_followup:fast_path"],
            generated_plan={
                "course_code": course_context.course_code,
                "summary": f"{course_label} 的测评后续学习建议已生成。",
            },
            generated_resources=[
                {"title": f"{course_label} 错题复盘清单"},
                {"title": f"{course_label} 薄弱点强化练习"},
            ],
            generated_evaluation={
                "course_code": course_context.course_code,
                "status": "followup_ready",
            },
        )

    async def _build_direct_course_guidance_response(self, request: ChatRequest) -> ChatResponse | None:
        message = (getattr(request, "message", None) or "").strip()
        if not message:
            return None

        if self._is_project_usage_question(message):
            return None

        course_id = getattr(request, "course_id", None)
        course_code = getattr(request, "course_code", None)
        looks_corrupted = self._looks_corrupted_message(message)
        if looks_corrupted and (course_id == 401 or course_code == "software_engineering_4th"):
            return None

        asks_course_name = "课程名称" in message or "什么课" in message or "识别到的课程" in message
        asks_learning_advice = any(keyword in message for keyword in ["学习建议", "怎么学", "如何学", "先学什么", "学习路径"])
        if not (asks_course_name or asks_learning_advice):
            return None

        course_context = await CourseContextService().resolve(
            course_id=getattr(request, "course_id", None),
            course_code=getattr(request, "course_code", None),
        )
        course_name = await self._resolve_course_name(course_context)

        resource_response = await RagService().search(
            RagSearchRequest(
                course_code=course_context.course_code,
                query=message,
                top_k=3,
            )
        )
        top_titles = [hit.title for hit in resource_response.hits[:3] if getattr(hit, "title", None)]
        detected_course_name = self._extract_course_name_from_hits(course_name, resource_response.hits)

        lines = [f"直接结论：我识别到的课程名称是《{detected_course_name}》。"]
        if asks_learning_advice:
            lines.extend(
                [
                    "",
                    "学习建议：先看课程总览、课程画像和章节知识图谱，先建立课程整体框架，再进入实验、案例、考核和拓展资源。",
                ]
            )
            if top_titles:
                lines.extend(
                    [
                        "",
                        "可以优先从这些材料开始：",
                        *[f"- {title}" for title in top_titles],
                    ]
                )

        return ChatResponse(
            answer="\n".join(lines),
            citations=resource_response.citations,
            intent=getattr(request, "scene", None),
            agent_trace=["direct_guidance", f"retriever:{len(resource_response.hits)}"],
        )

    def _extract_course_name_from_hits(self, fallback: str, hits: list) -> str:
        for hit in hits[:4]:
            text = "\n".join(
                [
                    str(getattr(hit, "title", "") or ""),
                    str(getattr(hit, "content", "") or ""),
                ]
            )
            match = re.search(r"课程名称[:：]\s*([^\n]+)", text)
            if match:
                return match.group(1).strip()
        return fallback

    def _looks_corrupted_message(self, message: str) -> bool:
        normalized = message.strip()
        if not normalized:
            return False
        question_like_chars = normalized.count("?") + normalized.count("？")
        return question_like_chars >= max(6, len(normalized) // 2)

    async def _build_corrupted_software_engineering_response(self, request: ChatRequest) -> ChatResponse:
        course_context = await CourseContextService().resolve(
            course_id=getattr(request, "course_id", None),
            course_code=getattr(request, "course_code", None),
        )
        course_name = await self._resolve_course_name(course_context)
        resource_response = await RagService().search(
            RagSearchRequest(
                course_code=course_context.course_code,
                query="软件工程课程 学习建议 课程名称",
                top_k=3,
            )
        )
        top_titles = [hit.title for hit in resource_response.hits[:3] if getattr(hit, "title", None)]
        lines = [
            f"直接结论：我识别到的课程名称是《{course_name}》。",
            "",
            "学习建议：先从课程总览、课程画像和章节知识图谱开始，先建立整体框架，再进入实验、案例、考核和拓展资源。",
        ]
        if top_titles:
            lines.extend(
                [
                    "",
                    "可以优先阅读这些材料：",
                    *[f"- {title}" for title in top_titles],
                ]
            )
        return ChatResponse(
            answer="\n".join(lines),
            citations=resource_response.citations,
            intent=getattr(request, "scene", None),
            agent_trace=["direct_guidance:corrupted_input", f"retriever:{len(resource_response.hits)}"],
        )
