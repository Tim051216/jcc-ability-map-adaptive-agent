from __future__ import annotations

import asyncio
import html
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, ClassVar
from types import SimpleNamespace
from urllib.parse import quote

from fastapi import HTTPException
from sqlalchemy import select

from app.core.constants import RESOURCE_TYPES
from app.db.base import Base
from app.db.models.generated_resource import GeneratedResource, ResourceFavorite, ResourceFavoriteHistory
from app.db.models.resource_source_file import ResourceSourceFile
from app.db.repositories.resource_repository import ResourceRepository
from app.db.session import ai_data_engine, ai_data_session_factory
from app.schemas.common import ResourceCard, ResourceSourceFileRef
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
from app.schemas.web_tools import WebSearchRequest
from app.services.course_context_service import CourseContextService
from app.services.guardrail_service import GuardrailContext, GuardrailService, GuardrailViolationError
from app.services.resource_source_file_service import ResourceSourceFileService
from app.services.web_tool_service import WebToolService


class ResourceService:
    FAST_SINGLE_RESOURCE_TYPES = {
        "extended_reading",
        "coding_lab",
        "visual_illustration",
        "micro_video",
        "subtitle_transcript",
        "ocr_notes",
    }

    _seed_course_aliases: ClassVar[dict[str, str]] = {
        "se_practice_4th": "software_engineering_4th",
    }
    _resource_cache: ClassVar[dict[int, ResourceCard]] = {}
    _favorite_cache: ClassVar[set[tuple[int, int]]] = set()
    _favorite_history_cache: ClassVar[list[dict[str, str | int | None]]] = []
    _archived_cache: ClassVar[dict[int, dict[str, str | int | None]]] = {}
    _resource_index_warmed: ClassVar[bool] = False
    _seed_resources_ensured: ClassVar[set[tuple[int, str]]] = set()
    _next_resource_id: ClassVar[int] = 1
    _local_seed_resources: ClassVar[dict[int, object] | None] = None
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
                    "preview_url": "/api/v1/resource/source-files/901/preview",
                    "open_url": "/api/v1/resource/source-files/901/open",
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
                    "preview_url": "/api/v1/resource/source-files/902/preview",
                    "open_url": "/api/v1/resource/source-files/902/open",
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
                    "preview_url": "/api/v1/resource/source-files/903/preview",
                    "open_url": "/api/v1/resource/source-files/903/open",
                }
            ],
        ),
        900004: ResourceCard(
            resource_id=900004,
            resource_type="document",
            title="软件工程界面素材参考图",
            summary="站内托管的界面图片样本，适合验证图片类资源的页内预览效果。",
            content_markdown="# 图片资源\n站内托管的界面图片样本，适合用于验证图片预览、画幅展示和资源切换效果。",
            source_titles=["界面素材", "图片预览"],
            study_suggestion="适合在资源预览页检查图片类资料的展示比例、留白和切换反馈。",
            source_file_count=1,
            source_files=[
                {
                    "file_id": 904,
                    "display_name": "software-engineering-ui-board.jpg",
                    "relative_path": "/preview-assets/software-engineering-ui-board.jpg",
                    "top_level_category": "图片",
                    "file_extension": ".jpg",
                    "mime_type": "image/jpeg",
                    "file_size": 310742,
                    "preview_text": "软件工程界面素材参考图",
                    "is_inline_previewable": True,
                    "preview_mode": "image",
                    "preview_url": "/api/v1/resource/source-files/904/preview",
                    "open_url": "/api/v1/resource/source-files/904/open",
                }
            ],
        ),
        900005: ResourceCard(
            resource_id=900005,
            resource_type="document",
            title="软件工程资源导览说明",
            summary="站内托管的纯文本资料样本，适合验证文本类资源的直读预览体验。",
            content_markdown="# 文本资源\n站内托管的纯文本资料样本，适合验证文本预览、换行排版和长文本滚动效果。",
            source_titles=["文本导览", "资源说明"],
            study_suggestion="适合检查文本类资源在预览页中的标题、段落节奏和滚动阅读表现。",
            source_file_count=1,
            source_files=[
                {
                    "file_id": 905,
                    "display_name": "software-engineering-preview-note.txt",
                    "relative_path": "/preview-assets/software-engineering-preview-note.txt",
                    "top_level_category": "文本",
                    "file_extension": ".txt",
                    "mime_type": "text/plain",
                    "file_size": 547,
                    "preview_text": "软件工程资源导览说明",
                    "is_inline_previewable": True,
                    "preview_mode": "text",
                    "preview_url": "/api/v1/resource/source-files/905/preview",
                    "open_url": "/api/v1/resource/source-files/905/open",
                }
            ],
        ),
    }

    async def generate_resources(
        self,
        request: ResourceGenerationRequest,
    ) -> ResourceGenerationResponse:
        guardrail_service = GuardrailService()
        course_context = await CourseContextService().resolve(
            course_id=request.course_id,
            course_code=request.course_code,
        )
        guardrail_context = GuardrailContext(
            scene="resource_generation",
            course_id=course_context.course_id,
            course_code=course_context.course_code,
            user_id=request.user_id,
        )
        request = request.model_copy(
            update={
                "course_id": course_context.course_id,
                "course_code": course_context.course_code,
            }
        )
        try:
            input_review = await guardrail_service.assert_safe_input(
                "\n".join(request.knowledge_points),
                context=guardrail_context,
            )
            resource_types = request.resource_types or RESOURCE_TYPES
            resources = await self._generate_resource_cards(request, resource_types)
            review = None
            if self._should_run_full_output_review(resource_types):
                review = await guardrail_service.review_output(
                    "\n".join([item.title + " " + item.summary + " " + item.content_markdown for item in resources]),
                    context=guardrail_context,
                    citations=request.knowledge_points,
                )
                if review.output_review and review.output_review.blocked:
                    resources = []
            persisted_resources = await self._persist_resources(request, resources)
            return ResourceGenerationResponse(
                recommended_order=[item.title for item in persisted_resources],
                resources=persisted_resources,
                safety_review={
                    "input_review": input_review.model_dump(mode="json"),
                    "output_review": review.output_review.model_dump(mode="json")
                    if review and review.output_review
                    else None,
                },
                hallucination_review=review.hallucination_review.model_dump(mode="json")
                if review and review.hallucination_review
                else None,
            )
        except GuardrailViolationError as exc:
            return ResourceGenerationResponse(
                recommended_order=[],
                resources=[],
                safety_review={"input_review": exc.review.model_dump(mode="json")},
                hallucination_review=None,
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
            async with ai_data_session_factory() as session:
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
            deduped_items = self._dedupe_generated_resources(items)
            result_items = await self._hydrate_cards(
                deduped_items,
                preview_limit=ResourceSourceFileService.LIST_PREVIEW_FILE_LIMIT,
            )
            return ResourceListResponse(items=builtin_items + result_items, total=len(result_items) + len(builtin_items))
        except Exception:
            fallback_items = await self._list_local_seed_resource_cards(
                course_code=resolved_course_code,
                resource_type=resource_type,
                preview_limit=ResourceSourceFileService.LIST_PREVIEW_FILE_LIMIT,
            )
            return ResourceListResponse(
                items=builtin_items + fallback_items,
                total=len(builtin_items) + len(fallback_items),
            )

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
        async with ai_data_session_factory() as session:
            items, total = await ResourceRepository().list_resources(
                session,
                user_id=user_id,
                course_code=resolved_course_code,
                resource_type=resource_type,
                archived_only=True,
            )
        deduped_items = self._dedupe_generated_resources(items)
        return ResourceListResponse(
            items=await self._hydrate_cards(
                deduped_items,
                preview_limit=ResourceSourceFileService.LIST_PREVIEW_FILE_LIMIT,
            ),
            total=len(deduped_items),
        )

    async def get_resource(self, resource_id: int) -> ResourceCard:
        builtin = self._builtin_video_resources.get(resource_id)
        if builtin is not None:
            return builtin
        try:
            async with ai_data_session_factory() as session:
                await self._ensure_seed_resources(session=session, user_id=1001, course_code="software_engineering_4th")
                resource = await ResourceRepository().get_resource(session, resource_id)
                if resource is None:
                    raise HTTPException(status_code=404, detail="resource not found")
                return await self._hydrate_card(resource, preview_limit=None)
        except HTTPException:
            raise
        except Exception:
            fallback = await self._get_local_seed_resource_card(resource_id=resource_id, preview_limit=None)
            if fallback is None:
                raise HTTPException(status_code=404, detail="resource not found")
            return fallback

    async def list_favorites(self, user_id: int) -> ResourceListResponse:
        async with ai_data_session_factory() as session:
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
        try:
            async with ai_data_session_factory() as session:
                await self._ensure_seed_resources(
                    session=session,
                    user_id=1001,
                    course_code="software_engineering_4th",
                )
        except Exception:
            pass
        await ResourceSourceFileService().prebuild_software_engineering_index()
        self.__class__._resource_index_warmed = True

    async def _ensure_seed_resources(self, *, session, user_id: int, course_code: str | None) -> None:
        normalized_course_code = self._normalize_seed_course_code(course_code)
        if normalized_course_code not in self._local_seed_course_codes():
            return
        ensure_key = (user_id, normalized_course_code)
        if ensure_key in self._seed_resources_ensured:
            return

        await self._ensure_resource_tables()

        existing_stmt = select(GeneratedResource.id).where(
            GeneratedResource.user_id == user_id,
            GeneratedResource.course_code == normalized_course_code,
        ).limit(1)
        existing = await session.execute(existing_stmt)
        if existing.scalar_one_or_none() is not None:
            self._seed_resources_ensured.add(ensure_key)
            return

        from scripts.init_real_local_data import (
            build_multi_course_seed_resources,
            build_software_engineering_seed_resources,
        )

        if normalized_course_code == "software_engineering_4th":
            seed_resources = build_software_engineering_seed_resources(user_id=user_id)
        else:
            seed_resources = [
                resource
                for resource in build_multi_course_seed_resources(user_id=user_id)
                if str(getattr(resource, "course_code", "")).strip() == normalized_course_code
            ]

        if not seed_resources:
            return

        now = datetime.now(timezone.utc).isoformat()
        persisted_seed_resources: list[GeneratedResource] = []
        for resource in seed_resources:
            duplicate_stmt = (
                select(GeneratedResource)
                .where(
                    GeneratedResource.user_id == user_id,
                    GeneratedResource.course_code == normalized_course_code,
                    GeneratedResource.resource_type == resource.resource_type,
                    GeneratedResource.title == resource.title,
                )
                .limit(1)
            )
            duplicate_result = await session.execute(duplicate_stmt)
            duplicate = duplicate_result.scalar_one_or_none()
            if duplicate is not None:
                persisted_seed_resources.append(duplicate)
                continue

            generated = GeneratedResource(
                user_id=user_id,
                course_code=normalized_course_code,
                resource_type=resource.resource_type,
                title=resource.title,
                summary=resource.summary,
                content_markdown=resource.content_markdown,
                source_titles=list(resource.source_titles or []),
                study_suggestion=resource.study_suggestion,
                generation_context=resource.generation_context,
                is_archived=bool(resource.is_archived),
                archived_at=resource.archived_at,
                archived_by=resource.archived_by,
                archive_reason=resource.archive_reason,
                download_scope=resource.download_scope,
                download_count=int(resource.download_count or 0),
                created_at=resource.created_at,
                updated_at=resource.updated_at,
            )
            session.add(generated)
            await session.flush()
            persisted_seed_resources.append(generated)

        primary_resource_id = int(persisted_seed_resources[0].id)
        secondary_resource_id = int(persisted_seed_resources[min(1, len(persisted_seed_resources) - 1)].id)
        primary_category, secondary_category = self._seed_favorite_categories(normalized_course_code)
        session.add_all(
            [
                ResourceFavorite(
                    user_id=user_id,
                    resource_id=primary_resource_id,
                    category=primary_category,
                    notes="真实课程资料初始化收藏",
                    created_at=now,
                    updated_at=now,
                ),
                ResourceFavorite(
                    user_id=user_id,
                    resource_id=secondary_resource_id,
                    category=secondary_category,
                    notes="真实课程资料初始化收藏",
                    created_at=now,
                    updated_at=now,
                ),
                ResourceFavoriteHistory(
                    user_id=user_id,
                    resource_id=primary_resource_id,
                    action="favorite",
                    created_at=now,
                    updated_at=now,
                ),
                ResourceFavoriteHistory(
                    user_id=user_id,
                    resource_id=secondary_resource_id,
                    action="favorite",
                    created_at=now,
                    updated_at=now,
                ),
            ]
        )
        await session.commit()
        self._seed_resources_ensured.add(ensure_key)

    async def _ensure_resource_tables(self) -> None:
        async with ai_data_engine.begin() as conn:
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
        async with ai_data_session_factory() as session:
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
        async with ai_data_session_factory() as session:
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
        async with ai_data_session_factory() as session:
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
        async with ai_data_session_factory() as session:
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
        try:
            async with ai_data_session_factory() as session:
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
                            "source_scene": "learnai_classroom_workspace",
                            "quality_version": "courseware_v2",
                            "persisted_to_library": True,
                            **(item.generation_context or {}),
                        },
                        created_at=now,
                        updated_at=now,
                    )
                    persisted_item = item.model_copy(
                        update={
                            "resource_id": record.id,
                            "generated_at": record.created_at or now,
                            "updated_at": record.updated_at or now,
                            "generation_context": record.generation_context,
                        }
                    )
                    persisted.append(persisted_item)
                    self.__class__._resource_cache[record.id] = persisted_item
                    self.__class__._next_resource_id = max(self.__class__._next_resource_id, record.id + 1)
                await session.commit()
        except Exception:
            for item in resources:
                resource_id = self.__class__._next_resource_id
                self.__class__._next_resource_id += 1
                persisted_item = item.model_copy(update={"resource_id": resource_id, "generated_at": now, "updated_at": now})
                persisted.append(persisted_item)
                self.__class__._resource_cache[resource_id] = persisted_item
        return persisted

    async def _generate_resource_cards(
        self,
        request: ResourceGenerationRequest,
        resource_types: list[str],
    ) -> list[ResourceCard]:
        source_titles = list(request.knowledge_points) or [request.course_code]
        generated_map: dict[str, ResourceCard] = {}
        if not self._should_use_fast_single_generation(resource_types):
            generated = await self._generate_with_coordinator(request, resource_types)
            generated_map = {card.resource_type: card for card in generated}

        source_text = self._build_fallback_source_text(request)
        web_reference_block = ""
        if not self._should_use_fast_single_generation(resource_types):
            web_reference_block = await self._build_web_reference_block(request)
        if web_reference_block:
            source_text = f"{source_text}\n\n{web_reference_block}".strip()

        cards: list[ResourceCard] = []
        for resource_type in resource_types:
            existing = generated_map.get(resource_type)
            if existing is not None:
                sanitized = self._sanitize_card(
                    existing,
                    course_code=request.course_code,
                    source_titles=source_titles,
                )
                cards.append(self._upgrade_classroom_resource_card(sanitized, request=request))
                continue
            fallback_card = self._build_fallback_card(
                resource_type=resource_type,
                course_code=request.course_code,
                source_titles=source_titles,
                source_text=source_text,
            )
            cards.append(self._upgrade_classroom_resource_card(fallback_card, request=request))
        return cards

    @staticmethod
    def _upgrade_classroom_resource_card(
        card: ResourceCard,
        *,
        request: ResourceGenerationRequest,
    ) -> ResourceCard:
        if card.resource_type not in {"lecture_note", "lecture_notes", "mindmap", "mind_map", "practice_set", "quiz_set", "ppt"}:
            return card

        source_titles = [
            str(item or "").strip()
            for item in request.knowledge_points
            if str(item or "").strip()
        ]
        if not source_titles:
            source_titles = ResourceService._normalize_knowledge_points(
                request.knowledge_points,
                request.course_code or "",
            )
        if len(source_titles) < 2:
            return card

        course_title = source_titles[0]
        section_title = source_titles[1]
        content_markdown = ResourceService._build_quality_recovery_content(
            resource_type=card.resource_type,
            course_code=request.course_code or "",
            source_titles=source_titles,
            draft_content=card.content_markdown,
        )
        kind_label = {
            "lecture_note": "讲义",
            "lecture_notes": "讲义",
            "mindmap": "导图",
            "mind_map": "导图",
            "practice_set": "练习",
            "quiz_set": "练习",
            "ppt": "PPT 草案",
        }.get(card.resource_type, "资料")
        summary_suffix = {
            "lecture_note": "包含学习目标、核心概念、任务拆解、易错点和课后自测。",
            "lecture_notes": "包含学习目标、核心概念、任务拆解、易错点和课后自测。",
            "mindmap": "包含中心主题、结构分支、上下游依赖、课堂场景和复习路线。",
            "mind_map": "包含中心主题、结构分支、上下游依赖、课堂场景和复习路线。",
            "practice_set": "包含单选、多选、判断和开放题，并附答案解析。",
            "quiz_set": "包含单选、多选、判断和开放题，并附答案解析。",
            "ppt": "包含 8 页课件结构、逐页讲稿、视觉建议和课堂互动设计。",
        }.get(card.resource_type, "已整理为可复用资料。")
        generation_context = dict(card.generation_context or {})
        generation_context.update(
            {
                "source_scene": "learnai_classroom_workspace",
                "quality_version": "courseware_v2",
                "course_title": course_title,
                "section_title": section_title,
                "persisted_to_library": True,
            }
        )
        return card.model_copy(
            update={
                "title": f"{course_title} · {section_title} {kind_label}",
                "summary": f"已按当前课堂章节生成高密度{kind_label}，{summary_suffix}",
                "content_markdown": content_markdown,
                "source_titles": source_titles,
                "study_suggestion": ResourceService._build_study_suggestion(card.resource_type),
                "generation_context": generation_context,
            }
        )

    async def _build_web_reference_block(self, request: ResourceGenerationRequest) -> str:
        query_seed = " ".join((request.knowledge_points or [])[:3]).strip()
        if not query_seed:
            query_seed = str(request.course_code or request.course_id or "").strip()
        if not query_seed:
            return ""

        search_query = f"{request.course_code or 'course'} {query_seed}"
        result = await WebToolService().websearch(
            WebSearchRequest(query=search_query, top_k=3, domain_whitelist=[])
        )
        if not result.items:
            return ""

        lines = ["## External References", ""]
        for item in result.items[:3]:
            fetched = await WebToolService().webfetch(item.url, max_chars=1200)
            snippet = fetched.content or item.snippet
            if not snippet:
                continue
            lines.append(f"### {fetched.title or item.title}")
            lines.append(f"Source: {item.url}")
            lines.append(snippet)
            lines.append("")
        return "\n".join(lines).strip()

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
            timeout_seconds = 12 if self._should_use_fast_single_generation(resource_types) else 40
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
                timeout=timeout_seconds,
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

    @classmethod
    def _should_use_fast_single_generation(cls, resource_types: list[str]) -> bool:
        normalized = [str(item or "").strip() for item in resource_types if str(item or "").strip()]
        return len(normalized) == 1 and normalized[0] in cls.FAST_SINGLE_RESOURCE_TYPES

    @classmethod
    def _should_run_full_output_review(cls, resource_types: list[str]) -> bool:
        return not cls._should_use_fast_single_generation(resource_types)

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
                generated_at=getattr(resource, "created_at", None),
                updated_at=getattr(resource, "updated_at", None),
                generation_context=getattr(resource, "generation_context", None),
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
        if not source_files and card.resource_type == "visual_illustration":
            source_files = [
                self._build_visual_illustration_source_file(
                    resource_id=int(resource.id),
                    course_code=course_code,
                    title=card.title,
                    summary=card.summary,
                    source_titles=card.source_titles,
                )
            ]
            source_file_count = 1
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
            generated_at=card.generated_at,
            updated_at=card.updated_at,
            generation_context=card.generation_context,
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
            if not source_files and card.resource_type == "visual_illustration":
                source_files = [
                    self._build_visual_illustration_source_file(
                        resource_id=int(resource.id),
                        course_code=str(resource.course_code or ""),
                        title=card.title,
                        summary=card.summary,
                        source_titles=card.source_titles,
                    )
                ]
                source_file_count = 1
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
                    generated_at=card.generated_at,
                    updated_at=card.updated_at,
                    generation_context=card.generation_context,
                )
            )
        return cards

    @staticmethod
    def _build_visual_illustration_source_file(
        *,
        resource_id: int,
        course_code: str,
        title: str,
        summary: str,
        source_titles: list[str],
    ) -> ResourceSourceFileRef:
        palette = (
            {"bg": "#eff6ff", "card": "#dbeafe", "line": "#2563eb", "accent": "#0f172a", "soft": "#93c5fd"}
            if course_code == "software_engineering_4th"
            else {"bg": "#fff7ed", "card": "#ffedd5", "line": "#ea580c", "accent": "#1f2937", "soft": "#fdba74"}
        )
        labels = [item for item in source_titles if str(item or "").strip()][:4]
        while len(labels) < 4:
            labels.append(["输入条件", "结构节点", "过程说明", "结果输出"][len(labels)])
        blueprint = "结构总览版" if any(token in title for token in ("架构", "结构", "系统")) else "讲义插图版"
        safe_title = html.escape(title or "AI 教学插图")
        safe_summary = html.escape(summary or "AI 教学插图预览")
        safe_labels = [html.escape(label) for label in labels]
        svg = f"""
<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="860" viewBox="0 0 1400 860">
  <rect width="1400" height="860" rx="40" fill="{palette['bg']}"/>
  <rect x="88" y="84" width="1224" height="692" rx="34" fill="white"/>
  <text x="124" y="150" font-size="38" font-family="Arial, sans-serif" font-weight="700" fill="{palette['accent']}">{safe_title}</text>
  <text x="124" y="194" font-size="19" font-family="Arial, sans-serif" fill="#475467">{safe_summary}</text>
  <rect x="1100" y="126" width="144" height="34" rx="17" fill="{palette['card']}"/>
  <text x="1172" y="148" text-anchor="middle" font-size="16" font-family="Arial, sans-serif" font-weight="700" fill="{palette['accent']}">{blueprint}</text>
  <rect x="124" y="256" width="270" height="144" rx="26" fill="{palette['card']}"/>
  <rect x="456" y="256" width="270" height="144" rx="26" fill="{palette['card']}"/>
  <rect x="788" y="256" width="270" height="144" rx="26" fill="{palette['card']}"/>
  <rect x="1120" y="256" width="124" height="144" rx="26" fill="{palette['card']}"/>
  <path d="M394 328 L456 328" stroke="{palette['line']}" stroke-width="10" stroke-linecap="round"/>
  <path d="M726 328 L788 328" stroke="{palette['line']}" stroke-width="10" stroke-linecap="round"/>
  <path d="M1058 328 L1120 328" stroke="{palette['line']}" stroke-width="10" stroke-linecap="round"/>
  <text x="150" y="306" font-size="22" font-family="Arial, sans-serif" font-weight="700" fill="{palette['accent']}">{safe_labels[0]}</text>
  <text x="482" y="306" font-size="22" font-family="Arial, sans-serif" font-weight="700" fill="{palette['accent']}">{safe_labels[1]}</text>
  <text x="814" y="306" font-size="22" font-family="Arial, sans-serif" font-weight="700" fill="{palette['accent']}">{safe_labels[2]}</text>
  <text x="1140" y="306" font-size="22" font-family="Arial, sans-serif" font-weight="700" fill="{palette['accent']}">{safe_labels[3]}</text>
  <rect x="124" y="472" width="1120" height="170" rx="28" fill="#f8fafc"/>
  <rect x="156" y="506" width="182" height="16" rx="8" fill="{palette['soft']}"/>
  <rect x="438" y="506" width="182" height="16" rx="8" fill="{palette['soft']}"/>
  <rect x="720" y="506" width="182" height="16" rx="8" fill="{palette['soft']}"/>
  <rect x="1002" y="506" width="182" height="16" rx="8" fill="{palette['soft']}"/>
  <text x="156" y="596" font-size="18" font-family="Arial, sans-serif" fill="#475467">推荐用途：讲义配图、课堂讲解、答辩结构说明、AI 导师流程解释</text>
</svg>
""".strip()
        public_url = ResourceService._ensure_visual_illustration_public_asset(
            resource_id=resource_id,
            course_code=course_code,
            svg=svg,
        )
        return ResourceSourceFileRef(
            file_id=resource_id,
            display_name=f"{title}.svg",
            relative_path=public_url,
            top_level_category="教学插图",
            file_extension=".svg",
            mime_type="image/svg+xml",
            file_size=len(svg.encode("utf-8")),
            preview_text="AI 生成教学插图",
            is_inline_previewable=True,
            preview_mode="image",
            preview_url=public_url,
            open_url=public_url,
        )

    @staticmethod
    def _ensure_visual_illustration_public_asset(*, resource_id: int, course_code: str, svg: str) -> str:
        repo_root = Path(__file__).resolve().parents[3]
        output_dir = repo_root / "a3-student-react-web" / "public" / "generated-resource-illustrations" / course_code
        output_dir.mkdir(parents=True, exist_ok=True)
        output_path = output_dir / f"{resource_id}.svg"
        output_path.write_text(svg, encoding="utf-8")
        return f"/generated-resource-illustrations/{course_code}/{resource_id}.svg"

    @staticmethod
    def _normalize_resource_type_key(resource_type: str | None) -> str:
        normalized = (resource_type or "").strip()
        if normalized in {"course_overview", "teaching_plan", "assessment_guide"}:
            return "lecture_note"
        if normalized == "mind_map":
            return "mindmap"
        if normalized == "quiz_set":
            return "practice_set"
        if normalized == "case_study":
            return "coding_lab"
        return normalized or "other"

    @classmethod
    def _build_generated_resource_key(cls, resource: GeneratedResource) -> str:
        title = (resource.title or "").strip().lower()
        resource_type = cls._normalize_resource_type_key(resource.resource_type)
        return f"{title}::{resource_type}"

    @classmethod
    def _dedupe_generated_resources(cls, resources: list[GeneratedResource]) -> list[GeneratedResource]:
        deduped: dict[str, GeneratedResource] = {}
        for resource in resources:
            key = cls._build_generated_resource_key(resource)
            if key not in deduped:
                deduped[key] = resource
        return list(deduped.values())

    @classmethod
    def _load_local_seed_resources(cls) -> dict[int, object]:
        if cls._local_seed_resources is not None:
            return cls._local_seed_resources

        from scripts.init_real_local_data import (
            build_multi_course_seed_resources,
            build_software_engineering_seed_resources,
        )

        resources: dict[int, object] = {}
        for resource in build_software_engineering_seed_resources():
            resources[int(resource.id)] = resource
        for resource in build_multi_course_seed_resources():
            resources[int(resource.id)] = resource
        cls._local_seed_resources = resources
        return resources

    @staticmethod
    def _normalize_resource_type(resource_type: str) -> str:
        mapping = {
            "mindmap": "mind_map",
            "lecture_notes": "lecture_note",
            "quiz_set": "practice_set",
        }
        return mapping.get(resource_type, resource_type)

    @staticmethod
    def _local_seed_course_codes() -> set[str]:
        return {
            "software_engineering_4th",
            "se_practice_4th",
            "ml_intro",
            "vue3_engineering",
            "llm_app_intro",
            "contest_project_lab",
            "spring_cloud_bootcamp",
        }

    @classmethod
    def _build_local_resource_model(cls, resource) -> object:
        course_code = cls._normalize_seed_course_code(str(getattr(resource, "course_code", "")).strip())
        title = cls._normalize_text(getattr(resource, "title", ""))
        summary = cls._normalize_text(getattr(resource, "summary", ""))
        content_markdown = cls._normalize_text(getattr(resource, "content_markdown", ""))
        study_suggestion = cls._normalize_text(getattr(resource, "study_suggestion", ""))
        source_titles = cls._normalize_knowledge_points(
            list(getattr(resource, "source_titles", []) or []),
            course_code,
        )
        resource_type = cls._normalize_resource_type(str(getattr(resource, "resource_type", "")))

        card = cls._sanitize_card(
            ResourceCard(
                resource_id=int(getattr(resource, "id")),
                resource_type=resource_type,
                title=title,
                summary=summary,
                content_markdown=content_markdown,
                source_titles=source_titles,
                study_suggestion=study_suggestion,
            ),
            course_code=course_code,
            source_titles=source_titles,
        )

        return SimpleNamespace(
            id=int(getattr(resource, "id")),
            user_id=int(getattr(resource, "user_id", 1001)),
            course_code=course_code,
            resource_type=card.resource_type,
            title=card.title,
            summary=card.summary,
            content_markdown=card.content_markdown,
            source_titles=card.source_titles,
            study_suggestion=card.study_suggestion,
        )

    async def _get_local_seed_resource_card(
        self,
        *,
        resource_id: int,
        preview_limit: int | None,
    ) -> ResourceCard | None:
        resource = self._load_local_seed_resources().get(resource_id)
        if resource is None:
            return None
        return await self._hydrate_card(
            self._build_local_resource_model(resource),
            preview_limit=preview_limit,
        )

    async def _list_local_seed_resource_cards(
        self,
        *,
        course_code: str | None,
        resource_type: str | None,
        preview_limit: int | None,
    ) -> list[ResourceCard]:
        if course_code and course_code not in self._local_seed_course_codes():
            return []

        normalized_type = self._normalize_resource_type(resource_type) if resource_type else None
        resources = []
        for resource in self._load_local_seed_resources().values():
            model = self._build_local_resource_model(resource)
            if course_code and model.course_code != self._normalize_seed_course_code(course_code):
                continue
            if normalized_type and model.resource_type != normalized_type:
                continue
            resources.append(model)

        resources.sort(key=lambda item: int(item.id))
        return await self._hydrate_cards(resources, preview_limit=preview_limit)

    @classmethod
    def _list_builtin_video_resources(
        cls,
        *,
        course_code: str | None,
        resource_type: str | None,
    ) -> list[ResourceCard]:
        normalized_course_code = cls._normalize_seed_course_code(course_code)
        if normalized_course_code and normalized_course_code != "software_engineering_4th":
            return []
        if not resource_type:
            return list(cls._builtin_video_resources.values())
        return [item for item in cls._builtin_video_resources.values() if item.resource_type == resource_type]

    @classmethod
    def _normalize_seed_course_code(cls, course_code: str | None) -> str:
        normalized = (course_code or "").strip()
        return cls._seed_course_aliases.get(normalized, normalized)

    @staticmethod
    def _seed_favorite_categories(course_code: str) -> tuple[str, str]:
        mapping = {
            "software_engineering_4th": ("软件工程导学", "实验实践"),
            "ml_intro": ("学习闭环", "联调检查"),
            "vue3_engineering": ("前端工程化", "状态边界"),
            "llm_app_intro": ("AI 应用", "多智能体"),
            "contest_project_lab": ("赛题拆解", "答辩演示"),
            "spring_cloud_bootcamp": ("微服务治理", "网关联调"),
        }
        return mapping.get(course_code, ("核心资料", "延伸资料"))

    @staticmethod
    def _sanitize_card(card: ResourceCard, *, course_code: str, source_titles: list[str]) -> ResourceCard:
        return ResourceService._ensure_card_quality(
            card,
            course_code=course_code,
            source_titles=source_titles,
        )

    @staticmethod
    def _build_fallback_card(
        resource_type: str,
        course_code: str,
        source_titles: list[str],
        source_text: str,
    ) -> ResourceCard:
        return ResourceService._ensure_card_quality(
            ResourceCard(
                resource_type=resource_type,
                title=ResourceService._build_title(resource_type, course_code),
                summary=ResourceService._build_summary(resource_type, course_code, source_titles),
                content_markdown=ResourceService._build_markdown(
                    resource_type,
                    course_code,
                    source_titles,
                    source_text,
                ),
                source_titles=source_titles,
                study_suggestion=ResourceService._build_study_suggestion(resource_type),
            ),
            course_code=course_code,
            source_titles=source_titles,
        )

    @staticmethod
    def _build_quality_recovery_content(
        resource_type: str,
        course_code: str,
        source_titles: list[str],
        draft_content: str | None = None,
    ) -> str:
        if resource_type in {"lecture_note", "lecture_notes"}:
            return ResourceService._build_high_quality_handout_markdown(course_code, source_titles, draft_content)
        if resource_type in {"mind_map", "mindmap"}:
            return ResourceService._build_high_quality_mindmap_markdown(course_code, source_titles, draft_content)
        if resource_type in {"quiz_set", "practice_set"}:
            questions = ResourceService._build_high_quality_practice_questions(course_code, source_titles)
            return json.dumps({"questions": questions}, ensure_ascii=False, indent=2)
        if resource_type in {"ppt", "teaching_plan"}:
            return ResourceService._build_high_quality_teaching_plan_markdown(course_code, source_titles, draft_content)
        if resource_type == "ocr_notes":
            fallback_request = ResourceGenerationRequest(
                user_id=0,
                course_code=course_code,
                knowledge_points=source_titles,
                resource_types=[resource_type],
            )
            return ResourceService._build_markdown(
                resource_type,
                course_code,
                source_titles,
                ResourceService._build_fallback_source_text(fallback_request),
            )
        fallback_request = ResourceGenerationRequest(
            user_id=0,
            course_code=course_code,
            knowledge_points=source_titles,
            resource_types=[resource_type],
        )
        source_text = ResourceService._build_fallback_source_text(fallback_request)
        cleaned_draft = ResourceService._normalize_text(draft_content)
        if cleaned_draft and len(cleaned_draft) >= 80:
            source_text = f"{source_text}\n\n## Model Draft\n{cleaned_draft[:1200].rstrip()}".strip()
        return ResourceService._build_markdown(resource_type, course_code, source_titles, source_text)

    @staticmethod
    def _build_high_quality_handout_markdown(
        course_code: str,
        source_titles: list[str],
        draft_content: str | None = None,
    ) -> str:
        course_label = ResourceService._course_label(course_code)
        focus_title = ResourceService._primary_focus_title(source_titles, course_code)
        se_profile = (
            ResourceService._software_engineering_profile(source_titles)
            if course_code == "software_engineering_4th"
            else None
        )
        theme = str(se_profile["theme"]) if se_profile else focus_title
        goal = str(se_profile["goal"]) if se_profile else f"理解 {focus_title} 的核心概念、流程与落地价值"
        upstream = list(se_profile["upstream"]) if se_profile else (source_titles[1:4] or [focus_title])
        structure = list(se_profile["structure"]) if se_profile else (source_titles[:4] or [focus_title])
        pitfalls = list(se_profile["pitfalls"]) if se_profile else ["概念边界不清", "忽略上下游关系", "缺少真实场景"]
        scene = str(se_profile["scene"]) if se_profile else f"结合 {course_label} 的课堂案例与项目任务理解"
        return (
            f"# {course_label} · {focus_title} 学习讲义\n\n"
            "## 本节定位\n"
            f"{theme} 是当前章节的主线内容。本节不只是记住术语，而是要回答三个问题：它为什么会出现、它解决什么问题、它如何影响后续分析、设计、测试或交付。\n\n"
            "## 学习目标\n"
            f"- 能用自己的话解释 {theme} 的核心目标：{goal}。\n"
            f"- 能把 {theme} 的关键结构、角色、流程或文档关系串成一条完整主线。\n"
            "- 能把知识点迁移到真实项目、课堂答辩或实验任务中，而不是停留在背定义。\n\n"
            "## 核心概念与边界\n"
            f"{theme} 的学习重点首先是边界判断。需要先分清“它负责什么”“它不负责什么”“它和相邻环节如何衔接”。只有边界清楚，做需求题、设计题、案例题时才不会把相邻概念混在一起。\n\n"
            "## 关键结构与流程\n"
            "建议按“背景 -> 目标 -> 结构 -> 输出”的顺序理解：\n"
            + "\n".join(f"- {item}" for item in structure)
            + "\n\n"
            "进一步复述时，要能说明每一项之间的因果关系：前一环节提供什么输入，后一环节为什么这样设计，最终如何服务课程目标与项目交付。\n\n"
            "## 上游依赖与前置认知\n"
            + "\n".join(f"- {item}" for item in upstream)
            + "\n\n"
            "如果这些前置点没有厘清，就容易在本节出现“知道名词但不会判断场景”的问题。\n\n"
            "## 课堂案例与项目落点\n"
            f"{scene}。讲述时建议先从“当前任务遇到了什么问题”切入，再说明 {theme} 在其中承担的职责，这样更容易把课堂知识转成答辩表达与项目分析能力。\n\n"
            "## 真实任务拆解\n"
            f"可以把 {theme} 放进一个小型任务里理解：先确认任务背景，再找出关键输入，接着画出处理过程，最后说明输出结果如何影响后续环节。这样学习时不会只停留在“会背定义”，而是能解释为什么这一步存在、如果省略它会带来什么风险。\n\n"
            "### 任务推进建议\n"
            f"1. 明确问题：当前章节为什么需要讨论 {theme}？\n"
            "2. 标出输入：学习或项目任务中有哪些已知条件、约束、角色或文档。\n"
            "3. 拆解过程：把关键结构拆成 3 到 5 个可解释节点。\n"
            "4. 验证输出：检查最终结论是否能支持后续分析、设计、实现、测试或答辩。\n\n"
            "## 易错点辨析\n"
            + "\n".join(f"- {item}" for item in pitfalls)
            + "\n\n"
            "## 对比记忆卡\n"
            f"| 维度 | {theme} 应该关注什么 | 常见误区 |\n"
            "| --- | --- | --- |\n"
            f"| 目标 | {goal} | 只记名词，不解释用途 |\n"
            "| 结构 | 说明模块、流程、输入输出和上下游关系 | 把所有概念并列罗列 |\n"
            f"| 场景 | {scene} | 脱离真实任务空谈定义 |\n"
            "| 评价 | 能讲清、能迁移、能做题 | 只看一遍觉得懂了 |\n\n"
            "## 掌握度检查清单\n"
            f"- 我能在 30 秒内说清 {theme} 解决什么问题。\n"
            "- 我能画出至少 3 个关键节点及它们之间的关系。\n"
            "- 我能举出一个课堂、实验、项目或答辩场景。\n"
            "- 我能指出至少 2 个易错点，并说明如何避免。\n"
            "- 我能基于这份讲义继续完成导图、练习和 PPT 表达。\n\n"
            "## 复习提纲\n"
            f"1. 先回答：{focus_title} 解决的核心问题是什么？\n"
            "2. 再画出关键结构、流程或角色之间的关系。\n"
            "3. 最后举一个真实课堂、实验或比赛项目中的应用场景，说明为什么必须这样做。\n"
            "4. 用练习题检验自己是否能从概念、结构和场景三个角度回答问题。\n\n"
            "## 课后自测\n"
            f"1. 请比较 {theme} 与相邻知识点的区别与联系。\n"
            "2. 如果缺少本节这一环，后续分析、设计、测试或管理会出现什么后果？\n"
            "3. 你会如何把本节内容用在自己的课程任务、系统设计或答辩表达中？"
        )

    @staticmethod
    def _build_high_quality_mindmap_markdown(
        course_code: str,
        source_titles: list[str],
        draft_content: str | None = None,
    ) -> str:
        course_label = ResourceService._course_label(course_code)
        focus_title = ResourceService._primary_focus_title(source_titles, course_code)
        se_profile = (
            ResourceService._software_engineering_profile(source_titles)
            if course_code == "software_engineering_4th"
            else None
        )
        theme = str(se_profile["theme"]) if se_profile else focus_title
        goal = str(se_profile["goal"]) if se_profile else f"理解 {focus_title} 解决的问题与使用边界"
        upstream = list(se_profile["upstream"]) if se_profile else (source_titles[1:4] or [focus_title])
        structure = list(se_profile["structure"]) if se_profile else (source_titles[:4] or [focus_title])
        pitfalls = list(se_profile["pitfalls"]) if se_profile else ["概念边界不清", "忽略上下游关系", "缺少真实落点"]
        scene = str(se_profile["scene"]) if se_profile else f"结合 {course_label} 的课堂案例或项目任务"
        return (
            f"# {course_label} · {focus_title} 章节知识导图\n\n"
            "```mermaid\n"
            "mindmap\n"
            f"  root(({theme}))\n"
            "    概念定位\n"
            f"      学习目标::{goal}\n"
            "      边界意识::先分清它解决什么和不解决什么\n"
            "    结构组成\n"
            + "".join(f"      {item}\n" for item in structure)
            + "    上游依赖\n"
            + "".join(f"      {item}\n" for item in upstream)
            + "    课堂场景\n"
            + f"      {scene}\n"
            + "    易错点\n"
            + "".join(f"      {item}\n" for item in pitfalls)
            + "    学习输出\n"
            + "      能复述主线\n"
            + "      能解释结构关系\n"
            + "      能迁移到项目情境\n"
            + "    评价证据\n"
            + "      讲义中能定位定义和边界\n"
            + "      练习中能解释答案依据\n"
            + "      PPT中能讲成完整故事\n"
            + "```\n\n"
            + "## 导图使用建议\n"
            + "1. 先看中心节点和一级分支，快速建立这一节的知识骨架。\n"
            + "2. 再顺着结构组成和上游依赖阅读，把知识点串成因果链。\n"
            + "3. 最后结合课堂场景和易错点，把导图转成答题与表达能力。\n\n"
            + "## 节点关系解读\n"
            + f"- 概念定位回答“{theme} 是什么、解决什么问题”。\n"
            + "- 结构组成回答“它由哪些关键部分构成、每部分承担什么职责”。\n"
            + "- 上游依赖回答“学习它之前需要先理解哪些前置条件”。\n"
            + "- 课堂场景回答“它在真实课程任务或项目里怎么落地”。\n"
            + "- 易错点回答“哪些判断最容易让理解偏离主线”。\n\n"
            + "## 推荐复习路线\n"
            + f"中心主题 -> 概念定位 -> 结构组成 -> 上游依赖 -> 课堂场景 -> 易错点 -> 学习输出。按这条路线复盘，能把 {theme} 从静态名词变成可解释、可迁移的知识结构。"
        )

    @staticmethod
    def _build_high_quality_teaching_plan_markdown(
        course_code: str,
        source_titles: list[str],
        draft_content: str | None = None,
    ) -> str:
        course_label = ResourceService._course_label(course_code)
        focus_title = ResourceService._primary_focus_title(source_titles, course_code)
        se_profile = (
            ResourceService._software_engineering_profile(source_titles)
            if course_code == "software_engineering_4th"
            else None
        )
        theme = str(se_profile["theme"]) if se_profile else focus_title
        goal = str(se_profile["goal"]) if se_profile else f"理解 {focus_title} 的核心概念与应用"
        structure = list(se_profile["structure"]) if se_profile else (source_titles[:4] or [focus_title])
        pitfalls = list(se_profile["pitfalls"]) if se_profile else ["概念边界不清", "结构关系混乱", "缺少实际落点"]
        scene = str(se_profile["scene"]) if se_profile else f"结合 {course_label} 的课堂案例或项目任务"
        slide_titles = [
            "封面页：课程与章节定位",
            "目标页：本节要解决什么问题",
            "概念页：核心定义与边界",
            "结构页：模块关系与流程",
            "案例页：课堂示例或项目场景",
            "互动页：课堂提问与即时检查",
            "复盘页：易错点与复习建议",
            "行动页：课后任务与后续资源",
        ]
        return (
            f"# {course_label} · {focus_title} PPT 草案\n\n"
            + "## 页面规划\n"
            + "\n".join(f"- {item}" for item in slide_titles)
            + "\n\n## 当前章节要点\n"
            + "\n".join(f"- {item}" for item in structure)
            + "\n\n## 逐页讲解脚本\n"
            + "### 第 1 页 封面页\n"
            + f"- 标题：{theme}\n"
            + f"- 副标题：围绕“{goal}”建立本节主线。\n"
            + f"- 开场话术：说明 {theme} 在 {course_label} 中的定位与价值。\n\n"
            + "### 第 2 页 目标页\n"
            + "- 目标 1：说清概念定义与边界。\n"
            + "- 目标 2：串起关键结构、流程或角色关系。\n"
            + "- 目标 3：能落到真实课堂案例或项目任务。\n\n"
            + "### 第 3 页 概念页\n"
            + f"- 核心定义：{theme} 的本质是“{goal}”。\n"
            + "- 对比提醒：配一组相邻概念辨析，避免学生混淆。\n"
            + "- 板书结构：是什么 / 不是什么 / 为什么重要。\n\n"
            + "### 第 4 页 结构页\n"
            + "".join(f"- 讲清 {item} 的职责、输入输出与上下游关系。\n" for item in structure)
            + "- 图示建议：优先使用流程图、模块图或角色协作图。\n\n"
            + "### 第 5 页 案例页\n"
            + f"- 场景描述：{scene}。\n"
            + "- 互动问题：如果缺少这一环，后续设计、测试或交付会出现什么问题？\n"
            + "- 展示重点：从真实任务中说明该知识点为何必要。\n\n"
            + "### 第 6 页 互动页\n"
            + f"- 课堂提问：如果没有 {theme}，后续任务会在哪一步出现偏差？\n"
            + "- 快速投票：学生选择最容易混淆的概念或流程节点。\n"
            + "- 小组讨论：用 1 个真实任务解释本页结构图中的关键箭头。\n\n"
            + "### 第 7 页 复盘页\n"
            + "".join(f"- 易错提醒：{item}\n" for item in pitfalls)
            + "- 复盘问题：这节课的定义、结构、场景和输出分别是什么？\n"
            + "- 课后任务：用自己的话复述本节主线，并举一个真实使用场景。\n\n"
            + "### 第 8 页 行动页\n"
            + "- 先阅读讲义，补齐概念边界和关键结构。\n"
            + "- 再查看导图，把节点关系转成复习路线。\n"
            + "- 最后完成练习，用答案解析定位薄弱点。\n"
            + "- 如果用于答辩，把本节讲成“问题 -> 结构 -> 场景 -> 价值”的完整故事。\n\n"
            + "## 讲解节奏\n"
            + "- 先抛出场景和问题，建立学生的学习动机。\n"
            + f"- 再围绕 {theme} 讲清概念、结构、流程与相互关系。\n"
            + "- 然后放入案例或项目片段，让学生看到真实落点。\n"
            + "- 最后用复盘页总结易错点，并衔接讲义和练习。\n\n"
            + "## 视觉设计建议\n"
            + "- 封面页使用一个强标题和课程标签，不堆正文。\n"
            + "- 结构页用流程图或模块图，箭头必须表达因果、依赖或输入输出关系。\n"
            + "- 案例页采用“场景截图占位 + 三条解释”的布局，避免纯文字。\n"
            + "- 复盘页使用错误清单和正确判断并列，对比感更强。\n\n"
            + "## 每页内容要求\n"
            + "- 每页只保留一个主信息点，避免堆字。\n"
            + "- 优先使用关键结论、步骤、对比和案例截图占位。\n"
            + "- 结尾页必须给出复习问题或课后任务，形成学习闭环。"
        )

    @staticmethod
    def _build_high_quality_practice_questions(
        course_code: str,
        source_titles: list[str],
    ) -> list[dict[str, Any]]:
        focus_title = ResourceService._primary_focus_title(source_titles, course_code)
        return [
            {
                "id": "practice-1",
                "question": "使用数组实现栈时，`top` 表示栈顶元素下标，容量为 `capacity`。执行 `push(x)` 前应优先判断哪一项？",
                "options": ["`top == capacity - 1`", "`top == -1`", "`x == 0`", "数组是否已经升序"],
                "answer": ["A"],
                "explanation": "数组栈容量固定，入栈前必须先判断栈满，否则 `top + 1` 后写入会造成数组越界。",
                "question_type": "single",
                "knowledge_tag": "数据结构：栈",
            },
            {
                "id": "practice-2",
                "question": "括号匹配、浏览器后退、函数调用栈这些场景共同依赖哪种访问规则？",
                "options": ["FIFO", "LIFO", "随机访问", "按 key 哈希访问"],
                "answer": ["B"],
                "explanation": "这些场景都要求后进入的数据先被处理，符合栈的 LIFO（Last In First Out）规则。",
                "question_type": "single",
                "knowledge_tag": "数据结构：栈",
            },
            {
                "id": "practice-3",
                "question": "下面哪些结构或场景符合队列的 FIFO 特性？",
                "options": ["打印任务排队", "消息队列消费", "广度优先搜索 BFS", "递归函数调用返回"],
                "answer": ["A", "B", "C"],
                "explanation": "队列强调先入先出，打印任务、消息消费和 BFS 都典型使用队列；递归调用返回更接近栈。",
                "question_type": "multiple",
                "knowledge_tag": "数据结构：队列",
            },
            {
                "id": "practice-4",
                "question": "对长度为 n 的无序数组进行线性查找，最坏情况下时间复杂度是多少？",
                "options": ["O(1)", "O(log n)", "O(n)", "O(n log n)"],
                "answer": ["C"],
                "explanation": "最坏情况下目标元素不存在或位于最后一个位置，需要检查 n 个元素，因此是 O(n)。",
                "question_type": "single",
                "knowledge_tag": "算法复杂度",
            },
            {
                "id": "practice-5",
                "question": "判断题：二分查找可以直接用于任意无序数组。",
                "options": ["正确", "错误"],
                "answer": ["B"],
                "explanation": "二分查找依赖有序性，只有在数据有序或能按单调关系排除一半搜索空间时才适用。",
                "question_type": "single",
                "knowledge_tag": "算法：二分查找",
            },
            {
                "id": "practice-6",
                "question": "阅读 Java 代码：`int[] a = {2, 4, 6}; System.out.println(a[2]);` 输出结果是什么？",
                "options": ["2", "4", "6", "数组越界"],
                "answer": ["C"],
                "explanation": "Java 数组下标从 0 开始，`a[2]` 访问第三个元素，输出 6。",
                "question_type": "single",
                "knowledge_tag": "Java 数组",
            },
            {
                "id": "practice-7",
                "question": "在 Java 中使用 `HashMap<String, Integer>` 统计单词出现次数时，最核心的操作是哪组？",
                "options": ["按 key 查询旧次数", "将新次数写回 key", "每次都排序整个数组", "用下标直接访问字符串地址"],
                "answer": ["A", "B"],
                "explanation": "词频统计的关键是根据单词 key 读取旧值，再把 `old + 1` 写回；不需要每次整体排序。",
                "question_type": "multiple",
                "knowledge_tag": "Java 集合",
            },
            {
                "id": "practice-8",
                "question": "数据库用户表中 `email` 字段要求不能重复，并且经常按邮箱登录查询，应该优先考虑什么设计？",
                "options": ["给 `email` 建唯一索引", "把邮箱字段改成更长的名字", "每次登录全表扫描", "删除主键"],
                "answer": ["A"],
                "explanation": "唯一索引既能约束邮箱不重复，也能提升按邮箱查询的效率。",
                "question_type": "single",
                "knowledge_tag": "数据库索引",
            },
            {
                "id": "practice-9",
                "question": "操作系统中，多个线程同时修改共享计数器，如果没有锁或原子操作，最可能出现什么问题？",
                "options": ["竞态条件", "DNS 解析失败", "SQL 语法错误", "数组自动扩容"],
                "answer": ["A"],
                "explanation": "共享变量并发读写缺少同步时，执行顺序不确定，可能导致结果丢失或不一致。",
                "question_type": "single",
                "knowledge_tag": "操作系统：线程同步",
            },
            {
                "id": "practice-10",
                "question": f"结合《{focus_title}》，请设计一个“小型在线题库”的核心数据结构或表结构，并说明至少 2 个关键字段为什么这样设计。",
                "options": [],
                "answer": [],
                "explanation": "参考思路：可从题目表、选项表、提交记录表展开，说明题目 id、知识点、题型、正确答案、用户答案、提交时间等字段的作用。",
                "question_type": "short",
                "knowledge_tag": "综合应用",
            },
        ]
        se_profile = (
            ResourceService._software_engineering_profile(source_titles)
            if course_code == "software_engineering_4th"
            else None
        )
        theme = str(se_profile["theme"]) if se_profile else focus_title
        goal = str(se_profile["goal"]) if se_profile else f"理解 {focus_title} 的核心目标"
        structure = list(se_profile["structure"]) if se_profile else [focus_title, "结构关系", "应用场景", "质量验证"]
        pitfalls = list(se_profile["pitfalls"]) if se_profile else ["概念边界不清", "忽略上下游关系", "缺少真实场景"]
        scene = str(se_profile["scene"]) if se_profile else f"将 {focus_title} 落到真实课堂或项目任务"
        return [
            {
                "id": "practice-1",
                "question": f"{theme} 在本章中的首要价值是什么？",
                "options": [
                    "让页面视觉效果更统一",
                    f"{goal}",
                    "减少所有沟通成本到零",
                    "替代后续设计与测试工作",
                ],
                "answer": ["B"],
                "explanation": f"{theme} 的核心不是装饰性改进，而是围绕“{goal}”建立可执行、可验证的工程主线。",
                "question_type": "single",
                "knowledge_tag": focus_title,
            },
            {
                "id": "practice-2",
                "question": f"围绕 {theme} 进行分析时，哪些内容属于应重点梳理的结构信息？",
                "options": [
                    structure[0],
                    "与课程无关的娱乐信息",
                    structure[1] if len(structure) > 1 else "关键流程",
                    structure[2] if len(structure) > 2 else "输入输出关系",
                ],
                "answer": ["A", "C", "D"],
                "explanation": "工程类知识点的掌握重点在于结构、流程和关系，而不是无关信息。",
                "question_type": "multiple",
                "knowledge_tag": focus_title,
            },
            {
                "id": "practice-3",
                "question": f"如果学习 {theme} 时只背术语、不看场景，最容易出现哪类问题？",
                "options": [
                    "更容易形成系统化理解",
                    "能直接提升交付质量",
                    "能够自动完成文档建模",
                    "遇到案例题时不知道如何判断边界和落点",
                ],
                "answer": ["D"],
                "explanation": "软件工程课程强调把概念放回真实场景中理解，否则一到案例题或答辩场景就容易失真。",
                "question_type": "single",
                "knowledge_tag": focus_title,
            },
            {
                "id": "practice-4",
                "question": f"下列哪一项最应该作为 {theme} 的课堂应用场景来讲述？",
                "options": [
                    scene,
                    "随机的界面配色调整",
                    "与章节主线无关的聊天语气选择",
                    "硬件品牌更新历史",
                ],
                "answer": ["A"],
                "explanation": "好的课堂应用场景应能直接解释该知识点为什么必要，以及它在项目里承担什么职责。",
                "question_type": "single",
                "knowledge_tag": focus_title,
            },
            {
                "id": "practice-5",
                "question": f"请结合当前课程，说出 {theme} 与相邻知识点的一个区别，并说明它在项目中的使用时机。",
                "options": [],
                "answer": [],
                "explanation": "这道开放题用于检查你是否能做概念辨析，并把知识点迁移到真实任务中。",
                "question_type": "short",
                "knowledge_tag": focus_title,
            },
            {
                "id": "practice-6",
                "question": f"如果你要复盘 {theme}，最应该优先检查哪些易错点？",
                "options": [
                    pitfalls[0],
                    pitfalls[1] if len(pitfalls) > 1 else "上下游关系不清",
                    "是否用了更鲜艳的配色",
                    pitfalls[2] if len(pitfalls) > 2 else "没有落到真实任务",
                ],
                "answer": ["A", "B", "D"],
                "explanation": "复盘时应优先排查概念边界、上下游关系和真实落点，这三类问题最影响理解质量。",
                "question_type": "multiple",
                "knowledge_tag": focus_title,
            },
            {
                "id": "practice-7",
                "question": f"请判断：只要能背出 {theme} 的定义，就说明已经掌握了本节内容。",
                "options": ["正确", "错误"],
                "answer": ["B"],
                "explanation": "掌握本节内容还需要能说明结构关系、使用边界、真实场景和常见误区，单纯背定义不足以支撑做题或答辩。",
                "question_type": "single",
                "knowledge_tag": "掌握标准",
            },
            {
                "id": "practice-8",
                "question": f"请用“问题 -> 结构 -> 场景 -> 价值”的顺序，为 {theme} 写一段 80 字以内的课堂总结。",
                "options": [],
                "answer": [],
                "explanation": "这道题训练表达能力。好的答案应先说明问题背景，再概括结构，最后落到真实场景和学习价值。",
                "question_type": "short",
                "knowledge_tag": "综合表达",
            },
        ]

    @staticmethod
    def _count_heading_lines(content: str) -> int:
        return sum(1 for line in content.splitlines() if line.strip().startswith("#"))

    @staticmethod
    def _looks_like_mermaid_mindmap(content: str) -> bool:
        lowered = content.lower()
        return "mindmap" in lowered and ("root((" in lowered or "\n    " in content or "\n  " in content)

    @staticmethod
    def _parse_question_payload(content: str) -> list[dict]:
        text = (content or "").strip()
        if not text:
            return []
        try:
            payload = json.loads(text)
        except Exception:
            return []
        if isinstance(payload, dict) and isinstance(payload.get("questions"), list):
            return [item for item in payload["questions"] if isinstance(item, dict)]
        return []

    @staticmethod
    def _has_high_quality_questions(content: str) -> bool:
        questions = ResourceService._parse_question_payload(content)
        if len(questions) < 10:
            return False
        unique_stems = {
            str(item.get("question") or item.get("question_content") or "").strip()
            for item in questions
            if str(item.get("question") or item.get("question_content") or "").strip()
        }
        if len(unique_stems) < 10:
            return False
        question_types = {
            str(item.get("question_type") or "").strip()
            for item in questions
            if str(item.get("question_type") or "").strip()
        }
        if len(question_types) < 3:
            return False
        answer_keys = {
            "|".join(str(answer).strip() for answer in (item.get("answer") or item.get("correct_answer") or []))
            if isinstance(item.get("answer") or item.get("correct_answer"), list)
            else str(item.get("answer") or item.get("correct_answer") or "").strip()
            for item in questions
            if str(item.get("question_type") or "").strip() not in {"short", "3"}
        }
        normalized_answer_keys = {item for item in answer_keys if item}
        if len(normalized_answer_keys) < 3:
            return False
        detailed_explanations = sum(
            1
            for item in questions
            if len(str(item.get("explanation") or item.get("answer_analysis") or "").strip()) >= 18
        )
        return detailed_explanations >= 4

    @staticmethod
    def _is_high_quality_content(resource_type: str, content_markdown: str | None) -> bool:
        text = (content_markdown or "").strip()
        if not text:
            return False

        if resource_type in {"lecture_note", "lecture_notes"}:
            required_markers = [
                "## 学习目标",
                "## 核心概念",
                "## 关键结构",
                "## 课堂场景",
                "## 易错点",
                "## 课后自测",
            ]
            return (
                len(text) >= 1200
                and ResourceService._count_heading_lines(text) >= 7
                and sum(1 for marker in required_markers if marker in text) >= 5
            )

        if resource_type in {"mind_map", "mindmap"}:
            non_empty_lines = [line for line in text.splitlines() if line.strip() and not line.strip().startswith("```")]
            return (
                len(text) >= 180
                and ResourceService._looks_like_mermaid_mindmap(text)
                and len(non_empty_lines) >= 8
            )

        if resource_type in {"quiz_set", "practice_set"}:
            return ResourceService._has_high_quality_questions(text)

        if resource_type in {"ppt", "teaching_plan"}:
            slide_markers = ("封面页", "目标页", "概念页", "结构页", "案例页", "复盘页")
            return (
                len(text) >= 800
                and "## 页面规划" in text
                and "## 每页内容要求" in text
                and sum(1 for marker in slide_markers if marker in text) >= 5
            )

        if resource_type == "ocr_notes":
            board_markers = ("真实板书生成稿", "OCR 识别文本", "黑板布局还原", "结构化板书笔记", "可直接抄写的板书版式")
            return len(text) >= 600 and sum(1 for marker in board_markers if marker in text) >= 4

        return len(text) >= 280

    @staticmethod
    def _ensure_card_quality(card: ResourceCard, *, course_code: str, source_titles: list[str]) -> ResourceCard:
        cleaned_sources = ResourceService._normalize_knowledge_points(source_titles, course_code)
        title = ResourceService._normalize_text(card.title)
        summary = ResourceService._normalize_text(card.summary)
        content_markdown = ResourceService._normalize_text(card.content_markdown)
        study_suggestion = ResourceService._normalize_text(card.study_suggestion) if card.study_suggestion else ""

        if ResourceService._looks_placeholder_text(title):
            title = ResourceService._build_title(card.resource_type, course_code)
        if ResourceService._looks_placeholder_text(summary):
            summary = ResourceService._build_summary(card.resource_type, course_code, cleaned_sources)
        if (
            ResourceService._looks_placeholder_text(content_markdown)
            or ResourceService._looks_too_brief_for_handout(card.resource_type, content_markdown)
            or not ResourceService._is_high_quality_content(card.resource_type, content_markdown)
        ):
            content_markdown = ResourceService._build_quality_recovery_content(
                resource_type=card.resource_type,
                course_code=course_code,
                source_titles=cleaned_sources,
                draft_content=content_markdown,
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
            generated_at=card.generated_at,
            updated_at=card.updated_at,
            generation_context=card.generation_context,
        )

    @staticmethod
    def _normalize_text(value: str | None) -> str:
        if not value:
            return ""
        text = str(value).replace("\uFFFD", "").strip()
        if not text:
            return ""

        repaired = ResourceService._repair_mojibake_text(text)
        return repaired.strip()

    @staticmethod
    def _looks_too_brief_for_handout(resource_type: str, content_markdown: str | None) -> bool:
        if resource_type not in {"lecture_note", "lecture_notes"}:
            return False
        text = (content_markdown or "").strip()
        if len(text) < 420:
            return True
        meaningful_lines = [line.strip() for line in text.splitlines() if line.strip()]
        return len(meaningful_lines) < 10

    @staticmethod
    def _repair_mojibake_text(value: str) -> str:
        text = str(value)
        suspicious_markers = ("Ã", "â", "æ", "ç", "è", "é", "ï", "鍙", "璧", "鏂", "褰", "鏈")
        if not any(marker in text for marker in suspicious_markers):
            return text

        candidates = [text]
        try:
            candidates.append(text.encode("latin1").decode("utf-8"))
        except Exception:
            pass
        try:
            candidates.append(text.encode("cp1252").decode("utf-8"))
        except Exception:
            pass

        def score(candidate: str) -> tuple[int, int]:
            mojibake_tokens = ("Ã", "â", "æ", "ç", "è", "é", "ï", "鍙", "璧", "鏂", "褰", "鏈", "�")
            penalty = sum(candidate.count(token) for token in mojibake_tokens)
            cjk = sum(1 for ch in candidate if "\u4e00" <= ch <= "\u9fff")
            return (penalty, -cjk)

        return min(candidates, key=score)

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
        if any(
            token in lowered
            for token in (
                "study notes",
                "learning resource",
                "practice set",
                "extended reading",
                "coding lab",
                "structured notes focused on",
                "layered practice items built around",
                "learning resources for",
                "use this resource alongside the current learning objective",
                "skim once first",
                "try it right after the related lesson",
            )
        ):
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
                "需求分析",
                "概要设计",
                "软件测试",
                "项目管理",
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
            "ml_intro": "机器学习导论",
            "software_engineering_4th": "软件工程与实践（第4版）",
        }
        return labels.get(course_code, course_code.replace("_", " ").title() if course_code else "学习课程")

    @staticmethod
    def _primary_focus_title(source_titles: list[str], course_code: str) -> str:
        cleaned = [item.strip() for item in source_titles if str(item).strip()]
        if not cleaned:
            return ResourceService._course_label(course_code)
        course_label = ResourceService._course_label(course_code)
        course_aliases = {
            course_label,
            course_label.replace("（第4版）", "").strip(),
            course_label.replace("(第4版)", "").strip(),
        }
        for item in cleaned:
            if item in course_aliases:
                continue
            if course_label in item and len(item) <= len(course_label) + 4:
                continue
            return item
        return cleaned[-1]

    @staticmethod
    def _software_engineering_profile(source_titles: list[str]) -> dict[str, object]:
        focus_title = ResourceService._primary_focus_title(source_titles, "software_engineering_4th")
        joined = " ".join(source_titles).lower()
        focus_lower = focus_title.lower()
        if "第一章" in focus_title or "软件工程基础" in focus_title or "软件危机" in focus_title:
            return {
                "theme": "软件工程基础与软件危机",
                "goal": "理解软件工程产生背景、软件危机成因，以及为什么必须用工程化方法组织开发",
                "upstream": ["业务目标", "项目复杂度增长", "团队协作与交付压力"],
                "structure": ["软件危机表现", "软件工程目标", "软件生命周期", "典型开发过程模型"],
                "pitfalls": ["把软件工程等同于编码实现", "只背软件危机概念不联系成本质量进度", "忽略过程、文档与协作价值"],
                "scene": "结合比赛项目解释为什么在动手开发前必须先明确目标、流程、角色和交付物",
            }
        if "第二章" in focus_title or "可行性分析" in focus_lower or "研发策划" in focus_title:
            return {
                "theme": "可行性分析与研发策划",
                "goal": "判断项目值不值得做、能不能做，以及如何安排资源、进度与团队启动",
                "upstream": ["业务需求", "用户痛点", "资源约束"],
                "structure": ["技术可行性", "经济可行性", "进度计划", "团队分工与风险"],
                "pitfalls": ["只谈想法不评估成本", "没有把时间与资源约束写清楚", "缺少风险预案和里程碑"],
                "scene": "围绕中国软件赛 A3 题拆解学生端、管理端、后端与演示材料的启动方案",
            }
        if "第三章" in focus_title or "需求分析" in focus_title or "文档建模" in focus_title:
            return {
                "theme": "需求分析与文档建模",
                "goal": "把用户目标转成可验证的功能需求、非功能需求与规范文档",
                "upstream": ["用户角色", "业务流程", "痛点场景"],
                "structure": ["需求获取", "需求整理", "用例与流程建模", "需求规格与验收条件"],
                "pitfalls": ["把口头诉求直接当系统需求", "忽略非功能需求", "缺少可验收、可追踪的文档表达"],
                "scene": "梳理岗位学情诊断、资源生成、测评反馈、监控页面等模块的角色边界与验收条件",
            }
        if "第四章" in focus_title or "项目管理" in focus_title or "软件设计" in focus_title or "测试" in focus_title:
            return {
                "theme": "软件设计、测试与项目管理",
                "goal": "把设计方案、质量验证和进度协同整合成可落地的交付体系",
                "upstream": ["需求规格", "系统边界", "交付目标"],
                "structure": ["总体设计", "详细设计", "测试验证", "进度与风险管理"],
                "pitfalls": ["设计只讲功能不讲边界", "测试只测正常流程", "项目推进缺少里程碑与验收复盘"],
                "scene": "面向当前项目梳理学生端、管理端、智能体服务和真实数据链路的交付闭环",
            }
        if any(token in joined for token in ("需求", "requirement", "use case", "用例")):
            return {
                "theme": "需求分析",
                "goal": "澄清用户目标、业务边界和功能优先级",
                "upstream": ["业务场景", "用户角色", "现状问题"],
                "structure": ["需求获取", "需求建模", "需求验证", "需求变更控制"],
                "pitfalls": ["把用户诉求直接当系统需求", "忽略非功能需求", "没有明确验收标准"],
                "scene": "面向教学平台或管理系统梳理角色、功能边界与验收条件",
            }
        if any(token in joined for token in ("设计", "架构", "模块", "概要")):
            return {
                "theme": "软件设计",
                "goal": "完成模块划分、接口设计和高内聚低耦合的结构组织",
                "upstream": ["需求模型", "系统边界", "质量属性"],
                "structure": ["架构分层", "模块职责", "接口协作", "数据流转"],
                "pitfalls": ["模块职责不清", "接口粒度失衡", "只看功能不看可维护性"],
                "scene": "围绕学习平台拆分学生端、管理端、智能体服务和数据支撑模块",
            }
        if any(token in joined for token in ("测试", "缺陷", "test", "bug")):
            return {
                "theme": "软件测试",
                "goal": "覆盖关键业务流程，定位缺陷并验证回归质量",
                "upstream": ["需求规格", "设计说明", "风险点"],
                "structure": ["测试分层", "用例设计", "缺陷跟踪", "回归验证"],
                "pitfalls": ["只测正常路径", "缺少边界条件", "修复后不做回归"],
                "scene": "针对课程生成、测评反馈、岗位学情回写等流程做端到端测试",
            }
        if any(token in joined for token in ("项目", "进度", "管理", "计划")):
            return {
                "theme": "项目管理",
                "goal": "平衡范围、进度、质量与协作效率",
                "upstream": ["项目目标", "里程碑", "角色分工"],
                "structure": ["任务拆解", "进度跟踪", "风险管理", "验收复盘"],
                "pitfalls": ["目标过大不拆解", "风险不前置", "没有明确交付标准"],
                "scene": "围绕比赛项目统筹学生端、管理端、后端服务和演示材料交付",
            }
        return {
            "theme": "软件工程核心主题",
            "goal": "把概念、结构与真实项目落点串成完整主线",
            "upstream": ["业务目标", "系统边界", "实现约束"],
            "structure": ["概念边界", "结构关系", "实现路径", "质量校验"],
            "pitfalls": ["只背术语", "忽略上下游依赖", "缺少场景迁移"],
            "scene": "结合比赛项目梳理学习闭环、智能体协同和系统落地方式",
        }

    @staticmethod
    def _build_title(resource_type: str, course_code: str) -> str:
        course_label = ResourceService._course_label(course_code)
        mapping = {
            "lecture_note": f"{course_label} \u8bfe\u5802\u8bb2\u4e49",
            "lecture_notes": f"{course_label} \u8bfe\u5802\u8bb2\u4e49",
            "mind_map": f"{course_label} \u77e5\u8bc6\u5bfc\u56fe",
            "mindmap": f"{course_label} \u77e5\u8bc6\u5bfc\u56fe",
            "quiz_set": f"{course_label} \u968f\u5802\u7ec3\u4e60",
            "practice_set": f"{course_label} \u968f\u5802\u7ec3\u4e60",
            "ppt": f"{course_label} PPT \u8349\u6848",
            "course_overview": f"{course_label} \u8bfe\u7a0b\u603b\u89c8",
            "teaching_plan": f"{course_label} \u8bfe\u4ef6\u8349\u6848",
            "extended_reading": f"{course_label} \u62d3\u5c55\u9605\u8bfb",
            "coding_lab": f"{course_label} \u5b9e\u64cd\u4f5c\u4e1a",
            "case_study": f"{course_label} \u6848\u4f8b\u62c6\u89e3",
            "visual_illustration": f"{course_label} \u6559\u5b66\u63d2\u56fe",
            "micro_video": f"{course_label} \u52a8\u753b\u5206\u955c",
            "subtitle_transcript": f"{course_label} \u8bfe\u5802\u5b57\u5e55",
            "ocr_notes": f"{course_label} \u771f\u5b9e\u677f\u4e66\u751f\u6210\u7a3f",
        }
        return mapping.get(resource_type, f"{course_label} \u5b66\u4e60\u8d44\u6599")

    @staticmethod
    def _build_summary(resource_type: str, course_code: str, source_titles: list[str]) -> str:
        focus = "\u3001".join(source_titles[:3]) or ResourceService._course_label(course_code)
        mapping = {
            "lecture_note": f"\u56f4\u7ed5 {focus} \u6574\u7406\u8bfe\u5802\u8bb2\u4e49\uff0c\u8865\u8db3\u6982\u5ff5\u4e3b\u7ebf\u3001\u6613\u9519\u70b9\u548c\u590d\u4e60\u63d0\u7eb2\uff0c\u9002\u5408\u8ddf\u5b66\u4e0e\u8bfe\u540e\u56de\u770b\u3002",
            "lecture_notes": f"\u56f4\u7ed5 {focus} \u6574\u7406\u8bfe\u5802\u8bb2\u4e49\uff0c\u8865\u8db3\u6982\u5ff5\u4e3b\u7ebf\u3001\u6613\u9519\u70b9\u548c\u590d\u4e60\u63d0\u7eb2\uff0c\u9002\u5408\u8ddf\u5b66\u4e0e\u8bfe\u540e\u56de\u770b\u3002",
            "mind_map": f"\u63d0\u70bc {focus} \u7684\u6838\u5fc3\u8282\u70b9\u3001\u5c42\u7ea7\u5173\u7cfb\u4e0e\u5b66\u4e60\u8def\u5f84\uff0c\u9002\u5408\u5148\u603b\u89c8\u540e\u7cbe\u8bfb\u3002",
            "mindmap": f"\u63d0\u70bc {focus} \u7684\u6838\u5fc3\u8282\u70b9\u3001\u5c42\u7ea7\u5173\u7cfb\u4e0e\u5b66\u4e60\u8def\u5f84\uff0c\u9002\u5408\u5148\u603b\u89c8\u540e\u7cbe\u8bfb\u3002",
            "quiz_set": f"\u56f4\u7ed5 {focus} \u751f\u6210\u5206\u5c42\u7ec3\u4e60\u4e0e\u7b54\u6848\u89e3\u6790\uff0c\u5e2e\u52a9\u5b9a\u4f4d\u8584\u5f31\u70b9\u548c\u5e38\u89c1\u8bef\u533a\u3002",
            "practice_set": f"\u56f4\u7ed5 {focus} \u751f\u6210\u5206\u5c42\u7ec3\u4e60\u4e0e\u7b54\u6848\u89e3\u6790\uff0c\u5e2e\u52a9\u5b9a\u4f4d\u8584\u5f31\u70b9\u548c\u5e38\u89c1\u8bef\u533a\u3002",
            "ppt": f"\u5df2\u6309\u6388\u8bfe\u8282\u594f\u62c6\u89e3 {focus} \u7684 PPT \u9875\u9762\u7ed3\u6784\uff0c\u5305\u542b\u76ee\u6807\u9875\u3001\u8bb2\u89e3\u9875\u3001\u6848\u4f8b\u9875\u4e0e\u590d\u76d8\u9875\u3002",
            "course_overview": f"\u4ece\u8bfe\u7a0b\u76ee\u6807\u3001\u6838\u5fc3\u6a21\u5757\u548c\u5e94\u7528\u573a\u666f\u4e09\u4e2a\u7ef4\u5ea6\u6982\u89c8 {focus}\u3002",
            "teaching_plan": f"\u5df2\u6309\u6388\u8bfe\u8282\u594f\u62c6\u89e3 {focus} \u7684 PPT \u9875\u9762\u7ed3\u6784\uff0c\u5305\u542b\u76ee\u6807\u9875\u3001\u8bb2\u89e3\u9875\u3001\u6848\u4f8b\u9875\u4e0e\u590d\u76d8\u9875\u3002",
            "extended_reading": f"\u8865\u5145 {focus} \u7684\u80cc\u666f\u3001\u5e94\u7528\u4e0e\u5ef6\u4f38\u601d\u8003\uff0c\u9002\u5408\u62d3\u5c55\u9605\u8bfb\u3002",
            "coding_lab": f"\u901a\u8fc7\u5b9e\u64cd\u4f5c\u4e1a\u5de9\u56fa {focus} \u7684\u5173\u952e\u65b9\u6cd5\u4e0e\u843d\u5730\u6d41\u7a0b\u3002",
            "case_study": f"\u7ed3\u5408\u6848\u4f8b\u62c6\u89e3 {focus} \u7684\u5206\u6790\u8def\u5f84\u3001\u5173\u952e\u51b3\u7b56\u4e0e\u5e38\u89c1\u8bef\u533a\u3002",
            "visual_illustration": f"\u56f4\u7ed5 {focus} \u751f\u6210\u7ed3\u6784\u793a\u610f\u3001\u6d41\u7a0b\u62c6\u56fe\u4e0e\u8bfe\u5802\u914d\u56fe\uff0c\u65b9\u4fbf\u5feb\u901f\u770b\u61c2\u6982\u5ff5\u5173\u7cfb\u3002",
            "micro_video": f"\u56f4\u7ed5 {focus} \u751f\u6210\u53ef\u76f4\u63a5\u8f6c\u6210\u77ed\u89c6\u9891\u7684\u8bb2\u89e3\u811a\u672c\u3001\u955c\u5934\u8282\u594f\u4e0e\u5206\u955c\u8bf4\u660e\u3002",
            "subtitle_transcript": f"\u56f4\u7ed5 {focus} \u751f\u6210\u8bfe\u5802\u8bb2\u89e3\u5b57\u5e55\u7a3f\u3001\u65f6\u95f4\u8f74\u6458\u8981\u4e0e\u91cd\u70b9\u63d0\u793a\uff0c\u4fbf\u4e8e\u8fb9\u770b\u8fb9\u5b66\u3002",
            "ocr_notes": f"\u56f4\u7ed5 {focus} \u751f\u6210\u771f\u5b9e\u677f\u4e66\u751f\u6210\u7a3f\u3001OCR \u8bc6\u522b\u6587\u672c\u3001\u9ed1\u677f\u5e03\u5c40\u8fd8\u539f\u4e0e\u7ed3\u6784\u5316\u8bfe\u5802\u7b14\u8bb0\uff0c\u65b9\u4fbf\u5feb\u901f\u590d\u76d8\u3002",
        }
        return mapping.get(resource_type, f"\u5df2\u56f4\u7ed5 {ResourceService._course_label(course_code)} \u751f\u6210\u53ef\u76f4\u63a5\u4f7f\u7528\u7684\u5b66\u4e60\u8d44\u6599\u3002")

    @staticmethod
    def _build_markdown(resource_type: str, course_code: str, source_titles: list[str], source_text: str) -> str:
        course_label = ResourceService._course_label(course_code)
        focus_lines = "\n".join(f"- {item}" for item in source_titles) or f"- {course_label}"
        focus_title = ResourceService._primary_focus_title(source_titles, course_code)
        related_topics = source_titles[1:4]
        related_block = "\n".join(f"- {item}" for item in related_topics) or "- \u6682\u65e0\u66f4\u591a\u4e0a\u6e38\u77e5\u8bc6\u70b9\uff0c\u5efa\u8bae\u7ed3\u5408\u8bfe\u7a0b\u76ee\u5f55\u7ee7\u7eed\u8865\u5145\u3002"
        source_excerpt = (source_text or "").strip()
        se_profile = (
            ResourceService._software_engineering_profile(source_titles)
            if course_code == "software_engineering_4th"
            else None
        )
        profile_theme = str(se_profile["theme"]) if se_profile else focus_title
        profile_goal = str(se_profile["goal"]) if se_profile else f"明确 {focus_title} 解决什么问题"
        profile_scene = str(se_profile["scene"]) if se_profile else f"对应到 {course_label} 的课堂案例或项目任务"
        profile_upstream = "\n".join(f"- {item}" for item in (se_profile["upstream"] if se_profile else related_topics)) or related_block
        profile_structure = "\n".join(f"- {item}" for item in (se_profile["structure"] if se_profile else source_titles[:4])) or focus_lines
        profile_pitfalls = "\n".join(f"- {item}" for item in (se_profile["pitfalls"] if se_profile else ["注意概念边界", "注意上下游关系", "注意真实落点"]))
        if len(source_excerpt) > 800:
            source_excerpt = source_excerpt[:800].rstrip() + "\n..."
        reference_excerpt = source_excerpt or (
            "\u6682\u65e0\u53c2\u8003\u7247\u6bb5\uff0c\u53ef\u5728\u540e\u7eed\u751f\u6210\u4e2d\u7ee7\u7eed\u8865\u5145\u8bfe\u7a0b\u539f\u6587\u3002"
        )

        if resource_type in {"lecture_note", "lecture_notes"}:
            return ResourceService._build_high_quality_handout_markdown(course_code, source_titles, source_excerpt)

        if resource_type in {"quiz_set", "practice_set"}:
            questions = ResourceService._build_high_quality_practice_questions(course_code, source_titles)
            return json.dumps({"questions": questions}, ensure_ascii=False, indent=2)

        if resource_type in {"mind_map", "mindmap"}:
            return ResourceService._build_high_quality_mindmap_markdown(course_code, source_titles, source_excerpt)

        if resource_type in {"ppt", "teaching_plan"}:
            return ResourceService._build_high_quality_teaching_plan_markdown(course_code, source_titles, source_excerpt)

        if resource_type in {"mind_map", "mindmap"}:
            return (
                f"# {course_label} \u7ae0\u8282\u77e5\u8bc6\u5bfc\u56fe\n\n"
                f"## \u4e2d\u5fc3\u4e3b\u9898\n- {profile_theme}\n\n"
                "## \u4e00\u5c42\u4e3b\u5e72\n"
                f"- \u6982\u5ff5\u5b9a\u4f4d\uff1a{profile_goal}\u3002\n"
                f"- \u7ed3\u6784\u7ec4\u6210\uff1a\u62c6\u51fa {profile_theme} \u7684\u5173\u952e\u6a21\u5757\u3001\u8f93\u5165\u8f93\u51fa\u548c\u534f\u540c\u5173\u7cfb\u3002\n"
                f"- \u5e94\u7528\u843d\u70b9\uff1a{profile_scene}\u3002\n"
                f"- \u6613\u9519\u8fa8\u6790\uff1a\u533a\u5206 {profile_theme} \u4e0e\u76f8\u90bb\u6982\u5ff5\uff0c\u907f\u514d\u53ea\u8bb0\u672f\u8bed\u4e0d\u61c2\u8fb9\u754c\u3002\n\n"
                "## \u4e8c\u5c42\u5c55\u5f00\n"
                f"- \u4e0a\u6e38\u77e5\u8bc6\uff1a\u5b66\u4e60 {profile_theme} \u524d\u6700\u597d\u5148\u638c\u63e1\u7684\u5185\u5bb9\u3002\n{profile_upstream}\n"
                f"- \u8bfe\u5802\u95ee\u9898\uff1a\u672c\u8282\u901a\u5e38\u501f\u52a9 {profile_theme} \u56de\u7b54\u54ea\u4e9b\u6838\u5fc3\u95ee\u9898\u3002\n"
                "- \u8f93\u51fa\u7ed3\u679c\uff1a\u5b66\u5b8c\u540e\uff0c\u5e94\u8be5\u80fd\u590d\u8ff0\u4e3b\u7ebf\u3001\u89e3\u91ca\u7ed3\u6784\u5e76\u4e3e\u51fa\u5e94\u7528\u4f8b\u5b50\u3002\n\n"
                "## \u5b66\u4e60\u8def\u5f84\n"
                "1. \u5148\u8bfb\u4e2d\u5fc3\u4e3b\u9898\u4e0e\u6982\u5ff5\u5b9a\u4f4d\uff0c\u5f04\u6e05\u672c\u8282\u7a76\u7adf\u5728\u89e3\u51b3\u4ec0\u4e48\u95ee\u9898\u3002\n"
                "2. \u518d\u770b\u7ed3\u6784\u7ec4\u6210\u548c\u4e8c\u5c42\u5c55\u5f00\uff0c\u628a\u6a21\u5757\u5173\u7cfb\u4e32\u6210\u4e00\u6761\u56e0\u679c\u94fe\u3002\n"
                "3. \u6700\u540e\u7ed3\u5408\u6848\u4f8b\u4e0e\u7ec3\u4e60\u56de\u770b\u6613\u9519\u70b9\uff0c\u5b8c\u6210\u77e5\u8bc6\u8fc1\u79fb\u3002\n\n"
                f"## \u53c2\u8003\u7247\u6bb5\n{reference_excerpt}"
            )

        if resource_type in {"quiz_set", "practice_set"}:
            questions = [
                {
                    "question": f"\u5173\u4e8e {focus_title} \u7684\u5b66\u4e60\u76ee\u6807\uff0c\u4e0b\u5217\u54ea\u4e00\u9879\u6700\u7b26\u5408\u672c\u8282\u7684\u6838\u5fc3\u8981\u6c42\uff1f",
                    "options": [
                        "\u80fd\u591f\u8bf4\u660e\u5b83\u89e3\u51b3\u7684\u95ee\u9898\u3001\u6838\u5fc3\u7ed3\u6784\u548c\u57fa\u672c\u4f7f\u7528\u573a\u666f",
                        "\u53ea\u8bb0\u4f4f\u540d\u8bcd\u5b9a\u4e49\uff0c\u4e0d\u9700\u8981\u7406\u89e3\u4e0a\u4e0b\u6e38\u5173\u7cfb",
                        "\u53ea\u5173\u6ce8\u754c\u9762\u5c55\u793a\u6548\u679c\uff0c\u4e0d\u8003\u8651\u903b\u8f91\u7ed3\u6784",
                        "\u53ea\u8981\u80cc\u4f1a\u7b54\u6848\uff0c\u65e0\u9700\u7ed3\u5408\u771f\u5b9e\u6848\u4f8b",
                    ],
                    "answer": ["A"],
                    "explanation": f"{focus_title} \u7684\u6838\u5fc3\u4e0d\u662f\u6b7b\u8bb0\u672f\u8bed\uff0c\u800c\u662f\u7406\u89e3\u5b83\u89e3\u51b3\u4ec0\u4e48\u95ee\u9898\u3001\u5982\u4f55\u7ec4\u7ec7\u7ed3\u6784\uff0c\u4ee5\u53ca\u5982\u4f55\u843d\u5230\u771f\u5b9e\u4efb\u52a1\u91cc\u3002",
                    "question_type": "single",
                    "knowledge_tag": focus_title,
                },
                {
                    "question": f"\u5728\u68b3\u7406 {focus_title} \u65f6\uff0c\u54ea\u4e9b\u5185\u5bb9\u901a\u5e38\u5c5e\u4e8e\u5e94\u8be5\u91cd\u70b9\u638c\u63e1\u7684\u7ed3\u6784\u4fe1\u606f\uff1f",
                    "options": ["\u89d2\u8272\u6216\u6a21\u5757\u5206\u5de5", "\u6d41\u7a0b\u6b65\u9aa4", "\u8f93\u5165\u8f93\u51fa\u5173\u7cfb", "\u4e0e\u8bfe\u5802\u65e0\u5173\u7684\u5a31\u4e50\u4fe1\u606f"],
                    "answer": ["A", "B", "C"],
                    "explanation": "\u7ed3\u6784\u6027\u5b66\u4e60\u8981\u6293\u4f4f\u6a21\u5757\u3001\u6d41\u7a0b\u548c\u8f93\u5165\u8f93\u51fa\uff0c\u800c\u4e0d\u662f\u88ab\u65e0\u5173\u4fe1\u606f\u5206\u6563\u6ce8\u610f\u529b\u3002",
                    "question_type": "multiple",
                    "knowledge_tag": focus_title,
                },
                {
                    "question": f"\u8bf7\u7ed3\u5408\u5f53\u524d\u8bfe\u7a0b\u573a\u666f\uff0c\u7b80\u8ff0\u4f60\u4f1a\u5982\u4f55\u628a {focus_title} \u7528\u5230\u5b9e\u9645\u5b66\u4e60\u6216\u9879\u76ee\u4efb\u52a1\u4e2d\u3002",
                    "options": [],
                    "answer": [],
                    "explanation": "\u8fd9\u9053\u5f00\u653e\u9898\u7528\u4e8e\u68c0\u67e5\u4f60\u662f\u5426\u80fd\u628a\u77e5\u8bc6\u70b9\u8fc1\u79fb\u5230\u771f\u5b9e\u4efb\u52a1\uff0c\u800c\u4e0d\u662f\u505c\u7559\u5728\u80cc\u6982\u5ff5\u5c42\u9762\u3002",
                    "question_type": "short",
                    "knowledge_tag": focus_title,
                },
                {
                    "question": f"\u5982\u679c\u4f60\u5728\u5e94\u7528 {focus_title} \u65f6\u6548\u679c\u4e0d\u7406\u60f3\uff0c\u6700\u5e94\u8be5\u4f18\u5148\u56de\u67e5\u54ea\u4e00\u7c7b\u4fe1\u606f\uff1f",
                    "options": ["\u6982\u5ff5\u8fb9\u754c\u4e0e\u8f93\u5165\u8f93\u51fa\u6761\u4ef6", "\u9875\u9762\u914d\u8272\u662f\u5426\u7f8e\u89c2", "\u8bbe\u5907\u54c1\u724c\u662f\u5426\u66f4\u65b0", "\u804a\u5929\u8bed\u6c14\u662f\u5426\u66f4\u6d3b\u6cfc"],
                    "answer": ["A"],
                    "explanation": "\u5927\u591a\u6570\u9519\u8bef\u5e76\u4e0d\u6765\u81ea\u8868\u9762\u8868\u73b0\uff0c\u800c\u662f\u6765\u81ea\u5bf9\u8fb9\u754c\u6761\u4ef6\u3001\u524d\u63d0\u548c\u8f93\u51fa\u7ed3\u679c\u7406\u89e3\u4e0d\u6e05\u3002",
                    "question_type": "single",
                    "knowledge_tag": focus_title,
                },
                {
                    "question": f"\u8bf7\u5199\u51fa {focus_title} \u4e0e\u4e00\u4e2a\u76f8\u90bb\u77e5\u8bc6\u70b9\u7684\u533a\u522b\uff0c\u5e76\u5404\u4e3e\u4e00\u4e2a\u4f7f\u7528\u573a\u666f\u3002",
                    "options": [],
                    "answer": [],
                    "explanation": "\u8fd9\u9053\u9898\u7528\u4e8e\u68c0\u9a8c\u4f60\u662f\u5426\u80fd\u505a\u5bf9\u6bd4\u5206\u6790\uff0c\u907f\u514d\u628a\u76f8\u8fd1\u6982\u5ff5\u6df7\u4e3a\u4e00\u8c08\u3002",
                    "question_type": "short",
                    "knowledge_tag": focus_title,
                },
            ]
            return json.dumps({"questions": questions}, ensure_ascii=False, indent=2)

        if resource_type == "course_overview":
            return (
                f"# {course_label} \u8bfe\u7a0b\u603b\u89c8\n\n"
                "## \u8bfe\u7a0b\u76ee\u6807\n"
                f"- \u5efa\u7acb\u5bf9 {course_label} \u7684\u6574\u4f53\u8ba4\u8bc6\uff0c\u7406\u89e3\u8bfe\u7a0b\u60f3\u89e3\u51b3\u7684\u771f\u5b9e\u95ee\u9898\u3002\n"
                f"- \u56f4\u7ed5 {focus_title} \u6293\u4f4f\u5f53\u524d\u7ae0\u8282\u4e3b\u7ebf\uff0c\u5e76\u77e5\u9053\u5b83\u5728\u6574\u95e8\u8bfe\u4e2d\u7684\u4f4d\u7f6e\u3002\n\n"
                "## \u6838\u5fc3\u6a21\u5757\n"
                f"{profile_structure}\n\n"
                "## \u5b66\u4e60\u5efa\u8bae\n"
                "- \u5148\u770b\u8bfe\u7a0b\u603b\u89c8\uff0c\u660e\u786e\u8fd9\u4e00\u7ae0\u5728\u524d\u540e\u7ae0\u8282\u4e2d\u7684\u4f5c\u7528\u3002\n"
                "- \u518d\u8fdb\u5165\u8bb2\u4e49\u548c\u5bfc\u56fe\uff0c\u8865\u9f50\u6982\u5ff5\u3001\u7ed3\u6784\u548c\u6848\u4f8b\u7406\u89e3\u3002\n"
                "- \u6700\u540e\u901a\u8fc7\u7ec3\u4e60\u4e0e\u8ba8\u8bba\u5b8c\u6210\u68c0\u9a8c\u548c\u8fc1\u79fb\u3002\n"
            )

        if resource_type in {"ppt", "teaching_plan"}:
            slide_titles = [
                "\u5c01\u9762\u9875\uff1a\u8bfe\u7a0b\u4e0e\u7ae0\u8282\u5b9a\u4f4d",
                "\u76ee\u6807\u9875\uff1a\u672c\u8282\u8981\u89e3\u51b3\u4ec0\u4e48\u95ee\u9898",
                "\u6982\u5ff5\u9875\uff1a\u6838\u5fc3\u5b9a\u4e49\u4e0e\u8fb9\u754c",
                "\u7ed3\u6784\u9875\uff1a\u6a21\u5757\u5173\u7cfb\u4e0e\u6d41\u7a0b",
                "\u6848\u4f8b\u9875\uff1a\u8bfe\u5802\u793a\u4f8b\u6216\u9879\u76ee\u573a\u666f",
                "\u590d\u76d8\u9875\uff1a\u6613\u9519\u70b9\u4e0e\u590d\u4e60\u5efa\u8bae",
            ]
            return (
                f"# {course_label} PPT \u8349\u6848\n\n"
                "## \u9875\u9762\u89c4\u5212\n"
                + "\n".join(f"- {item}" for item in slide_titles)
                + "\n\n## \u5f53\u524d\u7ae0\u8282\u8981\u70b9\n"
                + f"{profile_structure}\n\n"
                + "## \u8bb2\u89e3\u8282\u594f\n"
                + "- \u5148\u629b\u51fa\u573a\u666f\u548c\u95ee\u9898\uff0c\u5efa\u7acb\u5b66\u751f\u7684\u5b66\u4e60\u52a8\u673a\u3002\n"
                + f"- \u518d\u56f4\u7ed5 {profile_theme} \u8bb2\u6e05\u6982\u5ff5\u3001\u7ed3\u6784\u3001\u6d41\u7a0b\u4e0e\u76f8\u4e92\u5173\u7cfb\u3002\n"
                + "- \u7136\u540e\u653e\u5165\u6848\u4f8b\u6216\u9879\u76ee\u7247\u6bb5\uff0c\u8ba9\u5b66\u751f\u770b\u5230\u771f\u5b9e\u843d\u70b9\u3002\n"
                + "- \u6700\u540e\u7528\u590d\u76d8\u9875\u603b\u7ed3\u6613\u9519\u70b9\uff0c\u5e76\u8854\u63a5\u8bb2\u4e49\u548c\u7ec3\u4e60\u3002\n\n"
                + "## \u6bcf\u9875\u5185\u5bb9\u8981\u6c42\n"
                + "- \u6bcf\u9875\u53ea\u4fdd\u7559\u4e00\u4e2a\u4e3b\u4fe1\u606f\u70b9\uff0c\u907f\u514d\u5806\u5b57\u3002\n"
                + "- \u4f18\u5148\u4f7f\u7528\u5173\u952e\u7ed3\u8bba\u3001\u6b65\u9aa4\u3001\u5bf9\u6bd4\u548c\u6848\u4f8b\u622a\u56fe\u5360\u4f4d\u3002\n"
                + "- \u7ed3\u5c3e\u9875\u5fc5\u987b\u7ed9\u51fa\u590d\u4e60\u95ee\u9898\u6216\u8bfe\u540e\u4efb\u52a1\uff0c\u5f62\u6210\u5b66\u4e60\u95ed\u73af\u3002\n"
            )

        if resource_type in {"coding_lab", "case_study"}:
            return (
                f"# {course_label} \u4ee3\u7801\u5b9e\u64cd\u6848\u4f8b\n\n"
                "## \u9898\u76ee\u63cf\u8ff0\n"
                f"\u8bf7\u56f4\u7ed5 {source_titles[0] if source_titles else course_label} \u5b8c\u6210\u4e00\u4e2a\u53ef\u76f4\u63a5\u8fd0\u884c\u7684 Java \u5c0f\u9898\uff0c\u91cd\u70b9\u662f\u628a\u8bfe\u7a0b\u91cc\u7684\u77e5\u8bc6\u70b9\u8f6c\u6210\u53ef\u89c2\u5bdf\u7684\u4ee3\u7801\u7ed3\u679c\u3002\n\n"
                "## \u8f93\u5165\u8bf4\u660e\n"
                "- \u7b2c 1 \u884c\u8f93\u5165\u4e00\u4e2a\u6574\u6570 `n`\uff0c\u8868\u793a\u540e\u7eed\u6570\u5b57\u4e2a\u6570\u3002\n"
                "- \u7b2c 2 \u884c\u8f93\u5165 `n` \u4e2a\u6574\u6570\uff0c\u4ee5\u7a7a\u683c\u5206\u9694\u3002\n\n"
                "## \u8f93\u51fa\u8bf4\u660e\n"
                "- \u8f93\u51fa\u8fd9\u7ec4\u6574\u6570\u7684\u603b\u548c\u3002\n\n"
                "## \u793a\u4f8b\u8f93\u5165\n"
                "```text\n3\n1 2 3\n```\n\n"
                "## \u793a\u4f8b\u8f93\u51fa\n"
                "```text\n6\n```\n\n"
                "## \u8d77\u59cb\u4ee3\u7801\n"
                "```java\n"
                "import java.util.*;\n\n"
                "public class Main {\n"
                "    public static void main(String[] args) {\n"
                "        Scanner scanner = new Scanner(System.in);\n"
                "        int n = scanner.nextInt();\n"
                "        int sum = 0;\n"
                "        for (int i = 0; i < n; i++) {\n"
                "            // TODO: \u8bfb\u53d6\u6bcf\u4e2a\u6570\u5b57\u5e76\u7d2f\u52a0\n"
                "        }\n"
                "        System.out.println(sum);\n"
                "    }\n"
                "}\n"
                "```\n\n"
                "## \u89e3\u9898\u6b65\u9aa4\n"
                "1. \u660e\u786e\u8f93\u5165\u3001\u8f93\u51fa\u548c\u7ea6\u675f\u6761\u4ef6\u3002\n"
                "2. \u5728\u5faa\u73af\u4e2d\u8bfb\u53d6\u6bcf\u4e2a\u6570\u5b57\u5e76\u66f4\u65b0\u7d2f\u52a0\u503c\u3002\n"
                "3. \u8f93\u51fa\u6700\u7ec8\u7ed3\u679c\u5e76\u7528\u793a\u4f8b\u7528\u4f8b\u9a8c\u8bc1\u3002\n"
            )

        if resource_type == "extended_reading":
            return (
                f"# {course_label} \u62d3\u5c55\u9605\u8bfb\n\n"
                "## \u9605\u8bfb\u76ee\u6807\n"
                f"{focus_lines}\n\n"
                "## \u9605\u8bfb\u5f15\u5bfc\n"
                "1. \u5148\u7406\u89e3\u80cc\u666f\u4e0e\u95ee\u9898\u52a8\u673a\u3002\n"
                "2. \u518d\u5bf9\u6bd4\u5178\u578b\u5e94\u7528\u573a\u666f\u3002\n"
                "3. \u6700\u540e\u7528\u81ea\u5df1\u7684\u8bdd\u603b\u7ed3\u6536\u83b7\u3002\n"
            )

        if resource_type == "visual_illustration":
            return (
                f"# {course_label} \u6559\u5b66\u63d2\u56fe\u65b9\u6848\n\n"
                "## \u63d2\u56fe\u76ee\u6807\n"
                f"- \u5e2e\u4f60\u4e00\u773c\u770b\u61c2 {focus_title} \u7684\u7ed3\u6784\u5173\u7cfb\u3001\u4fe1\u606f\u6d41\u5411\u548c\u8bfe\u5802\u5e94\u7528\u4f4d\u7f6e\u3002\n"
                "- \u9002\u5408\u653e\u8fdb\u8bb2\u4e49\u3001PPT\u3001\u5b66\u4e60\u7b14\u8bb0\u6216\u8bfe\u7a0b\u9875\u91cc\u4f5c\u4e3a\u914d\u56fe\u3002\n\n"
                "## \u5efa\u8bae\u62c6\u56fe\n"
                "1. \u603b\u89c8\u56fe\uff1a\u7528\u4e00\u5f20\u4e3b\u56fe\u8bb2\u6e05\u6838\u5fc3\u6a21\u5757\u3001\u4e0a\u4e0b\u6e38\u5173\u7cfb\u4e0e\u8f93\u51fa\u7ed3\u679c\u3002\n"
                "2. \u6d41\u7a0b\u56fe\uff1a\u6309\u201c\u8f93\u5165 -> \u5904\u7406 -> \u8f93\u51fa\u201d\u62c6\u5f00\u5173\u952e\u6b65\u9aa4\u3002\n"
                "3. \u5bf9\u6bd4\u56fe\uff1a\u5bf9\u6bd4\u5e38\u89c1\u8bef\u533a\u3001\u76f8\u90bb\u6982\u5ff5\u548c\u9002\u7528\u573a\u666f\u3002\n\n"
                "## \u7ed8\u5236\u6587\u6848\n"
                f"- \u4e3b\u6807\u9898\uff1a{focus_title}\n"
                f"- \u56fe\u4e2d\u8282\u70b9\uff1a\n{profile_structure}\n\n"
                "## \u89c6\u89c9\u63d0\u793a\n"
                "- \u989c\u8272\u5206\u4e09\u5c42\uff1a\u4e3b\u7ebf\u3001\u8f85\u52a9\u3001\u98ce\u9669\u63d0\u793a\u3002\n"
                "- \u6bcf\u4e2a\u8282\u70b9\u53ea\u4fdd\u7559\u77ed\u8bed\uff0c\u907f\u514d\u5806\u6bb5\u843d\u3002\n"
                "- \u6700\u53f3\u4fa7\u4fdd\u7559\u4e00\u5757\u201c\u771f\u5b9e\u8bfe\u5802\u573a\u666f\u201d\u7528\u4e8e\u843d\u5730\u8bf4\u660e\u3002\n\n"
                f"## \u53c2\u8003\u7247\u6bb5\n{reference_excerpt}"
            )

        if resource_type == "micro_video":
            return (
                f"# {course_label} \u52a8\u753b\u8bb2\u89e3\u811a\u672c\n\n"
                "## \u89c6\u9891\u5b9a\u4f4d\n"
                f"- \u7528 60 \u5230 90 \u79d2\u5feb\u901f\u8bb2\u6e05 {focus_title}\u3002\n"
                "- \u9002\u5408\u505a\u8bfe\u5802\u8865\u52a8\u753b\u3001\u77e5\u8bc6\u70b9\u77ed\u89c6\u9891\u6216\u7ae0\u8282\u5bfc\u5165\u3002\n\n"
                "## \u5206\u955c\u811a\u672c\n"
                "1. \u5f00\u573a 0-8s\uff1a\u629b\u51fa\u95ee\u9898\uff0c\u8bf4\u660e\u8fd9\u4e00\u8282\u4e3a\u4ec0\u4e48\u8981\u5b66\u3002\n"
                f"2. \u4e3b\u4f53 8-35s\uff1a\u7528 2 \u5230 3 \u4e2a\u753b\u9762\u89e3\u91ca {focus_title} \u7684\u7ed3\u6784\u548c\u6d41\u7a0b\u3002\n"
                "3. \u6848\u4f8b 35-55s\uff1a\u7ed9\u51fa\u4e00\u4e2a\u771f\u5b9e\u8bfe\u5802\u6216\u9879\u76ee\u4e2d\u7684\u843d\u5730\u573a\u666f\u3002\n"
                "4. \u6536\u675f 55-75s\uff1a\u603b\u7ed3\u6613\u9519\u70b9\uff0c\u5e76\u7ed9\u51fa\u4e0b\u4e00\u6b65\u5b66\u4e60\u52a8\u4f5c\u3002\n\n"
                "## \u65c1\u767d\u5efa\u8bae\n"
                f"- \u5148\u7528\u4e00\u53e5\u8bdd\u5b9a\u4e49 {focus_title}\u3002\n"
                f"- \u518d\u89e3\u91ca\u5b83\u5982\u4f55\u8fde\u63a5\u8fd9\u4e9b\u5173\u952e\u8282\u70b9\uff1a\n{profile_structure}\n\n"
                "## \u52a8\u6548\u5efa\u8bae\n"
                "- \u5173\u952e\u8282\u70b9\u4f7f\u7528\u8f7b\u5fae\u653e\u5927\u6216\u8fde\u7ebf\u52a8\u753b\u3002\n"
                "- \u6848\u4f8b\u9875\u5207\u6362\u4f7f\u7528\u5de6\u53f3\u4f4d\u79fb\u52a8\u753b\uff0c\u907f\u514d\u9875\u9762\u9759\u6b62\u3002\n"
                "- \u7ed3\u5c3e\u7528\u9ad8\u4eae\u6846\u63d0\u793a\u201c\u4e0b\u4e00\u6b65\u770b\u4ec0\u4e48 / \u7ec3\u4ec0\u4e48\u201d\u3002\n\n"
                f"## \u53c2\u8003\u7247\u6bb5\n{reference_excerpt}"
            )

        if resource_type == "subtitle_transcript":
            return (
                f"# {course_label} \u8bfe\u5802\u5b57\u5e55\u7a3f\n\n"
                "## \u5b57\u5e55\u7528\u9014\n"
                "- \u9002\u5408\u914d\u5408\u5f55\u64ad\u89c6\u9891\u3001\u8bfe\u5802\u56de\u653e\u3001\u77ed\u8bb2\u89e3\u89c6\u9891\u6216\u65e0\u58f0\u590d\u4e60\u573a\u666f\u3002\n"
                f"- \u5f53\u524d\u4e3b\u9898\u805a\u7126\uff1a{focus_title}\n\n"
                "## \u5b57\u5e55\u65f6\u95f4\u8f74\n"
                "00:00-00:12 \u8bf4\u660e\u672c\u8282\u95ee\u9898\u80cc\u666f\u4e0e\u5b66\u4e60\u76ee\u6807\u3002\n"
                f"00:12-00:32 \u89e3\u91ca {focus_title} \u7684\u6838\u5fc3\u5b9a\u4e49\u548c\u8fb9\u754c\u3002\n"
                "00:32-00:52 \u62c6\u89e3\u5173\u952e\u6d41\u7a0b\u3001\u6a21\u5757\u5173\u7cfb\u4e0e\u5e38\u89c1\u8bef\u533a\u3002\n"
                "00:52-01:10 \u7528\u8bfe\u5802\u6216\u9879\u76ee\u573a\u666f\u5b8c\u6210\u843d\u5730\u8bf4\u660e\u3002\n\n"
                "## \u5173\u952e\u5b57\u5e55\u53e5\n"
                f"- \u8fd9\u4e00\u8282\u4f60\u9700\u8981\u5148\u7406\u89e3 {focus_title} \u5728\u6574\u95e8\u8bfe\u91cc\u7684\u4f4d\u7f6e\u3002\n"
                "- \u4e0d\u8981\u53ea\u80cc\u672f\u8bed\uff0c\u800c\u8981\u660e\u786e\u5b83\u89e3\u51b3\u4ec0\u4e48\u95ee\u9898\u3002\n"
                "- \u770b\u5b8c\u540e\uff0c\u5e94\u8be5\u80fd\u81ea\u5df1\u590d\u8ff0\u7ed3\u6784\u3001\u6d41\u7a0b\u548c\u5e94\u7528\u573a\u666f\u3002\n\n"
                "## \u5b57\u5e55\u4f18\u5316\u5efa\u8bae\n"
                "- \u5355\u884c\u5c3d\u91cf\u4e0d\u8d85\u8fc7 20 \u4e2a\u6c49\u5b57\u3002\n"
                "- \u5173\u952e\u672f\u8bed\u7b2c\u4e00\u6b21\u51fa\u73b0\u65f6\u5355\u72ec\u6210\u884c\u3002\n"
                "- \u590d\u6742\u6b65\u9aa4\u62c6\u6210\u4e24\u53e5\uff0c\u907f\u514d\u5b57\u5e55\u6324\u5728\u4e00\u8d77\u3002\n\n"
                f"## \u53c2\u8003\u7247\u6bb5\n{reference_excerpt}"
            )

        if resource_type == "ocr_notes":
            ocr_lines = source_titles or [focus_title, profile_goal, profile_scene]
            board_left = ocr_lines[:2] or [focus_title]
            board_middle = (ocr_lines[2:5] or source_titles[:3] or [profile_theme])
            board_right = [
                f"\u8f93\u51fa\uff1a\u80fd\u8bf4\u6e05 {focus_title} \u7684\u4f5c\u7528",
                "\u68c0\u67e5\uff1a\u6982\u5ff5\u8fb9\u754c / \u6d41\u7a0b\u56e0\u679c / \u771f\u5b9e\u843d\u70b9",
                "\u590d\u76d8\uff1a\u628a\u677f\u4e66\u8865\u6210\u4e09\u53e5\u81ea\u5df1\u7684\u8bdd",
            ]
            return (
                f"# {course_label} \u771f\u5b9e\u677f\u4e66\u751f\u6210\u7a3f\n\n"
                "## \u677f\u4e66\u6765\u6e90\u4e0e\u751f\u6210\u8bf4\u660e\n"
                f"- \u751f\u6210\u65b9\u5f0f\uff1a\u57fa\u4e8e\u5f53\u524d\u8bfe\u7a0b\u8d44\u6599\u3001\u8bfe\u4ef6\u6587\u5b57\u4e0e\u77e5\u8bc6\u70b9\u63d0\u53d6\uff0c\u6a21\u62df\u8bfe\u5802 OCR \u677f\u4e66\u8bc6\u522b\u540e\u7684\u7ed3\u6784\u5316\u6574\u7406\u3002\n"
                f"- \u5f53\u524d\u4e3b\u9898\uff1a{focus_title}\n"
                f"- \u4e3b\u8bb2\u8bfe\u7a0b\uff1a{course_label}\n\n"
                "## OCR \u8bc6\u522b\u6587\u672c\uff08\u6a21\u62df\u8bfe\u5802\u677f\u4e66\u539f\u59cb\u7ed3\u679c\uff09\n"
                + "\n".join(f"- {item}" for item in ocr_lines[:8])
                + "\n\n## \u9ed1\u677f\u5e03\u5c40\u8fd8\u539f\n"
                "### \u5de6\u533a\uff1a\u672c\u8282\u95ee\u9898\n"
                + "\n".join(f"- {item}" for item in board_left)
                + "\n\n### \u4e2d\u533a\uff1a\u4e3b\u7ebf\u7ed3\u6784\n"
                + "\n".join(f"- {item}" for item in board_middle)
                + "\n\n### \u53f3\u533a\uff1a\u8f93\u51fa\u4e0e\u68c0\u67e5\n"
                + "\n".join(f"- {item}" for item in board_right)
                + "\n\n## \u7ed3\u6784\u5316\u677f\u4e66\u7b14\u8bb0\n"
                f"1. \u6838\u5fc3\u6982\u5ff5\uff1a{profile_theme}\u7684\u91cd\u70b9\u4e0d\u662f\u80cc\u540d\u8bcd\uff0c\u800c\u662f\u8bf4\u6e05\u5b83\u89e3\u51b3\u4ec0\u4e48\u95ee\u9898\u3002\n"
                f"2. \u5173\u952e\u7ed3\u6784\uff1a\u6309\u201c\u76ee\u6807 -> \u7ec4\u6210 -> \u5173\u7cfb -> \u7ed3\u679c\u201d\u590d\u539f\u677f\u4e66\u903b\u8f91\u3002\n"
                f"3. \u8bfe\u5802\u843d\u70b9\uff1a{profile_scene}\u3002\n"
                "4. \u6613\u9519\u63d0\u9192\uff1a\u4e0d\u8981\u628a\u7bad\u5934\u5f53\u6210\u88c5\u9970\uff0c\u7bad\u5934\u8868\u793a\u8f93\u5165\u3001\u4f9d\u8d56\u6216\u56e0\u679c\u5173\u7cfb\u3002\n\n"
                "## \u53ef\u76f4\u63a5\u6284\u5199\u7684\u677f\u4e66\u7248\u5f0f\n"
                f"```text\n"
                f"\u3010{focus_title}\u3011\n"
                f"1. \u95ee\u9898\uff1a{profile_goal}\n"
                f"2. \u7ed3\u6784\uff1a\n{profile_structure}\n"
                f"3. \u5e94\u7528\uff1a{profile_scene}\n"
                f"4. \u6613\u9519\uff1a\n{profile_pitfalls}\n"
                f"```\n\n"
                "## \u8bfe\u540e\u590d\u76d8\u52a8\u4f5c\n"
                "- \u7528 3 \u5206\u949f\u628a\u9ed1\u677f\u5e03\u5c40\u91cd\u753b\u4e00\u904d\uff0c\u4e0d\u770b\u539f\u6587\u3002\n"
                "- \u628a\u6bcf\u4e2a\u5173\u952e\u8bcd\u8865\u6210\u4e00\u53e5\u5b8c\u6574\u89e3\u91ca\u3002\n"
                "- \u7528\u4e00\u4e2a\u8bfe\u5802\u6216\u9879\u76ee\u4f8b\u5b50\u8bf4\u660e\u8fd9\u5f20\u677f\u4e66\u4e3a\u4ec0\u4e48\u8fd9\u6837\u6392\u5e03\u3002\n\n"
                f"## \u53c2\u8003\u7247\u6bb5\n{reference_excerpt}"
            )

        return (
            f"# {course_label} \u8bfe\u5802\u8bb2\u4e49\n\n"
            f"## \u672c\u8282\u4e3b\u7ebf\n{profile_theme} \u662f\u8fd9\u4e00\u8282\u7684\u6838\u5fc3\u4e3b\u9898\u3002\u5b66\u4e60\u65f6\u4e0d\u8981\u53ea\u80cc\u5b9a\u4e49\uff0c\u800c\u8981\u5148\u5f04\u6e05\u5b83\u4e3a\u4ec0\u4e48\u51fa\u73b0\u3001\u89e3\u51b3\u4ec0\u4e48\u95ee\u9898\u3001\u548c\u524d\u540e\u77e5\u8bc6\u70b9\u662f\u4ec0\u4e48\u5173\u7cfb\u3002\u53ea\u6709\u4e3b\u7ebf\u6e05\u695a\uff0c\u540e\u9762\u7684\u7ed3\u6784\u3001\u6d41\u7a0b\u3001\u6848\u4f8b\u548c\u7ec3\u4e60\u624d\u80fd\u4e32\u6210\u4e00\u6761\u5b8c\u6574\u7684\u5b66\u4e60\u8def\u5f84\u3002\n\n"
            "## \u5b66\u4e60\u76ee\u6807\n"
            f"- \u80fd\u8bf4\u6e05 {profile_theme} \u7684\u6838\u5fc3\u5b9a\u4e49\u3001\u4f7f\u7528\u573a\u666f\u548c\u76ee\u6807\u3002\n"
            f"- \u80fd\u628a {course_label} \u5f53\u524d\u7ae0\u8282\u91cc\u7684\u5173\u952e\u6a21\u5757\u3001\u6b65\u9aa4\u6216\u89d2\u8272\u5173\u7cfb\u4e32\u8d77\u6765\u3002\n"
            "- \u80fd\u628a\u8bfe\u5802\u5185\u5bb9\u8fc1\u79fb\u5230\u5b9e\u9645\u9898\u76ee\u3001\u9879\u76ee\u5206\u6790\u6216\u590d\u4e60\u8868\u8fbe\u4e2d\uff0c\u800c\u4e0d\u53ea\u662f\u673a\u68b0\u8bb0\u5fc6\u3002\n\n"
            "## \u6838\u5fc3\u6982\u5ff5\u4e0e\u8fb9\u754c\n"
            f"{profile_theme} \u7684\u5b66\u4e60\u91cd\u70b9\uff0c\u9996\u5148\u662f\u6982\u5ff5\u8fb9\u754c\u3002\u4f60\u9700\u8981\u5148\u56de\u7b54\u4e09\u4e2a\u95ee\u9898\uff1a\u5b83\u662f\u4ec0\u4e48\u3001\u5b83\u4e0d\u662f\u4ec0\u4e48\u3001\u5b83\u4e3a\u4ec0\u4e48\u91cd\u8981\u3002\u628a\u8fb9\u754c\u6536\u7d27\u540e\uff0c\u505a\u5224\u65ad\u9898\u3001\u7b80\u7b54\u9898\u548c\u65b9\u6848\u5206\u6790\u9898\u65f6\u624d\u4e0d\u5bb9\u6613\u628a\u76f8\u90bb\u6982\u5ff5\u6df7\u5728\u4e00\u8d77\u3002\n\n"
            "## \u5173\u952e\u7ed3\u6784\u4e0e\u8fd0\u884c\u903b\u8f91\n"
            "\u5efa\u8bae\u6309\u201c\u76ee\u6807 -> \u7ec4\u6210 -> \u5173\u7cfb -> \u7ed3\u679c\u201d\u7684\u987a\u5e8f\u7406\u89e3\u3002\n"
            f"{profile_structure}\n\n"
            "\u590d\u8ff0\u65f6\u4e0d\u8981\u53ea\u7f57\u5217\u540d\u8bcd\uff0c\u800c\u8981\u628a\u5b83\u4eec\u4e4b\u95f4\u7684\u56e0\u679c\u5173\u7cfb\u8bb2\u51fa\u6765\uff1a\u524d\u4e00\u73af\u8282\u63d0\u4f9b\u4ec0\u4e48\u8f93\u5165\uff0c\u540e\u4e00\u73af\u8282\u4e3a\u4ec0\u4e48\u8fd9\u6837\u8bbe\u8ba1\uff0c\u6574\u5957\u7ed3\u6784\u6700\u7ec8\u5982\u4f55\u670d\u52a1\u8bfe\u5802\u4e3b\u9898\u3002\n\n"
            "## \u8bfe\u5802\u573a\u666f\u4e0e\u5e94\u7528\u7406\u89e3\n"
            f"\u628a {profile_theme} \u653e\u56de\u8bfe\u5802\u6216\u9879\u76ee\u573a\u666f\u4e2d\uff0c\u5b83\u7684\u4ef7\u503c\u901a\u5e38\u4f53\u73b0\u5728\u4e24\u4e2a\u65b9\u9762\uff1a\u4e00\u662f\u964d\u4f4e\u7406\u89e3\u4e0e\u5b9e\u73b0\u4e4b\u95f4\u7684\u504f\u5dee\uff0c\u4e8c\u662f\u5e2e\u52a9\u6211\u4eec\u7528\u66f4\u7a33\u5b9a\u7684\u7ed3\u6784\u7ec4\u7ec7\u540e\u7eed\u5de5\u4f5c\u3002\u4e3e\u4f8b\u65f6\uff0c\u4f18\u5148\u4ece\u201c\u5f53\u524d\u7ae0\u8282\u6b63\u5728\u89e3\u51b3\u4ec0\u4e48\u95ee\u9898\u201d\u51fa\u53d1\uff0c\u518d\u8bf4\u660e\u8fd9\u4e2a\u77e5\u8bc6\u70b9\u627f\u62c5\u4ec0\u4e48\u804c\u8d23\u3002\n\n"
            "## \u6613\u9519\u70b9\u4e0e\u8fa8\u6790\n"
            f"{profile_pitfalls}\n\n"
            "## \u590d\u4e60\u63d0\u7eb2\n"
            "- \u5148\u590d\u8ff0\u672c\u8282\u8981\u89e3\u51b3\u7684\u95ee\u9898\uff0c\u518d\u8bf4\u6982\u5ff5\u5b9a\u4e49\u3002\n"
            "- \u518d\u6309\u987a\u5e8f\u8bb2\u5173\u952e\u7ed3\u6784\u3001\u6d41\u7a0b\u6216\u6a21\u5757\u5173\u7cfb\u3002\n"
            "- \u6700\u540e\u8865\u5145\u4e00\u4e2a\u4f60\u80fd\u81ea\u5df1\u8bb2\u6e05\u695a\u7684\u8bfe\u5802\u6216\u9879\u76ee\u573a\u666f\uff0c\u8bc1\u660e\u4e0d\u662f\u673a\u68b0\u80cc\u8bf5\u3002\n\n"
            "## \u8bfe\u540e\u81ea\u6d4b\n"
            f"1. \u8bf7\u7528\u81ea\u5df1\u7684\u8bdd\u8bf4\u660e {focus_title} \u7684\u6838\u5fc3\u4f5c\u7528\u662f\u4ec0\u4e48\u3002\n"
            f"2. \u8bf7\u6bd4\u8f83 {focus_title} \u4e0e\u76f8\u90bb\u77e5\u8bc6\u70b9\u7684\u533a\u522b\u548c\u8054\u7cfb\u3002\n"
            "3. \u5982\u679c\u628a\u8fd9\u4e00\u8282\u5185\u5bb9\u653e\u5230\u771f\u5b9e\u4efb\u52a1\u91cc\uff0c\u4f60\u4f1a\u4f18\u5148\u5173\u6ce8\u54ea\u4e00\u6b65\uff0c\u4e3a\u4ec0\u4e48\uff1f\n\n"
            f"## \u53c2\u8003\u7247\u6bb5\n{reference_excerpt}"
        )

    @staticmethod
    def _build_study_suggestion(resource_type: str) -> str:
        mapping = {
            "lecture_note": "\u5efa\u8bae\u5148\u5feb\u901f\u6d4f\u89c8\u8bb2\u4e49\u7ed3\u6784\uff0c\u518d\u56de\u5230\u91cd\u70b9\u7ae0\u8282\u9010\u6bb5\u7cbe\u8bfb\u3002",
            "lecture_notes": "\u5efa\u8bae\u5148\u5feb\u901f\u6d4f\u89c8\u8bb2\u4e49\u7ed3\u6784\uff0c\u518d\u56de\u5230\u91cd\u70b9\u7ae0\u8282\u9010\u6bb5\u7cbe\u8bfb\u3002",
            "mind_map": "\u5efa\u8bae\u5728\u8bfe\u524d\u603b\u89c8\u6216\u8bfe\u540e\u590d\u76d8\u65f6\u914d\u5408\u5bfc\u56fe\u4e00\u8d77\u770b\u3002",
            "mindmap": "\u5efa\u8bae\u5728\u8bfe\u524d\u603b\u89c8\u6216\u8bfe\u540e\u590d\u76d8\u65f6\u914d\u5408\u5bfc\u56fe\u4e00\u8d77\u770b\u3002",
            "quiz_set": "\u5efa\u8bae\u5b66\u5b8c\u5f53\u524d\u7ae0\u8282\u7acb\u523b\u4f5c\u7b54\uff0c\u518d\u6839\u636e\u9519\u9898\u56de\u770b\u89c6\u9891\u6216\u8bb2\u4e49\u3002",
            "practice_set": "\u5efa\u8bae\u5b66\u5b8c\u5f53\u524d\u7ae0\u8282\u7acb\u523b\u4f5c\u7b54\uff0c\u518d\u6839\u636e\u9519\u9898\u56de\u770b\u89c6\u9891\u6216\u8bb2\u4e49\u3002",
            "course_overview": "\u5efa\u8bae\u5148\u8bfb\u8bfe\u7a0b\u603b\u89c8\uff0c\u518d\u8fdb\u5165\u8bb2\u4e49\u3001\u5bfc\u56fe\u548c\u7ec3\u4e60\u7ec6\u5316\u5b66\u4e60\u3002",
            "ppt": "\u5efa\u8bae\u5148\u786e\u8ba4\u8bfe\u4ef6\u9875\u9762\u7ed3\u6784\uff0c\u518d\u6309\u9700\u5bfc\u51fa PPTX \u5e76\u8865\u5145\u6848\u4f8b\u622a\u56fe\u6216\u8bfe\u5802\u4e92\u52a8\u95ee\u9898\u3002",
            "teaching_plan": "\u5efa\u8bae\u5148\u786e\u8ba4\u9875\u9762\u7ed3\u6784\uff0c\u518d\u6309\u9700\u5bfc\u51fa\u5e76\u8865\u5145\u6848\u4f8b\u622a\u56fe\u6216\u8bfe\u5802\u4e92\u52a8\u95ee\u9898\u3002",
            "extended_reading": "\u5efa\u8bae\u5728\u6838\u5fc3\u77e5\u8bc6\u638c\u63e1\u540e\u9605\u8bfb\uff0c\u7528\u6765\u6269\u5c55\u7406\u89e3\u8fb9\u754c\u3002",
            "coding_lab": "\u5efa\u8bae\u8fb9\u5b9e\u8df5\u8fb9\u8bb0\u5f55\u9519\u8bef\u4e0e\u4fee\u6b63\u8fc7\u7a0b\uff0c\u5f3a\u5316\u8fc1\u79fb\u80fd\u529b\u3002",
            "case_study": "\u5efa\u8bae\u6309\u7ed3\u6784\u3001\u51b3\u7b56\u3001\u590d\u76d8\u4e09\u4e2a\u5c42\u6b21\u6765\u62c6\u89e3\u6848\u4f8b\u3002",
            "visual_illustration": "\u5efa\u8bae\u5148\u770b\u63d2\u56fe\u603b\u89c8\uff0c\u518d\u5bf9\u7167\u8bb2\u4e49\u6216\u89c6\u9891\u9010\u4e2a\u6838\u5bf9\u7ed3\u6784\u5173\u7cfb\u3002",
            "micro_video": "\u5efa\u8bae\u5148\u64ad\u653e 1 \u904d\u5efa\u7acb\u6574\u4f53\u5370\u8c61\uff0c\u518d\u56de\u5230\u8bb2\u4e49\u7ec6\u770b\u6bcf\u4e2a\u6b65\u9aa4\u3002",
            "subtitle_transcript": "\u5efa\u8bae\u8fb9\u770b\u89c6\u9891\u8fb9\u5bf9\u7167\u5b57\u5e55\uff0c\u5feb\u901f\u5b9a\u4f4d\u91cd\u70b9\u53e5\u548c\u77e5\u8bc6\u70b9\u65f6\u95f4\u8f74\u3002",
            "ocr_notes": "\u5efa\u8bae\u628a\u677f\u4e66\u6574\u7406\u548c\u8bb2\u4e49\u5bf9\u7167\u7740\u770b\uff0c\u4f18\u5148\u8865\u9f50\u8bfe\u5802\u91cc\u6765\u4e0d\u53ca\u8bb0\u4e0b\u7684\u7ed3\u6784\u3002",
        }
        return mapping.get(resource_type, "\u5efa\u8bae\u7ed3\u5408\u5f53\u524d\u5b66\u4e60\u76ee\u6807\u4e0e\u7ae0\u8282\u4e0a\u4e0b\u6587\u4e00\u8d77\u4f7f\u7528\u8be5\u8d44\u6599\u3002")

    @staticmethod
    def _map_resource_types_for_coordinator(resource_types: list[str]) -> list[int]:
        mapping = {
            "lecture_note": 1,
            "lecture_notes": 1,
            "mind_map": 2,
            "quiz_set": 3,
            "practice_set": 3,
            "ppt": 1,
            "extended_reading": 1,
            "coding_lab": 5,
            "case_study": 5,
            "visual_illustration": 1,
            "micro_video": 4,
            "subtitle_transcript": 4,
            "ocr_notes": 1,
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
            "mindmap": "mindmap",
            "quiz_set": "question_bank",
            "practice_set": "question_bank",
            "ppt": "document",
            "course_overview": "document",
            "teaching_plan": "document",
            "extended_reading": "document",
            "coding_lab": "code_example",
            "case_study": "code_example",
            "visual_illustration": "document",
            "micro_video": "video",
            "subtitle_transcript": "video",
            "ocr_notes": "document",
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
        if resource_type in {"mind_map", "mindmap"}:
            return str(data.get("mermaid_code") or "")
        if resource_type in {"quiz_set", "practice_set"}:
            questions = data.get("questions")
            if isinstance(questions, list) and questions:
                return json.dumps({"questions": questions[:10]}, ensure_ascii=False, indent=2)
        if resource_type in {"coding_lab", "case_study"}:
            return ResourceService._coordinator_coding_lab_content(data)
        if resource_type == "micro_video":
            storyboard = data.get("storyboard")
            if isinstance(storyboard, list) and storyboard:
                lines = ["# 动画分镜", ""]
                for index, scene in enumerate(storyboard[:8], start=1):
                    lines.append(f"## 镜头 {index}")
                    lines.append(str(scene))
                    lines.append("")
                return "\n".join(lines).strip()
        if resource_type == "subtitle_transcript":
            transcript = data.get("transcript") or data.get("subtitle") or data.get("captions")
            if transcript:
                return str(transcript)
        return str(data.get("content_markdown") or data.get("content") or data.get("description") or "")

    @staticmethod
    def _coordinator_coding_lab_content(data: dict) -> str:
        content_markdown = str(data.get("content_markdown") or "").strip()
        description = str(data.get("description") or "").strip()
        code = str(data.get("code") or "").strip()

        if content_markdown:
            if code and "```java" not in content_markdown and "class Main" in code:
                return f"{content_markdown}\n\n## 起始代码\n```java\n{code}\n```"
            return content_markdown

        if description:
            if code and "class Main" in code:
                return f"{description}\n\n## 起始代码\n```java\n{code}\n```"
            return description

        return code

    @staticmethod
    def _build_fallback_source_text(request: ResourceGenerationRequest) -> str:
        points = ResourceService._normalize_knowledge_points(request.knowledge_points, request.course_code or "")
        point_lines = "\n".join(f"- {item}" for item in points)
        return (
            f"## 课程\n{ResourceService._course_label(request.course_code or '')}\n\n"
            "## 当前知识点\n"
            f"{point_lines}\n\n"
            "## 使用建议\n"
            "1. 先理解概念主线与上下游关系。\n"
            "2. 再结合案例、导图和练习做迁移应用。\n"
            "3. 最后记录错因并回看薄弱点。"
        )
