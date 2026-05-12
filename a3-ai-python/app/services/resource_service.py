from datetime import datetime, timezone

from fastapi import HTTPException

from app.core.constants import RESOURCE_TYPES
from app.db.repositories.resource_repository import ResourceRepository
from app.db.session import async_session_factory
from app.schemas.common import ResourceCard
from app.schemas.resource import (
    ResourceArchiveRequest,
    ResourceArchiveResponse,
    ResourceDownloadAccessResponse,
    ResourceFavoriteHistoryItem,
    ResourceFavoriteHistoryListResponse,
    ResourceFavoriteResponse,
    ResourceGenerationRequest,
    ResourceGenerationResponse,
    ResourceListResponse,
)


class ResourceService:
    async def generate_resources(
        self,
        request: ResourceGenerationRequest,
    ) -> ResourceGenerationResponse:
        resource_types = request.resource_types or RESOURCE_TYPES
        resources = await self._generate_resource_cards(request, resource_types)
        persisted_resources = await self._persist_resources(request, resources)
        return ResourceGenerationResponse(
            recommended_order=[item.title for item in persisted_resources],
            resources=persisted_resources,
        )

    async def list_resources(
        self,
        *,
        user_id: int,
        course_code: str | None = None,
        resource_type: str | None = None,
    ) -> ResourceListResponse:
        async with async_session_factory() as session:
            items, total = await ResourceRepository().list_resources(
                session,
                user_id=user_id,
                course_code=course_code,
                resource_type=resource_type,
            )
        return ResourceListResponse(items=[self._to_card(item) for item in items], total=total)

    async def list_archived_resources(
        self,
        *,
        user_id: int,
        course_code: str | None = None,
        resource_type: str | None = None,
    ) -> ResourceListResponse:
        async with async_session_factory() as session:
            items, total = await ResourceRepository().list_resources(
                session,
                user_id=user_id,
                course_code=course_code,
                resource_type=resource_type,
                archived_only=True,
            )
        return ResourceListResponse(items=[self._to_card(item) for item in items], total=total)

    async def get_resource(self, resource_id: int) -> ResourceCard:
        async with async_session_factory() as session:
            resource = await ResourceRepository().get_resource(session, resource_id)
            if resource is None:
                raise HTTPException(status_code=404, detail="resource not found")
            return self._to_card(resource)

    async def list_favorites(self, user_id: int) -> ResourceListResponse:
        async with async_session_factory() as session:
            resources = await ResourceRepository().list_favorites(session, user_id=user_id)
        return ResourceListResponse(items=[self._to_card(item) for item in resources], total=len(resources))

    async def list_favorite_history(self, user_id: int) -> ResourceFavoriteHistoryListResponse:
        async with async_session_factory() as session:
            items = await ResourceRepository().list_favorite_history(session, user_id=user_id)
        history_items = [
            ResourceFavoriteHistoryItem(
                resource_id=item.resource_id,
                user_id=item.user_id,
                action=item.action,
                created_at=item.created_at,
            )
            for item in items
        ]
        return ResourceFavoriteHistoryListResponse(items=history_items, total=len(history_items))

    async def favorite_resource(self, *, user_id: int, resource_id: int) -> ResourceFavoriteResponse:
        now = datetime.now(timezone.utc).isoformat()
        async with async_session_factory() as session:
            repo = ResourceRepository()
            resource = await repo.get_resource(session, resource_id)
            if resource is None:
                raise HTTPException(status_code=404, detail="resource not found")
            favorite = await repo.get_favorite(session, user_id=user_id, resource_id=resource_id)
            if favorite is None:
                await repo.create_favorite(
                    session,
                    user_id=user_id,
                    resource_id=resource_id,
                    created_at=now,
                    updated_at=now,
                )
                await repo.create_favorite_history(
                    session,
                    user_id=user_id,
                    resource_id=resource_id,
                    action="favorite",
                    created_at=now,
                    updated_at=now,
                )
                await session.commit()
        return ResourceFavoriteResponse(resource_id=resource_id, user_id=user_id, favorite=True)

    async def unfavorite_resource(self, *, user_id: int, resource_id: int) -> ResourceFavoriteResponse:
        now = datetime.now(timezone.utc).isoformat()
        async with async_session_factory() as session:
            repo = ResourceRepository()
            favorite = await repo.get_favorite(session, user_id=user_id, resource_id=resource_id)
            if favorite is not None:
                await repo.delete_favorite(session, favorite)
                await repo.create_favorite_history(
                    session,
                    user_id=user_id,
                    resource_id=resource_id,
                    action="unfavorite",
                    created_at=now,
                    updated_at=now,
                )
                await session.commit()
        return ResourceFavoriteResponse(resource_id=resource_id, user_id=user_id, favorite=False)

    async def archive_resource(self, resource_id: int, request: ResourceArchiveRequest) -> ResourceArchiveResponse:
        now = datetime.now(timezone.utc).isoformat()
        async with async_session_factory() as session:
            repo = ResourceRepository()
            resource = await repo.get_resource(session, resource_id)
            if resource is None:
                raise HTTPException(status_code=404, detail="resource not found")
            if resource.user_id != request.user_id:
                raise HTTPException(status_code=403, detail="resource archive forbidden")
            resource.is_archived = True
            resource.archived_at = now
            resource.archived_by = request.archived_by
            resource.archive_reason = request.reason
            resource.updated_at = now
            await session.commit()
        return ResourceArchiveResponse(
            resource_id=resource_id,
            archived=True,
            archived_by=request.archived_by,
            archive_reason=request.reason,
            archived_at=now,
        )

    async def get_download_access(self, *, user_id: int, resource_id: int) -> ResourceDownloadAccessResponse:
        async with async_session_factory() as session:
            resource = await ResourceRepository().get_resource(session, resource_id)
            if resource is None:
                raise HTTPException(status_code=404, detail="resource not found")

        if resource.is_archived:
            return ResourceDownloadAccessResponse(
                resource_id=resource_id,
                user_id=user_id,
                can_download=False,
                download_scope=resource.download_scope,
                reason="resource archived",
            )

        if resource.download_scope == "public" or resource.user_id == user_id:
            return ResourceDownloadAccessResponse(
                resource_id=resource_id,
                user_id=user_id,
                can_download=True,
                download_scope=resource.download_scope,
                reason="download allowed",
            )

        return ResourceDownloadAccessResponse(
            resource_id=resource_id,
            user_id=user_id,
            can_download=False,
            download_scope=resource.download_scope,
            reason="download restricted to owner",
        )

    async def _persist_resources(
        self,
        request: ResourceGenerationRequest,
        resources: list[ResourceCard],
    ) -> list[ResourceCard]:
        now = datetime.now(timezone.utc).isoformat()
        persisted: list[ResourceCard] = []
        async with async_session_factory() as session:
            repo = ResourceRepository()
            for item in resources:
                record = await repo.create_resource(
                    session,
                    user_id=request.user_id,
                    course_code=request.course_code,
                    resource_type=item.resource_type,
                    title=item.title,
                    summary=item.summary,
                    content_markdown=item.content_markdown,
                    source_titles=item.source_titles,
                    study_suggestion=item.study_suggestion,
                    generation_context={
                        "knowledge_points": request.knowledge_points,
                        "resource_types": request.resource_types,
                        "course_code": request.course_code,
                    },
                    created_at=now,
                    updated_at=now,
                )
                persisted.append(item.model_copy(update={"resource_id": record.id}))
            await session.commit()
        return persisted

    async def _generate_resource_cards(
        self,
        request: ResourceGenerationRequest,
        resource_types: list[str],
    ) -> list[ResourceCard]:
        generated = await self._generate_with_coordinator(request, resource_types)
        if generated:
            return generated

        source_text = self._build_fallback_source_text(request)
        source_titles = list(request.knowledge_points) or [request.course_code]
        return [
            ResourceCard(
                resource_type=resource_type,
                title=self._build_title(resource_type, request.course_code),
                summary=self._build_summary(resource_type, request.course_code, source_titles),
                content_markdown=self._build_markdown(resource_type, request.course_code, source_titles, source_text),
                source_titles=source_titles,
                study_suggestion=self._build_study_suggestion(resource_type),
            )
            for resource_type in resource_types
        ]

    async def _generate_with_coordinator(
        self,
        request: ResourceGenerationRequest,
        resource_types: list[str],
    ) -> list[ResourceCard]:
        mapped_types = self._map_resource_types_for_coordinator(resource_types)
        if not mapped_types:
            return []

        try:
            from app.agents.nodes.resource_generation.coordinator_agent import (
                ResourceGenerationCoordinator,
            )
        except ModuleNotFoundError:
            return []

        try:
            coordinator = ResourceGenerationCoordinator()
            result = await coordinator.coordinate_generation(
                knowledge_point=(request.knowledge_points or [request.course_code])[0],
                resource_types=mapped_types,
                student_profile={
                    "student_id": request.user_id,
                    "difficulty_level": 1,
                    "cognitive_style": "mixed",
                },
                course_context=request.course_code,
                related_knowledge=request.knowledge_points or None,
                programming_language="Python",
            )
        except Exception:
            return []

        result_items = result.get("results", {}) if isinstance(result, dict) else {}
        source_titles = list(request.knowledge_points) or [request.course_code]
        cards: list[ResourceCard] = []
        for resource_type in resource_types:
            result_key = self._get_result_key_for_resource_type(resource_type)
            item = result_items.get(result_key)
            if not isinstance(item, dict) or not item.get("success"):
                continue
            data = item.get("data") or {}
            cards.append(
                ResourceCard(
                    resource_type=resource_type,
                    title=self._coordinator_title(resource_type, request.course_code, data),
                    summary=self._coordinator_summary(resource_type, request.course_code, source_titles, data),
                    content_markdown=self._coordinator_content(resource_type, data),
                    source_titles=source_titles,
                    study_suggestion=data.get("study_suggestion") or self._build_study_suggestion(resource_type),
                )
            )
        return cards

    @staticmethod
    def _to_card(resource) -> ResourceCard:
        return ResourceCard(
            resource_id=resource.id,
            resource_type=resource.resource_type,
            title=resource.title,
            summary=resource.summary,
            content_markdown=resource.content_markdown,
            source_titles=list(resource.source_titles or []),
            study_suggestion=resource.study_suggestion,
        )

    @staticmethod
    def _build_title(resource_type: str, course_code: str) -> str:
        mapping = {
            "lecture_note": f"{course_code} 课程讲义",
            "lecture_notes": f"{course_code} 课程讲义",
            "mind_map": f"{course_code} 思维导图",
            "quiz_set": f"{course_code} 分层练习",
            "practice_set": f"{course_code} 分层练习",
            "extended_reading": f"{course_code} 延伸阅读",
            "coding_lab": f"{course_code} 编码实验",
            "case_study": f"{course_code} 案例拆解",
        }
        return mapping.get(resource_type, f"{course_code} 学习资源")

    @staticmethod
    def _build_summary(resource_type: str, course_code: str, source_titles: list[str]) -> str:
        focus = "、".join(source_titles[:3]) or course_code
        mapping = {
            "lecture_note": f"围绕 {focus} 整理的课程讲义，适合课前预习与课后复盘。",
            "lecture_notes": f"围绕 {focus} 整理的课程讲义，适合课前预习与课后复盘。",
            "mind_map": f"提炼 {focus} 的核心概念关系，便于快速串联知识结构。",
            "quiz_set": f"针对 {focus} 设计的分层练习，便于定位薄弱点。",
            "practice_set": f"针对 {focus} 设计的分层练习，便于定位薄弱点。",
            "extended_reading": f"补充 {focus} 的背景理解与扩展应用场景。",
            "coding_lab": f"通过实操任务巩固 {focus}，适合边学边练。",
            "case_study": f"结合 {focus} 拆解真实案例，帮助建立应用视角。",
        }
        return mapping.get(resource_type, f"{course_code} 学习资源")

    @staticmethod
    def _build_markdown(resource_type: str, course_code: str, source_titles: list[str], source_text: str) -> str:
        focus_lines = "\n".join(f"- {item}" for item in source_titles) or f"- {course_code}"
        if resource_type == "mind_map":
            return (
                f"# {course_code} 思维导图\n\n"
                "```mermaid\n"
                "mindmap\n"
                f"  root(({course_code}))\n"
                + "".join(f"    {item}\n" for item in source_titles[:5])
                + "```\n"
            )
        if resource_type in {"quiz_set", "practice_set"}:
            return (
                f"# {course_code} 分层练习\n\n"
                "## 基础题\n"
                f"1. 请解释“{source_titles[0] if source_titles else course_code}”的核心概念。\n\n"
                "## 进阶题\n"
                f"2. 结合 {course_code} 场景，说明相关知识点的应用方式。\n\n"
                "## 复盘提示\n"
                "- 记录错误原因\n- 总结易混淆概念\n"
            )
        if resource_type in {"coding_lab", "case_study"}:
            return (
                f"# {course_code} 实战案例\n\n"
                "## 任务背景\n"
                f"围绕以下知识点完成案例拆解或编码练习：\n{focus_lines}\n\n"
                "## 实施步骤\n"
                "1. 先梳理输入输出。\n2. 再拆分关键流程。\n3. 最后总结可复用经验。\n"
            )
        if resource_type == "extended_reading":
            return (
                f"# {course_code} 延伸阅读\n\n"
                "## 阅读目标\n"
                f"围绕以下主题扩展理解：\n{focus_lines}\n\n"
                "## 阅读建议\n"
                "1. 先阅读概念背景。\n2. 再对比典型应用。\n3. 最后输出自己的理解摘要。\n"
            )
        return f"# {course_code} 课程讲义\n\n{source_text}"

    @staticmethod
    def _build_study_suggestion(resource_type: str) -> str:
        mapping = {
            "lecture_note": "建议先快速通读，再按知识点回看。",
            "lecture_notes": "建议先快速通读，再按知识点回看。",
            "mind_map": "建议用于复盘章节结构和概念关系。",
            "quiz_set": "建议学完当日内容后立即练习。",
            "practice_set": "建议学完当日内容后立即练习。",
            "extended_reading": "建议在主线学习完成后扩展阅读。",
            "coding_lab": "建议边写边验证，及时记录错误原因。",
            "case_study": "建议先拆解案例结构，再抽取可迁移的方法。",
        }
        return mapping.get(resource_type, "建议结合当前学习目标分阶段使用。")

    @staticmethod
    def _map_resource_types_for_coordinator(resource_types: list[str]) -> list[int]:
        mapping = {
            "lecture_note": 1,
            "lecture_notes": 1,
            "mind_map": 2,
            "quiz_set": 3,
            "practice_set": 3,
            "extended_reading": 1,
            "coding_lab": 5,
            "case_study": 5,
        }
        values: list[int] = []
        for item in resource_types:
            value = mapping.get(item)
            if value is not None and value not in values:
                values.append(value)
        return values

    @staticmethod
    def _get_result_key_for_resource_type(resource_type: str) -> str:
        mapping = {
            "lecture_note": "document",
            "lecture_notes": "document",
            "mind_map": "mindmap",
            "quiz_set": "question_bank",
            "practice_set": "question_bank",
            "extended_reading": "document",
            "coding_lab": "code_example",
            "case_study": "code_example",
        }
        return mapping.get(resource_type, "document")

    @staticmethod
    def _coordinator_title(resource_type: str, course_code: str, data: dict) -> str:
        return str(data.get("title") or ResourceService._build_title(resource_type, course_code))

    @staticmethod
    def _coordinator_summary(
        resource_type: str,
        course_code: str,
        source_titles: list[str],
        data: dict,
    ) -> str:
        return str(
            data.get("summary")
            or data.get("description")
            or ResourceService._build_summary(resource_type, course_code, source_titles)
        )

    @staticmethod
    def _coordinator_content(resource_type: str, data: dict) -> str:
        if resource_type == "mind_map":
            return str(data.get("mermaid_code") or "")
        if resource_type in {"quiz_set", "practice_set"}:
            questions = data.get("questions")
            if isinstance(questions, list) and questions:
                lines = ["# 分层练习"]
                for index, item in enumerate(questions[:10], start=1):
                    question = item.get("question") or item.get("question_content") or ""
                    lines.append(f"{index}. {question}")
                return "\n\n".join(lines)
        if resource_type in {"coding_lab", "case_study"}:
            return str(data.get("code") or data.get("content_markdown") or data.get("description") or "")
        return str(data.get("content_markdown") or data.get("content") or data.get("description") or "")

    @staticmethod
    def _build_fallback_source_text(request: ResourceGenerationRequest) -> str:
        points = request.knowledge_points or [request.course_code]
        point_lines = "\n".join(f"- {item}" for item in points)
        return (
            f"## Course\n{request.course_code}\n\n"
            "## Knowledge Points\n"
            f"{point_lines}\n\n"
            "## Usage\n"
            "1. Review the concepts.\n"
            "2. Practice with the examples.\n"
            "3. Summarize mistakes and revisit weak points."
        )
