"""
Resource generation service.
"""

from __future__ import annotations

import asyncio
import json
from datetime import datetime
from typing import TYPE_CHECKING, Any, ClassVar

from fastapi import HTTPException

from app.db.models.generation_task import GenerationTask
from app.db.repositories.resource_repository import ResourceRepository
from app.db.session import async_session_factory
from app.schemas.resource import ResourceGenerationTaskCreate, ResourceGenerationTaskResponse
from app.services.course_context_service import CourseContextService
from app.services.resource_generation_event_service import ResourceGenerationEventService
from app.services.resource_file_storage_service import ResourceFileStorageService
from app.services.resource_management_service import ResourceManagementService
from app.services.resource_service import ResourceService

if TYPE_CHECKING:
    from app.agents.nodes.resource_generation.coordinator_agent import ResourceGenerationCoordinator


class ResourceGenerationService:
    _task_cache: ClassVar[dict[int, dict[str, Any]]] = {}
    _next_task_id: ClassVar[int] = 1

    STATUS_MAP: ClassVar[dict[str, int]] = {
        "pending": 1,
        "running": 2,
        "completed": 3,
        "partial_failed": 4,
        "failed": 5,
        "cancelled": 5,
    }

    def __init__(self) -> None:
        self._coordinator: ResourceGenerationCoordinator | None = None
        self._coordinator_import_error: str | None = None
        self.task_cache = self.__class__._task_cache
        self.resource_repository = ResourceRepository()
        self.file_storage = ResourceFileStorageService()
        self._db_available = True

    @classmethod
    def reset_shared_state(cls) -> None:
        cls._task_cache.clear()
        cls._next_task_id = 1

    @classmethod
    def _allocate_task_id(cls) -> int:
        task_id = cls._next_task_id
        cls._next_task_id += 1
        return task_id

    def _get_coordinator(self) -> "ResourceGenerationCoordinator":
        if self._coordinator is not None:
            return self._coordinator
        if self._coordinator_import_error is not None:
            raise RuntimeError(self._coordinator_import_error)

        try:
            from app.agents.nodes.resource_generation.coordinator_agent import (
                ResourceGenerationCoordinator,
            )
        except ModuleNotFoundError as exc:
            self._coordinator_import_error = (
                "Resource generation dependencies are unavailable "
                f"(missing module {exc.name})."
            )
            raise RuntimeError(self._coordinator_import_error) from exc

        self._coordinator = ResourceGenerationCoordinator()
        return self._coordinator

    async def create_generation_task(
        self,
        task_data: ResourceGenerationTaskCreate,
    ) -> ResourceGenerationTaskResponse:
        payload = task_data.model_dump(mode="json")
        now_iso = self._now_iso()
        response_payload = self._build_initial_task_payload(task_data, now_iso)

        task_id: int
        if self._db_available:
            try:
                async with async_session_factory() as session:
                    task = GenerationTask(
                        user_id=task_data.student_id,
                        task_type="resource_generation",
                        status="pending",
                        payload=payload,
                        result_data=response_payload,
                        created_at=now_iso,
                        updated_at=now_iso,
                    )
                    session.add(task)
                    await session.commit()
                    await session.refresh(task)
                    task_id = int(task.id)
            except Exception:
                self._db_available = False
                task_id = self._allocate_task_id()
        else:
            task_id = self._allocate_task_id()

        cached = {"id": task_id, **response_payload}
        self.task_cache[task_id] = cached
        await self._publish_task_event(task_id, ResourceGenerationTaskResponse(**cached))
        asyncio.create_task(self._process_generation_task(task_id, task_data))
        return ResourceGenerationTaskResponse(**cached)

    async def _process_generation_task(
        self,
        task_id: int,
        task_data: ResourceGenerationTaskCreate,
    ) -> None:
        try:
            await self._update_task_status(
                task_id,
                {
                    "status_name": "running",
                    "task_status": 2,
                    "start_time": datetime.now(),
                    "progress": 10,
                },
            )

            result = await self._get_coordinator().coordinate_generation(
                knowledge_point=f"knowledge-point-{task_data.knowledge_point_id}",
                resource_types=task_data.resource_types,
                student_profile=await self._get_student_profile(task_data.student_id),
                course_context=await self._get_course_context(task_data.course_id),
                related_knowledge=None,
                programming_language=(task_data.generation_params or {}).get(
                    "programming_language",
                    "Python",
                ),
            )

            await self._update_task_status(task_id, {"progress": 80})
            saved_resource_ids = await self._save_generation_results(
                task_id=task_id,
                task_data=task_data,
                generation_results=result,
            )

            summary = result.get("summary", {})
            success_count = int(summary.get("success_count", 0))
            failed_count = int(summary.get("failed_count", 0))
            if success_count and failed_count:
                status_name, task_status = "partial_failed", 4
            elif success_count:
                status_name, task_status = "completed", 3
            else:
                status_name, task_status = "failed", 5

            await self._update_task_status(
                task_id,
                {
                    "status_name": status_name,
                    "task_status": task_status,
                    "progress": 100,
                    "completed_resources": success_count,
                    "failed_resources": failed_count,
                    "saved_resource_ids": saved_resource_ids,
                    "end_time": datetime.now(),
                },
            )
        except Exception as exc:
            await self._update_task_status(
                task_id,
                {
                    "status_name": "failed",
                    "task_status": 5,
                    "error_message": str(exc),
                    "end_time": datetime.now(),
                },
            )

    async def _update_task_status(self, task_id: int, updates: dict[str, Any]) -> None:
        cached = self.task_cache.get(task_id)
        if cached is not None:
            cached.update({k: v for k, v in updates.items() if k != "status_name"})
            cached["update_time"] = datetime.now()

        terminal_status = updates.get("task_status") in {3, 4, 5}
        if not terminal_status:
            latest = self.task_cache.get(task_id)
            if latest is not None:
                await self._publish_task_event(task_id, ResourceGenerationTaskResponse(**latest))
            return

        if not self._db_available:
            return
        try:
            async with async_session_factory() as session:
                task = await session.get(GenerationTask, task_id)
                if task is None or task.task_type != "resource_generation":
                    return
                result_data = dict(task.result_data or {})
                for key, value in updates.items():
                    if key == "status_name":
                        task.status = str(value)
                    else:
                        result_data[key] = self._jsonable(value)
                task.result_data = result_data
                task.updated_at = self._now_iso()
                await session.commit()
        except Exception:
            self._db_available = False

        latest = self.task_cache.get(task_id)
        if latest is not None:
            await self._publish_task_event(task_id, ResourceGenerationTaskResponse(**latest))

    async def _get_student_profile(self, student_id: int) -> dict[str, Any] | None:
        return {
            "student_id": student_id,
            "difficulty_level": 1,
            "cognitive_style": "visual",
            "preferred_video_duration": 1200,
        }

    async def _get_course_context(self, course_id: int) -> str | None:
        return f"course-{course_id}"

    async def _save_generation_results(
        self,
        task_id: int,
        task_data: ResourceGenerationTaskCreate,
        generation_results: dict[str, Any],
    ) -> list[int]:
        saved: list[int] = []
        results = generation_results.get("results", {})

        handlers = [
            ("document", 1, "document"),
            ("mindmap", 2, "mindmap"),
            ("question_bank", 3, "question_bank"),
            ("video", 4, "video"),
            ("code_example", 5, "code_example"),
        ]

        for result_key, resource_type_value, resource_type_name in handlers:
            item = results.get(result_key)
            if not isinstance(item, dict) or not item.get("success"):
                continue
            resource_id = await self._persist_resource(
                task_id=task_id,
                task_data=task_data,
                resource_type_value=resource_type_value,
                resource_type_name=resource_type_name,
                data=item.get("data") or {},
            )
            saved.append(resource_id)

        return saved

    async def _persist_resource(
        self,
        *,
        task_id: int,
        task_data: ResourceGenerationTaskCreate,
        resource_type_value: int,
        resource_type_name: str,
        data: dict[str, Any],
    ) -> int:
        title = data.get("title") or f"{task_data.task_name}-{resource_type_name}"
        content_markdown = self._extract_content_markdown(resource_type_name, data)
        summary = data.get("summary") or data.get("description") or title
        course_code = await self._resolve_course_code(task_data.course_id)
        generation_context = {
            "resource_type_value": resource_type_value,
            "knowledge_point_id": task_data.knowledge_point_id,
            "course_id": task_data.course_id,
            "course_code": course_code,
            "chapter_id": task_data.chapter_id,
            "section_id": task_data.section_id,
            "difficulty_level": (task_data.generation_params or {}).get("difficulty_level", 1),
            "programming_language": (task_data.generation_params or {}).get("programming_language"),
            "generation_task_id": task_id,
            "quality_score": data.get("quality_score"),
            "status": 2,
            "version": 1,
            "file_format": self._default_file_format(resource_type_value, data),
            "view_count": 0,
            resource_type_name: data,
        }
        now_iso = self._now_iso()

        resource_id: int
        uploaded_file_url: str | None = None
        uploaded_object_key: str | None = None
        if self._db_available:
            try:
                async with async_session_factory() as session:
                    resource = await self.resource_repository.create_resource(
                        session,
                        user_id=task_data.student_id,
                        course_code=course_code,
                        resource_type=resource_type_name,
                        title=title,
                        summary=summary,
                        content_markdown=content_markdown,
                        source_titles=[
                            f"course-{task_data.course_id}",
                            f"knowledge-{task_data.knowledge_point_id}",
                        ],
                        study_suggestion=data.get("study_suggestion")
                        or self._default_study_suggestion(resource_type_name),
                        generation_context=generation_context,
                        created_at=now_iso,
                        updated_at=now_iso,
                    )
                    resource_id = int(resource.id)
                    self._hydrate_visual_illustration_generation_context(
                        generation_context=generation_context,
                        resource_id=resource_id,
                        resource_type_name=resource_type_name,
                        course_code=course_code,
                        title=title,
                        summary=summary,
                    )
                    uploaded_file_url, uploaded_object_key = self._try_upload_resource_file(
                        resource_id=resource_id,
                        resource_type_name=resource_type_name,
                        title=title,
                        content=content_markdown,
                        file_format=generation_context["file_format"],
                    )
                    if uploaded_file_url:
                        generation_context["file_url"] = uploaded_file_url
                    if uploaded_object_key:
                        generation_context["object_key"] = uploaded_object_key
                    resource.generation_context = generation_context
                    await session.commit()
            except Exception:
                self._db_available = False
                resource_id = ResourceManagementService.allocate_resource_id()
        else:
            resource_id = ResourceManagementService.allocate_resource_id()

        self._hydrate_visual_illustration_generation_context(
            generation_context=generation_context,
            resource_id=resource_id,
            resource_type_name=resource_type_name,
            course_code=course_code,
            title=title,
            summary=summary,
        )

        if not uploaded_file_url and not uploaded_object_key:
            uploaded_file_url, uploaded_object_key = self._try_upload_resource_file(
                resource_id=resource_id,
                resource_type_name=resource_type_name,
                title=title,
                content=content_markdown,
                file_format=generation_context["file_format"],
            )
        if uploaded_file_url:
            generation_context["file_url"] = uploaded_file_url
        if uploaded_object_key:
            generation_context["object_key"] = uploaded_object_key

        ResourceManagementService.register_resource(
            {
                "id": resource_id,
                "resource_name": title,
                "resource_type": resource_type_value,
                "knowledge_point_id": task_data.knowledge_point_id,
                "course_id": task_data.course_id,
                "chapter_id": task_data.chapter_id,
                "section_id": task_data.section_id,
                "student_id": task_data.student_id,
                "difficulty_level": generation_context["difficulty_level"],
                "status": 2,
                "version": 1,
                "file_url": generation_context.get("file_url"),
                "file_size": None,
                "file_format": generation_context["file_format"],
                "generation_task_id": task_id,
                "quality_score": data.get("quality_score"),
                "view_count": 0,
                "download_count": 0,
                "favorite_count": 0,
                "create_time": self._parse_time(now_iso),
                "update_time": self._parse_time(now_iso),
                "title": title,
                "summary": summary,
                "content": content_markdown,
                "course_code": course_code,
                "preview_url": generation_context.get("preview_url"),
                "open_url": generation_context.get("open_url"),
                "inline_asset_url": generation_context.get("inline_asset_url"),
                "object_key": generation_context.get("object_key"),
                "generation_context": dict(generation_context),
                resource_type_name: data,
            }
        )
        return resource_id

    async def get_task_status(self, task_id: int) -> ResourceGenerationTaskResponse:
        cached = self.task_cache.get(task_id)
        if cached is not None:
            return ResourceGenerationTaskResponse(**cached)

        if self._db_available:
            try:
                async with async_session_factory() as session:
                    task = await session.get(GenerationTask, task_id)
                    if task is not None and task.task_type == "resource_generation":
                        payload = self._build_task_response_payload(task)
                        self.task_cache[task_id] = payload
                        return ResourceGenerationTaskResponse(**payload)
            except Exception:
                self._db_available = False

        cached = self.task_cache.get(task_id)
        if cached is None:
            raise HTTPException(status_code=404, detail="任务不存在")
        return ResourceGenerationTaskResponse(**cached)

    async def list_tasks(
        self,
        student_id: int | None = None,
        status: int | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> dict[str, Any]:
        items: list[dict[str, Any]]
        if self._db_available:
            try:
                from sqlalchemy import select

                async with async_session_factory() as session:
                    stmt = (
                        select(GenerationTask)
                        .where(GenerationTask.task_type == "resource_generation")
                        .order_by(GenerationTask.id.desc())
                    )
                    if student_id is not None:
                        stmt = stmt.where(GenerationTask.user_id == student_id)
                    result = await session.execute(stmt)
                    items = [self._build_task_response_payload(task) for task in result.scalars().all()]
            except Exception:
                self._db_available = False
                items = list(self.task_cache.values())
        else:
            items = list(self.task_cache.values())

        if student_id is not None:
            items = [item for item in items if int(item["student_id"]) == int(student_id)]
        if status is not None:
            items = [item for item in items if int(item["task_status"]) == int(status)]

        total = len(items)
        start = (page - 1) * page_size
        end = start + page_size
        return {
            "items": [ResourceGenerationTaskResponse(**item) for item in items[start:end]],
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": (total + page_size - 1) // page_size,
        }

    async def cancel_task(self, task_id: int) -> bool:
        current = await self.get_task_status(task_id)
        if current.task_status not in (1, 2):
            raise HTTPException(status_code=400, detail="任务状态不允许取消")
        await self._update_task_status(
            task_id,
            {
                "status_name": "cancelled",
                "task_status": 5,
                "error_message": "用户取消",
                "end_time": datetime.now(),
            },
        )
        return True

    def _build_initial_task_payload(
        self,
        task_data: ResourceGenerationTaskCreate,
        now_iso: str,
    ) -> dict[str, Any]:
        now_dt = self._parse_time(now_iso)
        return {
            "task_name": task_data.task_name,
            "student_id": task_data.student_id,
            "resource_types": ",".join(map(str, task_data.resource_types)),
            "knowledge_point_id": task_data.knowledge_point_id,
            "course_id": task_data.course_id,
            "chapter_id": task_data.chapter_id,
            "section_id": task_data.section_id,
            "task_status": 1,
            "progress": 0,
            "total_resources": len(task_data.resource_types),
            "completed_resources": 0,
            "failed_resources": 0,
            "error_message": None,
            "start_time": None,
            "end_time": None,
            "create_time": now_dt,
            "update_time": now_dt,
        }

    def _build_task_response_payload(self, task: GenerationTask) -> dict[str, Any]:
        payload = dict(task.result_data or {})
        return {
            "id": int(task.id),
            "task_name": payload.get("task_name") or task.payload.get("task_name") or "",
            "student_id": int(payload.get("student_id") or task.user_id),
            "resource_types": payload.get("resource_types")
            or ",".join(map(str, task.payload.get("resource_types", []))),
            "knowledge_point_id": int(
                payload.get("knowledge_point_id") or task.payload.get("knowledge_point_id") or 0
            ),
            "course_id": int(payload.get("course_id") or task.payload.get("course_id") or 0),
            "chapter_id": payload.get("chapter_id") or task.payload.get("chapter_id"),
            "section_id": payload.get("section_id") or task.payload.get("section_id"),
            "task_status": int(
                payload.get("task_status") or self.STATUS_MAP.get(task.status or "pending", 1)
            ),
            "progress": int(payload.get("progress") or 0),
            "total_resources": int(
                payload.get("total_resources") or len(task.payload.get("resource_types", []))
            ),
            "completed_resources": int(payload.get("completed_resources") or 0),
            "failed_resources": int(payload.get("failed_resources") or 0),
            "error_message": payload.get("error_message"),
            "start_time": self._parse_optional_time(payload.get("start_time")),
            "end_time": self._parse_optional_time(payload.get("end_time")),
            "create_time": self._parse_time(task.created_at),
            "update_time": self._parse_time(task.updated_at),
        }

    @staticmethod
    def _extract_content_markdown(resource_type_name: str, data: dict[str, Any]) -> str:
        if resource_type_name == "document":
            return str(data.get("content_markdown") or data.get("content") or "")
        if resource_type_name == "mindmap":
            return str(data.get("mermaid_code") or "")
        if resource_type_name == "question_bank":
            return str(data.get("content_markdown") or json.dumps(data, ensure_ascii=False))
        if resource_type_name == "video":
            return str(data.get("description") or json.dumps(data.get("videos") or [], ensure_ascii=False))
        if resource_type_name == "code_example":
            return str(data.get("code") or data.get("content_markdown") or "")
        return str(data.get("content_markdown") or "")

    @staticmethod
    def _default_file_format(resource_type_value: int, data: dict[str, Any]) -> str:
        if resource_type_value == 5:
            return str((data.get("language") or "txt")).lower()
        return {
            1: "markdown",
            2: "mermaid",
            3: "json",
            4: "json",
            5: "txt",
        }.get(resource_type_value, "txt")

    @staticmethod
    def _default_study_suggestion(resource_type_name: str) -> str:
        mapping = {
            "document": "Read the overview first, then review examples.",
            "mindmap": "Use this to recap the concept structure quickly.",
            "question_bank": "Practice right after learning the topic.",
            "video": "Watch in order and mark unclear segments.",
            "code_example": "Run and modify the code while taking notes.",
        }
        return mapping.get(resource_type_name, "Use in stages with the current learning goal.")

    @staticmethod
    def _jsonable(value: Any) -> Any:
        if isinstance(value, datetime):
            return value.isoformat()
        return value

    @staticmethod
    def _now_iso() -> str:
        return datetime.now().isoformat()

    @staticmethod
    def _parse_time(value: str | None) -> datetime:
        if not value:
            return datetime.now()
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return datetime.now()

    @classmethod
    def _parse_optional_time(cls, value: Any) -> datetime | None:
        if value in (None, ""):
            return None
        if isinstance(value, datetime):
            return value
        return cls._parse_time(str(value))

    def _try_upload_resource_file(
        self,
        *,
        resource_id: int,
        resource_type_name: str,
        title: str,
        content: str,
        file_format: str,
    ) -> tuple[str | None, str | None]:
        try:
            result = self.file_storage.upload_generated_resource(
                resource_id=resource_id,
                resource_type_name=resource_type_name,
                title=title,
                content=content,
                file_format=file_format,
            )
        except Exception:
            return None, None
        return result.get("file_url") or None, result.get("object_key") or None

    async def _resolve_course_code(self, course_id: int) -> str:
        try:
            context = await CourseContextService().resolve(course_id=course_id)
            if context.course_code:
                return context.course_code
        except Exception:
            pass
        return str(course_id)

    @staticmethod
    def _hydrate_visual_illustration_generation_context(
        *,
        generation_context: dict[str, Any],
        resource_id: int,
        resource_type_name: str,
        course_code: str,
        title: str,
        summary: str,
    ) -> None:
        if resource_type_name != "visual_illustration":
            return
        source_file = ResourceService._build_visual_illustration_source_file(
            resource_id=resource_id,
            course_code=course_code,
            title=title,
            summary=summary,
            source_titles=[],
        )
        generation_context["preview_url"] = source_file.preview_url
        generation_context["open_url"] = source_file.open_url
        generation_context["inline_asset_url"] = source_file.preview_url

    async def _publish_task_event(
        self,
        task_id: int,
        task: ResourceGenerationTaskResponse,
    ) -> None:
        chunk_type = "task_status"
        if task.task_status == 3:
            chunk_type = "complete"
        elif task.task_status in (4, 5):
            chunk_type = "error" if task.failed_resources >= task.total_resources else "partial"
        await ResourceGenerationEventService.publish(
            task_id,
            {
                "chunk_type": chunk_type,
                "content": task.model_dump(mode="json"),
            },
        )
