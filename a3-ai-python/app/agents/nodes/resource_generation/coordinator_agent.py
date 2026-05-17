"""
多智能体资源生成协调器。
"""

from __future__ import annotations

import asyncio
from datetime import datetime
from typing import TYPE_CHECKING, Any

from app.agents.state import LearningAgentState
from app.services.agent_runtime_logging_service import AgentRuntimeLoggingService

if TYPE_CHECKING:
    from .code_example_agent import CodeExampleGenerationAgent
    from .document_agent import DocumentGenerationAgent
    from .mindmap_agent import MindmapGenerationAgent
    from .question_bank_agent import QuestionBankGenerationAgent
    from .video_agent import VideoRecommendationAgent


class ResourceGenerationCoordinator:
    """协调多个资源生成智能体并行工作。"""

    def __init__(self) -> None:
        self.document_agent: DocumentGenerationAgent | None = None
        self.mindmap_agent: MindmapGenerationAgent | None = None
        self.question_bank_agent: QuestionBankGenerationAgent | None = None
        self.video_agent: VideoRecommendationAgent | None = None
        self.code_example_agent: CodeExampleGenerationAgent | None = None
        self._agent_import_error: str | None = None
        self._runtime_logger = AgentRuntimeLoggingService()

        try:
            from .code_example_agent import CodeExampleGenerationAgent
            from .document_agent import DocumentGenerationAgent
            from .mindmap_agent import MindmapGenerationAgent
            from .question_bank_agent import QuestionBankGenerationAgent
            from .video_agent import VideoRecommendationAgent
        except ModuleNotFoundError as exc:
            self._agent_import_error = (
                "资源生成依赖未安装，暂时无法执行多智能体生成"
                f"（缺少模块 {exc.name}）"
            )
            return

        self.document_agent = DocumentGenerationAgent()
        self.mindmap_agent = MindmapGenerationAgent()
        self.question_bank_agent = QuestionBankGenerationAgent()
        self.video_agent = VideoRecommendationAgent()
        self.code_example_agent = CodeExampleGenerationAgent()

    def _require_agent(self, agent: Any, agent_name: str) -> Any:
        if agent is None:
            raise RuntimeError(
                self._agent_import_error or f"{agent_name} 未初始化，无法执行资源生成"
            )
        return agent

    async def _run_logged(self, *, agent_name: str, payload: dict[str, Any], action):
        async with self._runtime_logger.track(
            agent_name=agent_name,
            start_message=f"{agent_name} started",
            success_message=f"{agent_name} completed",
            start_payload=payload,
            error_message=f"{agent_name} failed",
        ):
            return await action()

    async def coordinate_generation(
        self,
        knowledge_point: str,
        resource_types: list[int],
        student_profile: dict[str, Any] | None = None,
        course_context: str | None = None,
        related_knowledge: list[str] | None = None,
        programming_language: str = "Python",
    ) -> dict[str, Any]:
        start_time = datetime.now()
        payload = {
            "knowledge_point": knowledge_point,
            "resource_types": resource_types,
            "course_context": course_context,
            "related_knowledge_count": len(related_knowledge or []),
        }

        async with self._runtime_logger.track(
            agent_name="coordinator_agent",
            start_message="coordinator_agent started",
            success_message="coordinator_agent completed",
            start_payload=payload,
            success_payload_factory=lambda: {
                **payload,
                "duration_seconds": (datetime.now() - start_time).total_seconds(),
            },
            error_message="coordinator_agent failed",
        ):
            tasks = []
            task_names: list[str] = []

            if 1 in resource_types:
                tasks.append(
                    self._generate_document(
                        knowledge_point, student_profile, course_context, related_knowledge
                    )
                )
                task_names.append("document")

            if 2 in resource_types:
                tasks.append(self._generate_mindmap(knowledge_point, course_context, related_knowledge))
                task_names.append("mindmap")

            if 3 in resource_types:
                tasks.append(self._generate_question_bank(knowledge_point))
                task_names.append("question_bank")

            if 4 in resource_types:
                tasks.append(self._recommend_videos(knowledge_point, student_profile))
                task_names.append("video")

            if 5 in resource_types:
                difficulty_level = student_profile.get("difficulty_level", 1) if student_profile else 1
                tasks.append(
                    self._generate_code_example(knowledge_point, programming_language, difficulty_level)
                )
                task_names.append("code_example")

            results = await asyncio.gather(*tasks, return_exceptions=True)

            aggregated_results: dict[str, Any] = {}
            success_count = 0
            failed_count = 0

            for task_name, result in zip(task_names, results):
                if isinstance(result, Exception):
                    aggregated_results[task_name] = {"success": False, "error": str(result)}
                    failed_count += 1
                else:
                    aggregated_results[task_name] = {"success": True, "data": result}
                    success_count += 1

            duration = (datetime.now() - start_time).total_seconds()
            overall_quality = self._calculate_overall_quality(aggregated_results)

            return {
                "results": aggregated_results,
                "summary": {
                    "total_tasks": len(tasks),
                    "success_count": success_count,
                    "failed_count": failed_count,
                    "duration_seconds": duration,
                    "overall_quality_score": overall_quality,
                },
            }

    async def _generate_document(
        self,
        knowledge_point: str,
        student_profile: dict[str, Any] | None,
        course_context: str | None,
        related_knowledge: list[str] | None,
    ) -> dict[str, Any]:
        agent = self._require_agent(self.document_agent, "document_agent")
        return await self._run_logged(
            agent_name="document_agent",
            payload={"knowledge_point": knowledge_point},
            action=lambda: agent.generate_document(
                knowledge_point=knowledge_point,
                student_profile=student_profile,
                course_context=course_context,
                related_knowledge=related_knowledge,
            ),
        )

    async def _generate_mindmap(
        self,
        knowledge_point: str,
        course_context: str | None,
        related_knowledge: list[str] | None,
    ) -> dict[str, Any]:
        agent = self._require_agent(self.mindmap_agent, "mindmap_agent")
        return await self._run_logged(
            agent_name="mindmap_agent",
            payload={"knowledge_point": knowledge_point},
            action=lambda: agent.generate_mindmap(
                knowledge_point=knowledge_point,
                course_context=course_context,
                related_knowledge=related_knowledge,
            ),
        )

    async def _generate_question_bank(self, knowledge_point: str) -> dict[str, Any]:
        agent = self._require_agent(self.question_bank_agent, "question_bank_agent")
        return await self._run_logged(
            agent_name="question_bank_agent",
            payload={"knowledge_point": knowledge_point},
            action=lambda: agent.generate_question_bank(knowledge_point=knowledge_point),
        )

    async def _recommend_videos(
        self,
        knowledge_point: str,
        student_profile: dict[str, Any] | None,
    ) -> dict[str, Any]:
        agent = self._require_agent(self.video_agent, "video_agent")
        return await self._run_logged(
            agent_name="video_agent",
            payload={"knowledge_point": knowledge_point},
            action=lambda: agent.recommend_videos(
                knowledge_point=knowledge_point,
                student_profile=student_profile,
            ),
        )

    async def _generate_code_example(
        self,
        knowledge_point: str,
        programming_language: str,
        difficulty_level: int,
    ) -> dict[str, Any]:
        agent = self._require_agent(self.code_example_agent, "code_example_agent")
        return await self._run_logged(
            agent_name="code_example_agent",
            payload={
                "knowledge_point": knowledge_point,
                "programming_language": programming_language,
                "difficulty_level": difficulty_level,
            },
            action=lambda: agent.generate_code_example(
                knowledge_point=knowledge_point,
                programming_language=programming_language,
                difficulty_level=difficulty_level,
            ),
        )

    def _calculate_overall_quality(self, results: dict[str, Any]) -> float:
        total_score = 0.0
        valid_count = 0

        for resource_type, result in results.items():
            if not result.get("success"):
                continue

            data = result.get("data", {})
            if resource_type == "document":
                total_score += data.get("quality_score", 0.5)
                valid_count += 1
            elif resource_type == "mindmap":
                node_count = data.get("node_count", 0)
                max_depth = data.get("max_depth", 0)
                total_score += min(1.0, (node_count / 30 + max_depth / 4) / 2)
                valid_count += 1
            elif resource_type == "question_bank":
                total_questions = data.get("total_questions", 0)
                total_score += min(1.0, total_questions / 10)
                valid_count += 1
            elif resource_type == "video":
                recommended_count = data.get("recommended_count", 0)
                total_score += min(1.0, recommended_count / 5)
                valid_count += 1
            elif resource_type == "code_example":
                code_structure = data.get("code_structure", {})
                line_count = code_structure.get("line_count", 0)
                total_score += min(1.0, line_count / 100)
                valid_count += 1

        if valid_count == 0:
            return 0.0
        return round(total_score / valid_count, 2)


