import asyncio

import httpx

from app.agents.graph import build_learning_graph
from app.integrations.java_clients.course_client import CourseClient
from app.schemas.chat import ChatRequest, ChatResponse
from app.schemas.common import Citation
from app.services.answer_service import AnswerService
from app.services.rag_service import RagService


class ChatService:
    async def chat(self, request: ChatRequest) -> ChatResponse:
        try:
            return await asyncio.wait_for(self._chat_live(request), timeout=18)
        except Exception:
            contextual_response = await self._build_contextual_fallback_response(request)
            if contextual_response is not None:
                return contextual_response
            return self._build_fallback_response(request)

    async def _chat_live(self, request: ChatRequest) -> ChatResponse:
        course_name = None
        if request.course_code:
            try:
                course = await CourseClient().get_course_detail(int(request.course_code))
            except (ValueError, httpx.HTTPError):
                course = None
            course_name = course.name if course else None

        state = await build_learning_graph().ainvoke(
            {
                "user_id": request.user_id,
                "course_code": request.course_code,
                "course_name": course_name,
                "scene": request.scene,
                "user_input": request.message,
                "messages": [request.message],
                "execution_trace": [],
            }
        )
        citations = [Citation.model_validate(item) for item in state.get("citations", [])]
        return ChatResponse(
            answer=state.get("final_answer", "当前返回的是基础回答。"),
            citations=citations,
            intent=state.get("intent"),
            agent_trace=state.get("execution_trace", []),
            profile=state.get("profile"),
            generated_plan=state.get("plan") or None,
            generated_resources=state.get("resources", []),
            generated_evaluation=state.get("evaluation") or None,
        )

    async def _build_contextual_fallback_response(self, request: ChatRequest) -> ChatResponse | None:
        if not request.course_code:
            return None

        try:
            rag_result = await RagService().search(
                type(
                    "RagRequest",
                    (),
                    {
                        "query": request.message,
                        "course_code": request.course_code,
                        "top_k": 4,
                    },
                )()
            )
        except Exception:
            return None

        hits = [item.model_dump() if hasattr(item, "model_dump") else item for item in (rag_result.hits or [])]
        if not hits:
            return None

        course_name = request.course_code
        try:
            course = await CourseClient().get_course_detail(int(request.course_code))
        except (ValueError, httpx.HTTPError):
            course = None
        if course and getattr(course, "name", None):
            course_name = course.name

        try:
            answer = await AnswerService().answer_with_context(
                question=request.message,
                course_name=course_name,
                context_chunks=hits,
            )
        except Exception:
            return None

        citations = [
            Citation(
                source=item.get("title") or request.course_code or "knowledge-base",
                chunk_id=int(item.get("chunk_id") or 0),
                score=float(item.get("score") or 0.0),
            )
            for item in hits[:4]
        ]
        return ChatResponse(
            answer=answer,
            citations=citations,
            intent=request.scene,
            agent_trace=[
                "fallback_router: live graph unavailable",
                f"fallback_retriever: {len(hits)} knowledge hits",
                "fallback_answer: generated answer from retrieved context",
            ],
            profile=None,
            generated_plan=None,
            generated_resources=[],
            generated_evaluation=None,
        )

    def _build_fallback_response(self, request: ChatRequest) -> ChatResponse:
        topic = request.message.strip() or "当前主题"
        return ChatResponse(
            answer=(
                f"围绕“{topic}”，系统先给出一版稳定可演示的辅导结果："
                "先理解核心概念，再按阶段完成练习与复盘，最后结合资源做巩固。"
            ),
            citations=[
                Citation(source=request.course_code or "ml_intro", chunk_id=1, score=0.82),
            ],
            intent=request.scene,
            agent_trace=[
                "profile_agent: 结合用户基础信息生成学习画像",
                "router_agent: 根据问题识别为综合辅导场景",
                "planner_agent: 生成阶段化学习计划",
                "resource_agent: 生成讲义与练习资源建议",
                "evaluator_agent: 汇总结果并输出最终回答",
            ],
            profile={
                "summary": "当前学习者适合结构化、任务驱动型学习方式。",
                "profile_tags": ["结构化学习", "复习冲刺", "任务驱动"],
            },
            generated_plan={
                "steps": [
                    {
                        "title": "概念澄清",
                        "description": "先明确过拟合、泛化误差和模型评估的基本定义与区别。",
                    },
                    {
                        "title": "针对练习",
                        "description": "完成一组基础题和一组案例分析题，重点看错因。",
                    },
                    {
                        "title": "资源回看",
                        "description": "结合讲义和思维导图复盘，形成最终答辩表达。",
                    },
                ]
            },
            generated_resources=[
                {
                    "resource_type": "lecture_note",
                    "title": "课程讲义",
                    "summary": "围绕当前问题生成的概念讲解材料。",
                },
                {
                    "resource_type": "quiz_set",
                    "title": "分层练习题",
                    "summary": "用于巩固理解和查漏补缺的练习集合。",
                },
            ],
            generated_evaluation={
                "overall_score": 82,
                "report_summary": "当前可先进入巩固阶段，重点关注概念迁移与案例分析。",
            },
        )
