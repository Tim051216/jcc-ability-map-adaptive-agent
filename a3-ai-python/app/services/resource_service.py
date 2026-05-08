from app.core.constants import RESOURCE_TYPES
from app.schemas.common import ResourceCard
from app.schemas.rag import RagSearchRequest
from app.schemas.resource import ResourceGenerationRequest, ResourceGenerationResponse
from app.services.rag_service import RagService


class ResourceService:
    async def generate_resources(
        self, request: ResourceGenerationRequest
    ) -> ResourceGenerationResponse:
        resource_types = request.resource_types or RESOURCE_TYPES
        query = "、".join(request.knowledge_points) if request.knowledge_points else request.course_code
        rag = await RagService().search(
            RagSearchRequest(course_code=request.course_code, query=query, top_k=4)
        )
        source_text = "\n\n".join(
            f"## {hit.title}\n{hit.content}" for hit in rag.hits
        ) or "当前知识库暂时没有命中内容，请先完成课程知识入库。"
        source_titles = [hit.title for hit in rag.hits]

        resources = [
            ResourceCard(
                resource_type=resource_type,
                title=self._build_title(resource_type),
                summary=self._build_summary(resource_type, request.course_code),
                content_markdown=self._build_markdown(resource_type, source_text),
                source_titles=source_titles,
                study_suggestion=self._build_study_suggestion(resource_type),
            )
            for resource_type in resource_types
        ]
        return ResourceGenerationResponse(
            recommended_order=[self._build_title(resource_type) for resource_type in resource_types],
            resources=resources,
        )

    @staticmethod
    def _build_title(resource_type: str) -> str:
        mapping = {
            "lecture_note": "课程讲义",
            "mind_map": "知识点思维导图说明",
            "quiz_set": "分层练习题",
            "extended_reading": "扩展阅读清单",
            "coding_lab": "代码实操作案例",
        }
        return mapping.get(resource_type, resource_type)

    @staticmethod
    def _build_summary(resource_type: str, course_code: str) -> str:
        mapping = {
            "lecture_note": f"基于 {course_code} 知识库整理的讲义概要",
            "mind_map": f"基于 {course_code} 知识库整理的知识结构",
            "quiz_set": f"围绕 {course_code} 核心知识点生成的练习建议",
            "extended_reading": f"围绕 {course_code} 延展的阅读建议",
            "coding_lab": f"围绕 {course_code} 设计的实践案例",
        }
        return mapping.get(resource_type, f"{course_code} 学习资源")

    @staticmethod
    def _build_markdown(resource_type: str, source_text: str) -> str:
        if resource_type == "mind_map":
            return (
                "# 思维导图说明\n\n"
                "建议按照“课程概览 -> 核心概念 -> 常见问题 -> 实践建议”的层次组织脑图。\n\n"
                f"{source_text}"
            )
        if resource_type == "quiz_set":
            return (
                "# 分层练习题建议\n\n"
                "- 基础题：概念辨析\n"
                "- 提升题：案例分析\n"
                "- 综合题：场景设计\n\n"
                f"{source_text}"
            )
        if resource_type == "coding_lab":
            return (
                "# 代码实操作案例\n\n"
                "建议以 Python + notebook 形式完成一个最小实验，并记录输入、训练、评估过程。\n\n"
                f"{source_text}"
            )
        return f"# 资源内容\n\n{source_text}"

    @staticmethod
    def _build_study_suggestion(resource_type: str) -> str:
        mapping = {
            "lecture_note": "先通读讲义，再把重点术语整理成自己的提纲。",
            "mind_map": "适合在复习阶段快速回顾知识结构。",
            "quiz_set": "建议先做基础题，再做综合题，最后回看错题。",
            "extended_reading": "适合作为课后延展，不建议替代核心教材。",
            "coding_lab": "建议边写边记录实验现象，保留可复现实验步骤。",
        }
        return mapping.get(resource_type, "建议结合课程目标分阶段使用该资源。")