async def resource_coordinator_node(state: LearningAgentState) -> LearningAgentState:
    knowledge_point = state.get("knowledge_point", "")
    resource_types = state.get("resource_types", [1, 2, 3, 4, 5])
    student_profile = state.get("student_profile", {})
    course_context = state.get("course_context", "")
    related_knowledge = state.get("related_knowledge", [])
    programming_language = state.get("programming_language", "Python")

    if not knowledge_point:
        state["coordination_result"] = {"success": False, "error": "缺少知识点信息"}
        return state

    coordinator = ResourceGenerationCoordinator()

    try:
        result = await coordinator.coordinate_generation(
            knowledge_point=knowledge_point,
            resource_types=resource_types,
            student_profile=student_profile,
            course_context=course_context,
            related_knowledge=related_knowledge,
            programming_language=programming_language,
        )

        state["coordination_result"] = {"success": True, "data": result}

        results = result.get("results", {})
        if "document" in results:
            state["document_result"] = results["document"]
        if "mindmap" in results:
            state["mindmap_result"] = results["mindmap"]
        if "question_bank" in results:
            state["question_bank_result"] = results["question_bank"]
        if "video" in results:
            state["video_result"] = results["video"]
        if "code_example" in results:
            state["code_example_result"] = results["code_example"]

        summary = result.get("summary", {})
        trace = state.get("execution_trace", [])
        trace.append(
            f"resource_coordination:success:"
            f"total={summary.get('total_tasks')},"
            f"success={summary.get('success_count')},"
            f"failed={summary.get('failed_count')},"
            f"quality={summary.get('overall_quality_score')}"
        )
        state["execution_trace"] = trace
    except Exception as exc:
        state["coordination_result"] = {"success": False, "error": str(exc)}
        trace = state.get("execution_trace", [])
        trace.append(f"resource_coordination:failed:{str(exc)}")
        state["execution_trace"] = trace

    return state
