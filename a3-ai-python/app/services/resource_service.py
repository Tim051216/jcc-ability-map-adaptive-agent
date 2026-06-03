import asyncio
from datetime import datetime, timezone
from typing import ClassVar

from fastapi import HTTPException
from sqlalchemy import select

from app.core.constants import RESOURCE_TYPES
from app.db.base import Base
from app.db.models.generated_resource import GeneratedResource, ResourceFavorite, ResourceFavoriteHistory
from app.db.models.resource_source_file import ResourceSourceFile
from app.db.repositories.resource_repository import ResourceRepository
from app.db.session import async_session_factory, engine
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
from app.services.course_context_service import CourseContextService
from app.services.resource_source_file_service import ResourceSourceFileService


class ResourceService:
    _resource_cache: ClassVar[dict[int, ResourceCard]] = {}
    _favorite_cache: ClassVar[set[tuple[int, int]]] = set()
    _favorite_history_cache: ClassVar[list[dict[str, str | int | None]]] = []
    _archived_cache: ClassVar[dict[int, dict[str, str | int | None]]] = {}
    _resource_index_warmed: ClassVar[bool] = False
    _next_resource_id: ClassVar[int] = 1
    _builtin_video_resources: ClassVar[dict[int, ResourceCard]] = {
        900001: ResourceCard(
            resource_id=900001,
            resource_type="video",
            title="软件工程课程项目演示视频",
            summary="站内托管的课程项目演示视频，适合作为进入学习流程前的整体导览材料。",
            content_markdown="# 视频资源\n站内托管的课程项目演示视频，适合作为进入学习流程前的整体导览材料。",
            source_titles=["项目演示", "软件工程"],
            study_suggestion="建议先观看本视频，快速建立课程项目背景和整体业务场景认知。",
            source_file_count=1,
            source_files=[
                {
                    "file_id": 901,
                    "display_name": "project-demo.mp4",
                    "relative_path": "/videos/software-engineering-4th/project-demo.mp4",
                    "top_level_category": "视频",
                    "file_extension": ".mp4",
                    "mime_type": "video/mp4",
                    "file_size": 13631541,
                    "preview_text": "软件工程课程项目演示视频",
                    "is_inline_previewable": True,
                    "preview_mode": "video",
                    "preview_url": "/videos/software-engineering-4th/project-demo.mp4",
                    "open_url": "/videos/software-engineering-4th/project-demo.mp4",
                }
            ],
        ),
        900002: ResourceCard(
            resource_id=900002,
            resource_type="video",
            title="系统流程设计演示视频",
            summary="站内托管的流程建模演示视频，适合配合系统分析与设计章节一起学习。",
            content_markdown="# 视频资源\n站内托管的流程建模演示视频，适合配合系统分析与设计章节一起学习。",
            source_titles=["流程设计", "系统分析"],
            study_suggestion="建议在复习业务流程图、系统结构图或设计迁移关系时观看本视频。",
            source_file_count=1,
            source_files=[
                {
                    "file_id": 902,
                    "display_name": "visio-flow-demo.mp4",
                    "relative_path": "/videos/software-engineering-4th/visio-flow-demo.mp4",
                    "top_level_category": "视频",
                    "file_extension": ".mp4",
                    "mime_type": "video/mp4",
                    "file_size": 24477668,
                    "preview_text": "系统流程设计演示视频",
                    "is_inline_previewable": True,
                    "preview_mode": "video",
                    "preview_url": "/videos/software-engineering-4th/visio-flow-demo.mp4",
                    "open_url": "/videos/software-engineering-4th/visio-flow-demo.mp4",
                }
            ],
        ),
        900003: ResourceCard(
            resource_id=900003,
            resource_type="video",
            title="云端应用集成演示视频",
            summary="站内托管的系统集成演示视频，展示从前端到服务端的联动流程。",
            content_markdown="# 视频资源\n站内托管的系统集成演示视频，展示从前端到服务端的联动流程。",
            source_titles=["系统集成", "云端应用"],
            study_suggestion="建议在看完项目演示后继续观看，帮助理解端到端的系统集成顺序。",
            source_file_count=1,
            source_files=[
                {
                    "file_id": 903,
                    "display_name": "cloud-app-demo.mp4",
                    "relative_path": "/videos/software-engineering-4th/cloud-app-demo.mp4",
                    "top_level_category": "视频",
                    "file_extension": ".mp4",
                    "mime_type": "video/mp4",
                    "file_size": 78228810,
                    "preview_text": "云端应用集成演示视频",
                    "is_inline_previewable": True,
                    "preview_mode": "video",
                    "preview_url": "/videos/software-engineering-4th/cloud-app-demo.mp4",
                    "open_url": "/videos/software-engineering-4th/cloud-app-demo.mp4",
                }
            ],
        ),
    }

    async def generate_resources(
        self,
        request: ResourceGenerationRequest,
    ) -> ResourceGenerationResponse:
        course_context = await CourseContextService().resolve(
            course_id=request.course_id,
            course_code=request.course_code,
        )
        request = request.model_copy(
            update={
                "course_id": course_context.course_id,
                "course_code": course_context.course_code,
                "knowledge_points": self._normalize_knowledge_points(
                    request.knowledge_points,
                    course_context.course_code,
                ),
            }
        )
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
        course_id: int | None = None,
        course_code: str | None = None,
        resource_type: str | None = None,
    ) -> ResourceListResponse:
        resolved_course_code = course_code
        if course_id is not None:
            resolved_course_code = (
                await CourseContextService().resolve(course_id=course_id, course_code=course_code)
            ).course_code
        builtin_items = self._list_builtin_video_resources(
            course_code=resolved_course_code,
            resource_type=resource_type,
        )
        try:
            async with async_session_factory() as session:
                await self._ensure_seed_resources(
                    session=session,
                    user_id=user_id,
                    course_code=resolved_course_code,
                )
                items, total = await ResourceRepository().list_resources(
                    session,
                    user_id=user_id,
                    course_code=resolved_course_code,
                    resource_type=resource_type,
                )
            result_items = await self._hydrate_cards(
                items,
                preview_limit=ResourceSourceFileService.LIST_PREVIEW_FILE_LIMIT,
            )
            return ResourceListResponse(items=builtin_items + result_items, total=total + len(builtin_items))
        except Exception:
            return ResourceListResponse(items=builtin_items, total=len(builtin_items))

    async def list_archived_resources(
        self,
        *,
        user_id: int,
        course_id: int | None = None,
        course_code: str | None = None,
        resource_type: str | None = None,
    ) -> ResourceListResponse:
        resolved_course_code = course_code
        if course_id is not None:
            resolved_course_code = (
                await CourseContextService().resolve(course_id=course_id, course_code=course_code)
            ).course_code
        async with async_session_factory() as session:
            items, total = await ResourceRepository().list_resources(
                session,
                user_id=user_id,
                course_code=resolved_course_code,
                resource_type=resource_type,
                archived_only=True,
            )
        return ResourceListResponse(
            items=await self._hydrate_cards(
                items,
                preview_limit=ResourceSourceFileService.LIST_PREVIEW_FILE_LIMIT,
            ),
            total=total,
        )

    async def get_resource(self, resource_id: int) -> ResourceCard:
        builtin = self._builtin_video_resources.get(resource_id)
        if builtin is not None:
            return builtin
        async with async_session_factory() as session:
            await self._ensure_seed_resources(session=session, user_id=1001, course_code="software_engineering_4th")
            resource = await ResourceRepository().get_resource(session, resource_id)
            if resource is None:
                raise HTTPException(status_code=404, detail="resource not found")
            return await self._hydrate_card(resource, preview_limit=None)

    async def list_favorites(self, user_id: int) -> ResourceListResponse:
        async with async_session_factory() as session:
            await self._ensure_seed_resources(
                session=session,
                user_id=user_id,
                course_code="software_engineering_4th",
            )
            resources = await ResourceRepository().list_favorites(session, user_id=user_id)
        return ResourceListResponse(
            items=await self._hydrate_cards(
                resources,
                preview_limit=ResourceSourceFileService.LIST_PREVIEW_FILE_LIMIT,
            ),
            total=len(resources),
        )

    async def ensure_default_resource_index(self) -> None:
        async with async_session_factory() as session:
            await self._ensure_seed_resources(
                session=session,
                user_id=1001,
                course_code="software_engineering_4th",
            )
        await ResourceSourceFileService().prebuild_software_engineering_index()
        self.__class__._resource_index_warmed = True

    async def _ensure_seed_resources(self, *, session, user_id: int, course_code: str | None) -> None:
        normalized_course_code = (course_code or "").strip()
        if normalized_course_code not in {"software_engineering_4th", "se_practice_4th"}:
            return

        await self._ensure_resource_tables()

        existing_stmt = select(GeneratedResource.id).where(
            GeneratedResource.user_id == user_id,
            GeneratedResource.course_code == "software_engineering_4th",
        ).limit(1)
        existing = await session.execute(existing_stmt)
        if existing.scalar_one_or_none() is not None:
            return

        from scripts.init_real_local_data import build_software_engineering_seed_resources

        seed_resources = build_software_engineering_seed_resources()
        now = datetime.now(timezone.utc).isoformat()
        for resource in seed_resources:
            resource.user_id = user_id
            session.add(resource)

        session.add_all(
            [
                ResourceFavorite(
                    user_id=user_id,
                    resource_id=101,
                    category="软件工程导学",
                    notes="真实课程资料初始化收藏",
                    created_at=now,
                    updated_at=now,
                ),
                ResourceFavorite(
                    user_id=user_id,
                    resource_id=104,
                    category="实验实践",
                    notes="真实课程资料初始化收藏",
                    created_at=now,
                    updated_at=now,
                ),
                ResourceFavoriteHistory(
                    user_id=user_id,
                    resource_id=101,
                    action="favorite",
                    created_at=now,
                    updated_at=now,
                ),
                ResourceFavoriteHistory(
                    user_id=user_id,
                    resource_id=104,
                    action="favorite",
                    created_at=now,
                    updated_at=now,
                ),
            ]
        )
        await session.commit()

    async def _ensure_resource_tables(self) -> None:
        async with engine.begin() as conn:
            await conn.run_sync(
                lambda sync_conn: Base.metadata.create_all(
                    sync_conn,
                    tables=[
                        GeneratedResource.__table__,
                        ResourceFavorite.__table__,
                        ResourceFavoriteHistory.__table__,
                        ResourceSourceFile.__table__,
                    ],
                )
            )

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
                persisted_item = item.model_copy(update={"resource_id": record.id})
                persisted.append(persisted_item)
                self.__class__._resource_cache[record.id] = persisted_item
                self.__class__._next_resource_id = max(self.__class__._next_resource_id, record.id + 1)
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
            self._sanitize_card(
                ResourceCard(
                    resource_type=resource_type,
                    title=self._build_title(resource_type, request.course_code),
                    summary=self._build_summary(resource_type, request.course_code, source_titles),
                    content_markdown=self._build_markdown(resource_type, request.course_code, source_titles, source_text),
                    source_titles=source_titles,
                    study_suggestion=self._build_study_suggestion(resource_type),
                ),
                course_code=request.course_code,
                source_titles=source_titles,
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
            result = await asyncio.wait_for(
                coordinator.coordinate_generation(
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
                ),
                timeout=8,
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
                self._sanitize_card(
                    ResourceCard(
                        resource_type=resource_type,
                        title=self._coordinator_title(resource_type, request.course_code, data),
                        summary=self._coordinator_summary(resource_type, request.course_code, source_titles, data),
                        content_markdown=self._coordinator_content(resource_type, data),
                        source_titles=source_titles,
                        study_suggestion=data.get("study_suggestion") or self._build_study_suggestion(resource_type),
                    ),
                    course_code=request.course_code,
                    source_titles=source_titles,
                )
            )
        return cards

    @staticmethod
    def _to_card(resource) -> ResourceCard:
        return ResourceService._sanitize_card(
            ResourceCard(
                resource_id=resource.id,
                resource_type=resource.resource_type,
                title=resource.title,
                summary=resource.summary,
                content_markdown=resource.content_markdown,
                source_titles=list(resource.source_titles or []),
                study_suggestion=resource.study_suggestion,
            ),
            course_code=str(resource.course_code or ""),
            source_titles=list(resource.source_titles or []),
        )

    async def _hydrate_card(self, resource, preview_limit: int | None = None) -> ResourceCard:
        card = self._to_card(resource)
        source_file_service = ResourceSourceFileService()
        course_code = str(resource.course_code or "")
        source_files = await source_file_service.list_indexed_for_resource(
            resource_id=resource.id,
            course_code=course_code,
            limit=preview_limit,
        )
        source_file_count = len(source_files)

        if (
            course_code == "software_engineering_4th"
            and not source_files
            and preview_limit is not None
            and not self.__class__._resource_index_warmed
        ):
            await source_file_service.prebuild_software_engineering_index()
            self.__class__._resource_index_warmed = True
            source_files = await source_file_service.list_indexed_for_resource(
                resource_id=resource.id,
                course_code=course_code,
                limit=preview_limit,
            )
            source_file_count = len(source_files)

        if preview_limit is not None and course_code == "software_engineering_4th":
            source_file_count = await source_file_service.count_indexed_for_resource(
                resource_id=resource.id,
                course_code=course_code,
            )
        return ResourceCard(
            resource_id=card.resource_id,
            resource_type=card.resource_type,
            title=card.title,
            summary=card.summary,
            content_markdown=card.content_markdown,
            source_titles=card.source_titles,
            study_suggestion=card.study_suggestion,
            source_file_count=source_file_count,
            source_files=source_files,
        )

    async def _hydrate_cards(self, resources, preview_limit: int | None = None) -> list[ResourceCard]:
        resource_list = list(resources)
        if not resource_list:
            return []

        course_code = str(resource_list[0].course_code or "")
        source_file_service = ResourceSourceFileService()
        source_files_by_resource: dict[int, list] = {}
        source_counts_by_resource: dict[int, int] = {}

        if course_code == "software_engineering_4th":
            resource_ids = [int(resource.id) for resource in resource_list]
            source_files_by_resource = await source_file_service.list_indexed_for_resources(
                resource_ids=resource_ids,
                course_code=course_code,
                limit=preview_limit,
            )

            if (
                preview_limit is not None
                and not any(source_files_by_resource.get(resource_id) for resource_id in resource_ids)
                and not self.__class__._resource_index_warmed
            ):
                await source_file_service.prebuild_software_engineering_index()
                self.__class__._resource_index_warmed = True
                source_files_by_resource = await source_file_service.list_indexed_for_resources(
                    resource_ids=resource_ids,
                    course_code=course_code,
                    limit=preview_limit,
                )

            if preview_limit is not None:
                source_counts_by_resource = await source_file_service.count_indexed_for_resources(
                    resource_ids=resource_ids,
                    course_code=course_code,
                )

        cards: list[ResourceCard] = []
        for resource in resource_list:
            card = self._to_card(resource)
            source_files = source_files_by_resource.get(int(resource.id), [])
            source_file_count = source_counts_by_resource.get(int(resource.id), len(source_files))
            cards.append(
                ResourceCard(
                    resource_id=card.resource_id,
                    resource_type=card.resource_type,
                    title=card.title,
                    summary=card.summary,
                    content_markdown=card.content_markdown,
                    source_titles=card.source_titles,
                    study_suggestion=card.study_suggestion,
                    source_file_count=source_file_count,
                    source_files=source_files,
                )
            )
        return cards

    @classmethod
    def _list_builtin_video_resources(
        cls,
        *,
        course_code: str | None,
        resource_type: str | None,
    ) -> list[ResourceCard]:
        if resource_type and resource_type != "video":
            return []
        if course_code and course_code not in {"software_engineering_4th", "se_practice_4th"}:
            return []
        return list(cls._builtin_video_resources.values())

    @staticmethod
    def _sanitize_card(card: ResourceCard, *, course_code: str, source_titles: list[str]) -> ResourceCard:
        cleaned_sources = ResourceService._normalize_knowledge_points(source_titles, course_code)
        title = ResourceService._normalize_text(card.title)
        summary = ResourceService._normalize_text(card.summary)
        content_markdown = ResourceService._normalize_text(card.content_markdown)
        study_suggestion = ResourceService._normalize_text(card.study_suggestion) if card.study_suggestion else ""

        if ResourceService._looks_placeholder_text(title):
            title = ResourceService._build_title(card.resource_type, course_code)
        if ResourceService._looks_placeholder_text(summary):
            summary = ResourceService._build_summary(card.resource_type, course_code, cleaned_sources)
        if ResourceService._looks_placeholder_text(content_markdown):
            content_markdown = ResourceService._build_markdown(
                card.resource_type,
                course_code,
                cleaned_sources,
                ResourceService._build_fallback_source_text(
                    ResourceGenerationRequest(
                        user_id=0,
                        course_code=course_code,
                        knowledge_points=cleaned_sources,
                        resource_types=[card.resource_type],
                    )
                ),
            )
        if ResourceService._looks_placeholder_text(study_suggestion):
            study_suggestion = ResourceService._build_study_suggestion(card.resource_type)

        return ResourceCard(
            resource_id=card.resource_id,
            resource_type=card.resource_type,
            title=title,
            summary=summary,
            content_markdown=content_markdown,
            source_titles=cleaned_sources,
            study_suggestion=study_suggestion,
            source_file_count=card.source_file_count,
            source_files=card.source_files,
        )

    @staticmethod
    def _normalize_text(value: str | None) -> str:
        if not value:
            return ""
        return str(value).replace("\uFFFD", "").strip()

    @staticmethod
    def _looks_placeholder_text(value: str | None) -> bool:
        if not value:
            return True
        text = str(value).strip()
        lowered = text.lower()
        if not text:
            return True
        if any(token in lowered for token in ("????", "placeholder", "todo", "knowledge-point-")):
            return True
        if any(token in text for token in ("知识点1", "知识点2", "知识点3")):
            return True
        return text.count("?") >= 3

    @staticmethod
    def _normalize_knowledge_points(points: list[str] | None, course_code: str) -> list[str]:
        fallback_map = {
            "ml_intro": [
                "model evaluation",
                "supervised learning",
                "feature engineering",
                "learning workflow",
            ],
            "software_engineering_4th": [
                "software engineering fundamentals",
                "requirements analysis",
                "software design",
                "testing and project management",
            ],
        }
        cleaned: list[str] = []
        for point in points or []:
            normalized = ResourceService._normalize_text(point)
            if not normalized or ResourceService._looks_placeholder_text(normalized):
                continue
            if normalized not in cleaned:
                cleaned.append(normalized)
        if cleaned:
            return cleaned
        return fallback_map.get(course_code, [course_code or "general topic", "core concepts", "practice tasks"])

    @staticmethod
    def _course_label(course_code: str) -> str:
        labels = {
            "ml_intro": "Machine Learning Foundations",
            "software_engineering_4th": "Software Engineering Practice (4th Edition)",
        }
        return labels.get(course_code, course_code.replace("_", " ").title() if course_code else "Learning Course")

    @staticmethod
    def _build_title(resource_type: str, course_code: str) -> str:
        course_label = ResourceService._course_label(course_code)
        mapping = {
            "lecture_note": f"{course_label} Study Notes",
            "lecture_notes": f"{course_label} Study Notes",
            "mind_map": f"{course_label} Mind Map",
            "quiz_set": f"{course_label} Practice Set",
            "practice_set": f"{course_label} Practice Set",
            "extended_reading": f"{course_label} Extended Reading",
            "coding_lab": f"{course_label} Coding Lab",
            "case_study": f"{course_label} Case Study",
        }
        return mapping.get(resource_type, f"{course_label} Learning Resource")

    @staticmethod
    def _build_summary(resource_type: str, course_code: str, source_titles: list[str]) -> str:
        focus = ", ".join(source_titles[:3]) or ResourceService._course_label(course_code)
        mapping = {
            "lecture_note": f"Structured notes focused on {focus}, suitable for preview and review.",
            "lecture_notes": f"Structured notes focused on {focus}, suitable for preview and review.",
            "mind_map": f"A concise concept map that connects the key ideas in {focus}.",
            "quiz_set": f"Layered practice items built around {focus} to expose weak spots quickly.",
            "practice_set": f"Layered practice items built around {focus} to expose weak spots quickly.",
            "extended_reading": f"Supplementary reading that expands the context and applications of {focus}.",
            "coding_lab": f"Hands-on coding tasks that reinforce {focus} through implementation.",
            "case_study": f"A practical case walkthrough that shows how {focus} appears in context.",
        }
        return mapping.get(resource_type, f"Learning resources for {ResourceService._course_label(course_code)}.")

    @staticmethod
    def _build_markdown(resource_type: str, course_code: str, source_titles: list[str], source_text: str) -> str:
        focus_lines = "\n".join(f"- {item}" for item in source_titles) or f"- {course_code}"
        if resource_type == "mind_map":
            return (
                f"# {ResourceService._course_label(course_code)} Mind Map\n\n"
                "```mermaid\n"
                "mindmap\n"
                f"  root(({ResourceService._course_label(course_code)}))\n"
                + "".join(f"    {item}\n" for item in source_titles[:5])
                + "```\n"
            )
        if resource_type in {"quiz_set", "practice_set"}:
            return (
                f"# {ResourceService._course_label(course_code)} Practice Set\n\n"
                "## Core Question\n"
                f"1. Explain the core idea behind \"{source_titles[0] if source_titles else course_code}\".\n\n"
                "## Application Question\n"
                f"2. Describe how this concept can be applied in the context of {ResourceService._course_label(course_code)}.\n\n"
                "## Review Prompts\n"
                "- Record the mistakes you made.\n"
                "- Summarize the concepts that still feel unclear.\n"
            )
        if resource_type in {"coding_lab", "case_study"}:
            return (
                f"# {ResourceService._course_label(course_code)} Case Study\n\n"
                "## Focus Areas\n"
                f"{focus_lines}\n\n"
                "## Suggested Approach\n"
                "1. Clarify the inputs and expected outputs.\n"
                "2. Break the workflow into key steps.\n"
                "3. Summarize reusable patterns and decisions.\n"
            )
        if resource_type == "extended_reading":
            return (
                f"# {ResourceService._course_label(course_code)} Extended Reading\n\n"
                "## Reading Goals\n"
                f"{focus_lines}\n\n"
                "## Reading Guide\n"
                "1. Review the background and motivation.\n"
                "2. Compare typical applications.\n"
                "3. Write a short summary in your own words.\n"
            )
        return f"# {ResourceService._course_label(course_code)} Study Notes\n\n{source_text}"

    @staticmethod
    def _build_study_suggestion(resource_type: str) -> str:
        mapping = {
            "lecture_note": "Skim once first, then revisit the sections that matter most.",
            "lecture_notes": "Skim once first, then revisit the sections that matter most.",
            "mind_map": "Use this as a fast recap before or after a study session.",
            "quiz_set": "Try it right after the related lesson while the concepts are still fresh.",
            "practice_set": "Try it right after the related lesson while the concepts are still fresh.",
            "extended_reading": "Read this after the core lesson to widen your understanding.",
            "coding_lab": "Implement step by step and record mistakes as you go.",
            "case_study": "Break the case into structure, decisions, and reusable patterns.",
        }
        return mapping.get(resource_type, "Use this resource alongside the current learning objective.")

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
                lines = ["# Practice Set"]
                for index, item in enumerate(questions[:10], start=1):
                    question = item.get("question") or item.get("question_content") or ""
                    lines.append(f"{index}. {question}")
                return "\n\n".join(lines)
        if resource_type in {"coding_lab", "case_study"}:
            return str(data.get("code") or data.get("content_markdown") or data.get("description") or "")
        return str(data.get("content_markdown") or data.get("content") or data.get("description") or "")

    @staticmethod
    def _build_fallback_source_text(request: ResourceGenerationRequest) -> str:
        points = ResourceService._normalize_knowledge_points(request.knowledge_points, request.course_code or "")
        point_lines = "\n".join(f"- {item}" for item in points)
        return (
            f"## Course\n{ResourceService._course_label(request.course_code or '')}\n\n"
            "## Knowledge Points\n"
            f"{point_lines}\n\n"
            "## Usage\n"
            "1. Review the concepts.\n"
            "2. Practice with the examples.\n"
            "3. Summarize mistakes and revisit weak points."
        )
