"""
资源管理服务
"""

from __future__ import annotations

import base64
import json
import re
import zipfile
from datetime import datetime
from io import BytesIO
from typing import Any, ClassVar

from fastapi import HTTPException

from app.db.repositories.resource_repository import ResourceRepository
from app.db.session import async_session_factory
from app.schemas.resource import (
    LearningResourceResponse,
    ResourceFavoriteCreate,
    ResourceFavoriteListItem,
    ResourceFavoriteListResponse,
    ResourceFavoriteRecordResponse,
    ResourceFavoriteUpdate,
    ResourceListResponseV2,
    ResourceQueryParams,
)
from app.services.resource_file_storage_service import ResourceFileStorageService


class ResourceManagementService:
    """资源管理服务"""

    _resource_cache: ClassVar[dict[int, dict[str, Any]]] = {}
    _favorite_cache: ClassVar[dict[str, dict[str, Any]]] = {}
    _next_resource_id: ClassVar[int] = 1
    _next_favorite_id: ClassVar[int] = 1

    RESOURCE_TYPE_MAP: ClassVar[dict[int, str]] = {
        1: "document",
        2: "mindmap",
        3: "question_bank",
        4: "video",
        5: "code_example",
    }
    RESOURCE_TYPE_REVERSE_MAP: ClassVar[dict[str, int]] = {
        value: key for key, value in RESOURCE_TYPE_MAP.items()
    }

    def __init__(self) -> None:
        self.resource_cache = self.__class__._resource_cache
        self.favorite_cache = self.__class__._favorite_cache
        self.repository = ResourceRepository()
        self.file_storage = ResourceFileStorageService()
        self._db_available = True

    @classmethod
    def reset_shared_state(cls) -> None:
        cls._resource_cache.clear()
        cls._favorite_cache.clear()
        cls._next_resource_id = 1
        cls._next_favorite_id = 1

    @classmethod
    def allocate_resource_id(cls) -> int:
        resource_id = cls._next_resource_id
        cls._next_resource_id += 1
        return resource_id

    @classmethod
    def register_resource(cls, resource: dict[str, Any]) -> dict[str, Any]:
        resource_id = int(resource["id"])
        cls._resource_cache[resource_id] = dict(resource)
        cls._next_resource_id = max(cls._next_resource_id, resource_id + 1)
        return resource

    async def query_resources(self, params: ResourceQueryParams) -> ResourceListResponseV2:
        resources = await self._load_resources(include_archived=True)
        resources = self._filter_resources(resources, params)
        resources.sort(key=lambda item: item["create_time"], reverse=True)

        total = len(resources)
        start = (params.page - 1) * params.page_size
        end = start + params.page_size
        page_items = resources[start:end]

        return ResourceListResponseV2(
            items=[LearningResourceResponse(**self._to_learning_resource_payload(item)) for item in page_items],
            total=total,
            page=params.page,
            page_size=params.page_size,
            total_pages=(total + params.page_size - 1) // params.page_size,
        )

    async def get_resource_detail(self, resource_id: int) -> dict[str, Any]:
        resource = await self._get_resource_record(resource_id)
        if resource is None:
            raise HTTPException(status_code=404, detail="资源不存在")

        if resource["storage"] == "db":
            await self._increment_view_count(resource_id)
            resource = await self._get_resource_record(resource_id)
        else:
            resource["view_count"] = int(resource.get("view_count") or 0) + 1
            self.resource_cache[resource_id] = resource

        if resource is None:
            raise HTTPException(status_code=404, detail="资源不存在")
        return self._to_resource_detail_payload(resource)

    async def search_resources(
        self,
        keyword: str,
        student_id: int | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> ResourceListResponseV2:
        params = ResourceQueryParams(
            student_id=student_id,
            keyword=keyword,
            page=page,
            page_size=page_size,
        )
        return await self.query_resources(params)

    async def add_favorite(self, favorite_data: ResourceFavoriteCreate) -> ResourceFavoriteRecordResponse:
        resource = await self._get_resource_record(favorite_data.resource_id)
        if resource is None:
            raise HTTPException(status_code=404, detail="资源不存在")

        if resource["storage"] == "db":
            now = self._now_iso()
            async with async_session_factory() as session:
                favorite = await self.repository.get_favorite(
                    session,
                    user_id=favorite_data.user_id,
                    resource_id=favorite_data.resource_id,
                )
                if favorite is not None:
                    raise HTTPException(status_code=400, detail="已经收藏过该资源")
                favorite = await self.repository.create_favorite(
                    session,
                    user_id=favorite_data.user_id,
                    resource_id=favorite_data.resource_id,
                    category=favorite_data.category,
                    notes=favorite_data.notes,
                    created_at=now,
                    updated_at=now,
                )
                await self.repository.create_favorite_history(
                    session,
                    user_id=favorite_data.user_id,
                    resource_id=favorite_data.resource_id,
                    action="favorite",
                    created_at=now,
                    updated_at=now,
                )
                await session.commit()
                return ResourceFavoriteRecordResponse(
                    id=favorite.id,
                    user_id=favorite.user_id,
                    resource_id=favorite.resource_id,
                    category=favorite.category,
                    notes=favorite.notes,
                    create_time=self._parse_iso_datetime(favorite.created_at),
                )

        favorite_key = f"{favorite_data.user_id}_{favorite_data.resource_id}"
        if favorite_key in self.favorite_cache:
            raise HTTPException(status_code=400, detail="已经收藏过该资源")
        favorite_id = self.__class__._next_favorite_id
        self.__class__._next_favorite_id += 1
        favorite = {
            "id": favorite_id,
            "user_id": favorite_data.user_id,
            "resource_id": favorite_data.resource_id,
            "category": favorite_data.category,
            "notes": favorite_data.notes,
            "create_time": datetime.now(),
        }
        self.favorite_cache[favorite_key] = favorite
        resource["favorite_count"] = int(resource.get("favorite_count") or 0) + 1
        self.resource_cache[favorite_data.resource_id] = resource
        return ResourceFavoriteRecordResponse(**favorite)

    async def remove_favorite(self, user_id: int, resource_id: int) -> bool:
        resource = await self._get_resource_record(resource_id)
        if resource is None:
            raise HTTPException(status_code=404, detail="资源不存在")

        if resource["storage"] == "db":
            now = self._now_iso()
            async with async_session_factory() as session:
                favorite = await self.repository.get_favorite(
                    session,
                    user_id=user_id,
                    resource_id=resource_id,
                )
                if favorite is None:
                    raise HTTPException(status_code=404, detail="收藏记录不存在")
                await self.repository.delete_favorite(session, favorite)
                await self.repository.create_favorite_history(
                    session,
                    user_id=user_id,
                    resource_id=resource_id,
                    action="unfavorite",
                    created_at=now,
                    updated_at=now,
                )
                await session.commit()
                return True

        favorite_key = f"{user_id}_{resource_id}"
        if favorite_key not in self.favorite_cache:
            raise HTTPException(status_code=404, detail="收藏记录不存在")
        del self.favorite_cache[favorite_key]
        if resource_id in self.resource_cache:
            cached = self.resource_cache[resource_id]
            cached["favorite_count"] = max(0, int(cached.get("favorite_count") or 0) - 1)
        return True

    async def list_favorites(
        self,
        user_id: int,
        category: str | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> ResourceFavoriteListResponse:
        db_items = await self._load_db_favorite_items(user_id=user_id, category=category)
        memory_items = self._load_memory_favorite_items(user_id=user_id, category=category)

        merged: dict[int, dict[str, Any]] = {item["resource_id"]: item for item in memory_items}
        for item in db_items:
            merged[item["resource_id"]] = item

        favorites = sorted(merged.values(), key=lambda item: item["favorited_at"], reverse=True)
        total = len(favorites)
        start = (page - 1) * page_size
        end = start + page_size
        page_items = favorites[start:end]

        return ResourceFavoriteListResponse(
            items=[ResourceFavoriteListItem(**item) for item in page_items],
            total=total,
            page=page,
            page_size=page_size,
            total_pages=(total + page_size - 1) // page_size,
        )

    async def update_favorite(
        self,
        resource_id: int,
        favorite_data: ResourceFavoriteUpdate,
    ) -> ResourceFavoriteRecordResponse:
        resource = await self._get_resource_record(resource_id)
        if resource is None:
            raise HTTPException(status_code=404, detail="资源不存在")

        if resource["storage"] == "db":
            async with async_session_factory() as session:
                favorite = await self.repository.get_favorite(
                    session,
                    user_id=favorite_data.user_id,
                    resource_id=resource_id,
                )
                if favorite is None:
                    raise HTTPException(status_code=404, detail="收藏记录不存在")
                favorite = await self.repository.update_favorite(
                    session,
                    favorite,
                    category=favorite_data.category,
                    notes=favorite_data.notes,
                    updated_at=self._now_iso(),
                )
                await session.commit()
                return ResourceFavoriteRecordResponse(
                    id=favorite.id,
                    user_id=favorite.user_id,
                    resource_id=favorite.resource_id,
                    category=favorite.category,
                    notes=favorite.notes,
                    create_time=self._parse_iso_datetime(favorite.created_at),
                )

        favorite_key = f"{favorite_data.user_id}_{resource_id}"
        favorite = self.favorite_cache.get(favorite_key)
        if favorite is None:
            raise HTTPException(status_code=404, detail="收藏记录不存在")
        if favorite_data.category is not None:
            favorite["category"] = favorite_data.category
        if favorite_data.notes is not None:
            favorite["notes"] = favorite_data.notes
        return ResourceFavoriteRecordResponse(**favorite)

    async def get_favorite_categories(self, user_id: int) -> list[dict[str, Any]]:
        stats: dict[str, int] = {}

        if self._db_available:
            try:
                async with async_session_factory() as session:
                    items = await self.repository.list_favorites(session, user_id=user_id)
                    for resource in items:
                        favorite = await self.repository.get_favorite(
                            session,
                            user_id=user_id,
                            resource_id=resource.id,
                        )
                        if favorite is None:
                            continue
                        cat = favorite.category or "默认分类"
                        stats[cat] = stats.get(cat, 0) + 1
            except Exception:
                self._db_available = False

        for item in self.favorite_cache.values():
            if item["user_id"] != user_id:
                continue
            cat = item.get("category") or "默认分类"
            stats[cat] = stats.get(cat, 0) + 1

        return [
            {"category": category, "count": count}
            for category, count in sorted(stats.items(), key=lambda entry: (-entry[1], entry[0]))
        ]

    async def generate_download_url(
        self,
        resource_id: int,
        user_id: int,
        format: str = "markdown",
    ) -> dict[str, Any]:
        resource = await self._get_resource_record(resource_id)
        if resource is None:
            raise HTTPException(status_code=404, detail="资源不存在")
        if int(resource["student_id"]) != int(user_id):
            raise HTTPException(status_code=403, detail="无权下载该资源")

        if resource["storage"] == "db":
            async with async_session_factory() as session:
                db_resource = await self.repository.get_resource(session, resource_id)
                if db_resource is None:
                    raise HTTPException(status_code=404, detail="资源不存在")
                await self.repository.increment_download_count(
                    session,
                    resource=db_resource,
                    updated_at=self._now_iso(),
                )
                await session.commit()
                resource["download_count"] = int(db_resource.download_count or 0)
        else:
            resource["download_count"] = int(resource.get("download_count") or 0) + 1
            self.resource_cache[resource_id] = resource

        file_name = f"{resource['resource_name']}.{self._normalize_download_extension(format)}"
        stored_format = str(resource.get("file_format") or "").lower()
        requested_format = self._normalize_requested_format(format)
        object_key = resource.get("object_key")
        if object_key and requested_format == stored_format:
            try:
                return {
                    "resource_id": resource_id,
                    "download_url": self.file_storage.build_download_url(str(object_key)),
                    "format": format,
                    "expires_in": 604800,
                    "file_name": file_name,
                }
            except Exception:
                pass

        content = self._render_download_content(resource, format=format)
        mime = self._get_download_mime(format)
        encoded = base64.b64encode(content.encode("utf-8")).decode("ascii")
        return {
            "resource_id": resource_id,
            "download_url": f"data:{mime};base64,{encoded}",
            "format": format,
            "expires_in": 3600,
            "file_name": file_name,
        }

    async def batch_download(
        self,
        resource_ids: list[int],
        user_id: int,
        format: str = "zip",
    ) -> dict[str, Any]:
        resources: list[dict[str, Any]] = []
        for resource_id in resource_ids:
            resource = await self._get_resource_record(resource_id)
            if resource is not None and int(resource["student_id"]) == int(user_id):
                resources.append(resource)

        if not resources:
            raise HTTPException(status_code=400, detail="没有可下载的资源")

        archive = BytesIO()
        with zipfile.ZipFile(archive, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
            manifest: list[dict[str, Any]] = []
            for resource in resources:
                ext = self._normalize_download_extension(
                    resource.get("file_format") or self._default_file_format(int(resource["resource_type"]))
                )
                entry_name = (
                    f"{int(resource['id']):04d}_"
                    f"{self._sanitize_file_stem(resource['resource_name'])}.{ext}"
                )
                content = self._extract_primary_content(resource)
                zf.writestr(entry_name, content.encode("utf-8"))
                manifest.append(
                    {
                        "id": resource["id"],
                        "title": resource["resource_name"],
                        "resource_type": resource["resource_type"],
                        "file_name": entry_name,
                        "file_format": resource.get("file_format"),
                    }
                )
            zf.writestr(
                "manifest.json",
                json.dumps(manifest, ensure_ascii=False, indent=2).encode("utf-8"),
            )

        encoded = base64.b64encode(archive.getvalue()).decode("ascii")
        return {
            "download_url": f"data:application/zip;base64,{encoded}",
            "format": format,
            "resource_count": len(resources),
            "expires_in": 3600,
            "file_name": f"resources_{datetime.now().strftime('%Y%m%d_%H%M%S')}.zip",
        }

    async def delete_resource(
        self,
        resource_id: int,
        user_id: int,
        hard_delete: bool = False,
    ) -> bool:
        resource = await self._get_resource_record(resource_id)
        if resource is None:
            raise HTTPException(status_code=404, detail="资源不存在")
        if int(resource["student_id"]) != int(user_id):
            raise HTTPException(status_code=403, detail="无权删除该资源")

        if resource["storage"] == "db":
            now = self._now_iso()
            async with async_session_factory() as session:
                db_resource = await self.repository.get_resource(session, resource_id)
                if db_resource is None:
                    raise HTTPException(status_code=404, detail="资源不存在")
                if hard_delete:
                    favorite = await self.repository.get_favorite(
                        session,
                        user_id=user_id,
                        resource_id=resource_id,
                    )
                    if favorite is not None:
                        await self.repository.delete_favorite(session, favorite)
                    await session.delete(db_resource)
                else:
                    db_resource.is_archived = True
                    db_resource.archived_at = now
                    db_resource.archived_by = str(user_id)
                    db_resource.archive_reason = "soft_delete"
                    db_resource.updated_at = now
                await session.commit()
                return True

        if hard_delete:
            self.resource_cache.pop(resource_id, None)
            for key in [key for key, item in self.favorite_cache.items() if item["resource_id"] == resource_id]:
                del self.favorite_cache[key]
        else:
            resource["status"] = 3
            resource["update_time"] = datetime.now()
            self.resource_cache[resource_id] = resource
        return True

    async def get_resource_statistics(self, student_id: int) -> dict[str, Any]:
        resources = await self._load_resources(include_archived=True)
        resources = [item for item in resources if int(item["student_id"]) == int(student_id)]

        type_stats: dict[int, int] = {}
        status_stats: dict[int, int] = {}
        for item in resources:
            type_stats[item["resource_type"]] = type_stats.get(item["resource_type"], 0) + 1
            status_stats[item["status"]] = status_stats.get(item["status"], 0) + 1

        favorite_total = 0
        if self._db_available:
            try:
                async with async_session_factory() as session:
                    favorites = await self.repository.list_favorites(session, user_id=student_id)
                    favorite_total += len(favorites)
            except Exception:
                self._db_available = False
        favorite_total += len([item for item in self.favorite_cache.values() if item["user_id"] == student_id])

        return {
            "total_resources": len(resources),
            "by_type": type_stats,
            "by_status": status_stats,
            "total_favorites": favorite_total,
            "total_views": sum(int(item.get("view_count") or 0) for item in resources),
            "total_downloads": sum(int(item.get("download_count") or 0) for item in resources),
        }

    async def _load_resources(self, *, include_archived: bool) -> list[dict[str, Any]]:
        items: dict[int, dict[str, Any]] = {}

        if self._db_available:
            try:
                async with async_session_factory() as session:
                    from sqlalchemy import select
                    from app.db.models.generated_resource import GeneratedResource

                    stmt = select(GeneratedResource)
                    result = await session.execute(stmt)
                    records = list(result.scalars().all())
                    favorite_counts = await self.repository.count_favorites_by_resource_ids(
                        session,
                        [item.id for item in records],
                    )

                    for record in records:
                        if not include_archived and record.is_archived:
                            continue
                        items[record.id] = self._db_resource_to_record(
                            record,
                            favorite_count=favorite_counts.get(record.id, 0),
                        )
            except Exception:
                self._db_available = False

        for resource_id, cached in self.resource_cache.items():
            archived = bool(cached.get("is_archived")) or int(cached.get("status", 0)) == 3
            if not include_archived and archived:
                continue
            items.setdefault(resource_id, self._normalize_memory_record(cached))

        return list(items.values())

    async def _get_resource_record(self, resource_id: int) -> dict[str, Any] | None:
        if self._db_available:
            try:
                async with async_session_factory() as session:
                    resource = await self.repository.get_resource(session, resource_id)
                    if resource is not None:
                        counts = await self.repository.count_favorites_by_resource_ids(session, [resource_id])
                        return self._db_resource_to_record(resource, favorite_count=counts.get(resource_id, 0))
            except Exception:
                self._db_available = False
        cached = self.resource_cache.get(resource_id)
        if cached is not None:
            return self._normalize_memory_record(cached)
        return None

    async def _increment_view_count(self, resource_id: int) -> None:
        if not self._db_available:
            return
        try:
            async with async_session_factory() as session:
                resource = await self.repository.get_resource(session, resource_id)
                if resource is None:
                    return
                ctx = dict(resource.generation_context or {})
                ctx["view_count"] = int(ctx.get("view_count") or 0) + 1
                resource.generation_context = ctx
                resource.updated_at = self._now_iso()
                await session.commit()
        except Exception:
            self._db_available = False

    async def _load_db_favorite_items(
        self,
        *,
        user_id: int,
        category: str | None,
    ) -> list[dict[str, Any]]:
        from sqlalchemy import select
        from app.db.models.generated_resource import GeneratedResource, ResourceFavorite

        if not self._db_available:
            return []
        try:
            async with async_session_factory() as session:
                stmt = (
                    select(ResourceFavorite, GeneratedResource)
                    .join(GeneratedResource, GeneratedResource.id == ResourceFavorite.resource_id)
                    .where(ResourceFavorite.user_id == user_id)
                    .order_by(ResourceFavorite.id.desc())
                )
                if category:
                    stmt = stmt.where(ResourceFavorite.category == category)
                result = await session.execute(stmt)
                rows = result.all()
                counts = await self.repository.count_favorites_by_resource_ids(
                    session,
                    [row[1].id for row in rows],
                )

                items: list[dict[str, Any]] = []
                for favorite, resource in rows:
                    normalized = self._db_resource_to_record(
                        resource,
                        favorite_count=counts.get(resource.id, 0),
                    )
                    items.append(
                        {
                            **self._to_learning_resource_payload(normalized),
                            "id": normalized["id"],
                            "resource_id": normalized["id"],
                            "category": favorite.category or "默认分类",
                            "notes": favorite.notes,
                            "favorited_at": self._parse_iso_datetime(favorite.created_at),
                        }
                    )
                return items
        except Exception:
            self._db_available = False
            return []

    def _load_memory_favorite_items(self, *, user_id: int, category: str | None) -> list[dict[str, Any]]:
        items: list[dict[str, Any]] = []
        for favorite in self.favorite_cache.values():
            if favorite["user_id"] != user_id:
                continue
            if category and favorite.get("category") != category:
                continue
            resource = self.resource_cache.get(favorite["resource_id"])
            if resource is None:
                continue
            normalized = self._normalize_memory_record(resource)
            items.append(
                {
                    **self._to_learning_resource_payload(normalized),
                    "id": normalized["id"],
                    "resource_id": normalized["id"],
                    "category": favorite.get("category") or "默认分类",
                    "notes": favorite.get("notes"),
                    "favorited_at": favorite.get("create_time") or datetime.now(),
                }
            )
        return items

    def _filter_resources(
        self,
        resources: list[dict[str, Any]],
        params: ResourceQueryParams,
    ) -> list[dict[str, Any]]:
        keyword = (params.keyword or "").strip().lower()
        filtered: list[dict[str, Any]] = []
        for item in resources:
            if params.student_id is not None and int(item["student_id"]) != int(params.student_id):
                continue
            if params.course_id is not None and int(item["course_id"] or 0) != int(params.course_id):
                continue
            if params.resource_type is not None and int(item["resource_type"]) != int(params.resource_type):
                continue
            if params.knowledge_point_id is not None and int(item["knowledge_point_id"] or 0) != int(params.knowledge_point_id):
                continue
            if params.status is not None and int(item["status"]) != int(params.status):
                continue
            if params.difficulty_level is not None and int(item["difficulty_level"]) != int(params.difficulty_level):
                continue
            if keyword and keyword not in self._build_searchable_text(item):
                continue
            filtered.append(item)
        return filtered

    def _build_searchable_text(self, resource: dict[str, Any]) -> str:
        payload = self._to_resource_detail_payload(resource)
        values = [
            payload.get("title"),
            payload.get("description"),
            payload.get("content"),
            json.dumps(payload.get("document"), ensure_ascii=False) if payload.get("document") else None,
            json.dumps(payload.get("mindmap"), ensure_ascii=False) if payload.get("mindmap") else None,
            json.dumps(payload.get("question_bank"), ensure_ascii=False) if payload.get("question_bank") else None,
            json.dumps(payload.get("videos"), ensure_ascii=False) if payload.get("videos") else None,
            json.dumps(payload.get("code_example"), ensure_ascii=False) if payload.get("code_example") else None,
        ]
        return " ".join(str(value).lower() for value in values if value)

    def _db_resource_to_record(self, resource: Any, *, favorite_count: int) -> dict[str, Any]:
        ctx = dict(resource.generation_context or {})
        resource_type_value = ctx.get("resource_type_value")
        if resource_type_value is None:
            resource_type_value = self.RESOURCE_TYPE_REVERSE_MAP.get(resource.resource_type, 1)
        create_time = self._parse_iso_datetime(resource.created_at)
        update_time = self._parse_iso_datetime(resource.updated_at)
        return {
            "id": int(resource.id),
            "resource_name": resource.title,
            "resource_type": int(resource_type_value),
            "knowledge_point_id": ctx.get("knowledge_point_id"),
            "course_id": ctx.get("course_id"),
            "chapter_id": ctx.get("chapter_id"),
            "section_id": ctx.get("section_id"),
            "student_id": int(resource.user_id),
            "difficulty_level": int(ctx.get("difficulty_level") or 1),
            "status": int(ctx.get("status") or (3 if resource.is_archived else 2)),
            "version": int(ctx.get("version") or 1),
            "file_url": ctx.get("file_url"),
            "object_key": ctx.get("object_key"),
            "file_size": ctx.get("file_size"),
            "file_format": ctx.get("file_format") or self._default_file_format(int(resource_type_value)),
            "generation_task_id": ctx.get("generation_task_id"),
            "quality_score": ctx.get("quality_score"),
            "view_count": int(ctx.get("view_count") or 0),
            "download_count": int(resource.download_count or 0),
            "favorite_count": int(favorite_count),
            "create_time": create_time,
            "update_time": update_time,
            "title": resource.title,
            "description": resource.summary,
            "summary": resource.summary,
            "source_titles": list(resource.source_titles or []),
            "study_suggestion": resource.study_suggestion,
            "content": resource.content_markdown,
            "document": ctx.get("document"),
            "mindmap": ctx.get("mindmap"),
            "question_bank": ctx.get("question_bank"),
            "video": ctx.get("video"),
            "videos": ctx.get("video", {}).get("videos") if isinstance(ctx.get("video"), dict) else [],
            "code_example": ctx.get("code_example"),
            "questions": self._extract_question_list(ctx.get("question_bank")),
            "course_name": ctx.get("course_name") or f"课程{ctx.get('course_id') or ''}",
            "knowledge_point_name": ctx.get("knowledge_point_name") or f"知识点{ctx.get('knowledge_point_id') or ''}",
            "student_name": ctx.get("student_name") or f"学生{resource.user_id}",
            "is_archived": bool(resource.is_archived),
            "storage": "db",
        }

    def _normalize_memory_record(self, resource: dict[str, Any]) -> dict[str, Any]:
        normalized = dict(resource)
        normalized.setdefault("resource_name", normalized.get("title") or "资源")
        normalized.setdefault("title", normalized.get("resource_name"))
        normalized.setdefault("description", normalized.get("summary") or normalized.get("resource_name"))
        normalized.setdefault("summary", normalized.get("description") or normalized.get("resource_name"))
        normalized.setdefault("source_titles", [])
        normalized.setdefault("study_suggestion", None)
        normalized.setdefault("view_count", 0)
        normalized.setdefault("download_count", 0)
        normalized.setdefault("favorite_count", 0)
        normalized.setdefault("status", 2)
        normalized.setdefault("version", 1)
        normalized.setdefault("file_format", self._default_file_format(int(normalized.get("resource_type") or 1)))
        normalized.setdefault("object_key", normalized.get("object_key"))
        normalized.setdefault("content", self._extract_primary_content(normalized))
        normalized.setdefault(
            "videos",
            normalized.get("video", {}).get("videos") if isinstance(normalized.get("video"), dict) else [],
        )
        normalized.setdefault("questions", self._extract_question_list(normalized.get("question_bank")))
        normalized.setdefault("course_name", f"课程{normalized.get('course_id') or ''}")
        normalized.setdefault("knowledge_point_name", f"知识点{normalized.get('knowledge_point_id') or ''}")
        normalized.setdefault("student_name", f"学生{normalized.get('student_id') or ''}")
        normalized.setdefault("storage", "memory")
        return normalized

    def _to_learning_resource_payload(self, resource: dict[str, Any]) -> dict[str, Any]:
        return {
            "id": resource["id"],
            "resource_name": resource["resource_name"],
            "resource_type": resource["resource_type"],
            "knowledge_point_id": resource["knowledge_point_id"] or 0,
            "course_id": resource["course_id"] or 0,
            "chapter_id": resource.get("chapter_id"),
            "section_id": resource.get("section_id"),
            "student_id": resource["student_id"],
            "difficulty_level": resource["difficulty_level"],
            "status": resource["status"],
            "version": resource["version"],
            "file_url": resource.get("file_url"),
            "file_size": resource.get("file_size"),
            "file_format": resource.get("file_format"),
            "generation_task_id": resource.get("generation_task_id"),
            "quality_score": resource.get("quality_score"),
            "view_count": resource.get("view_count") or 0,
            "download_count": resource.get("download_count") or 0,
            "favorite_count": resource.get("favorite_count") or 0,
            "create_time": resource["create_time"],
            "update_time": resource["update_time"],
        }

    def _to_resource_detail_payload(self, resource: dict[str, Any]) -> dict[str, Any]:
        payload = self._normalize_memory_record(resource)
        payload["resource_id"] = payload["id"]
        payload["resource_title"] = payload["title"]
        payload["resource_description"] = payload["description"]
        payload["created_at"] = payload["create_time"]
        payload["resource_created_at"] = payload["create_time"]
        payload["is_favorited"] = bool(payload.get("favorite_count"))
        return payload

    def _render_download_content(self, resource: dict[str, Any], *, format: str) -> str:
        detail = self._to_resource_detail_payload(resource)
        if format == "html":
            title = detail["title"]
            body = detail.get("content") or detail.get("description") or ""
            return f"<html><body><h1>{title}</h1><pre>{body}</pre></body></html>"
        if format == "pdf":
            return detail.get("content") or detail.get("description") or detail["title"]
        return detail.get("content") or detail.get("description") or detail["title"]

    def _extract_primary_content(self, resource: dict[str, Any]) -> str:
        for key in ("content", "document", "mindmap", "question_bank", "video", "code_example"):
            value = resource.get(key)
            if isinstance(value, str) and value.strip():
                return value
            if isinstance(value, dict):
                if "content_markdown" in value:
                    return str(value["content_markdown"])
                if "mermaid_code" in value:
                    return str(value["mermaid_code"])
                if "code" in value:
                    return str(value["code"])
                return json.dumps(value, ensure_ascii=False)
        return resource.get("summary") or resource.get("resource_name") or ""

    def _extract_question_list(self, question_bank: Any) -> list[dict[str, Any]]:
        if not isinstance(question_bank, dict):
            return []
        questions = question_bank.get("questions")
        if isinstance(questions, list):
            normalized: list[dict[str, Any]] = []
            for item in questions:
                if not isinstance(item, dict):
                    continue
                normalized.append(
                    {
                        "question": item.get("question") or item.get("question_content") or "",
                        "options": item.get("options"),
                        "answer": item.get("answer") or item.get("correct_answer"),
                        "explanation": item.get("explanation") or item.get("answer_analysis"),
                        "question_type": item.get("question_type") or 5,
                        "difficulty": item.get("difficulty") or item.get("difficulty_level") or 1,
                    }
                )
            return normalized
        return []

    @staticmethod
    def _now_iso() -> str:
        return datetime.now().isoformat()

    @staticmethod
    def _parse_iso_datetime(value: str | None) -> datetime:
        if not value:
            return datetime.now()
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return datetime.now()

    @staticmethod
    def _get_download_mime(format: str) -> str:
        if format == "html":
            return "text/html"
        if format == "pdf":
            return "text/plain"
        return "text/markdown"

    @staticmethod
    def _normalize_download_extension(format: str) -> str:
        if format == "pdf":
            return "pdf"
        if format == "html":
            return "html"
        if format == "markdown":
            return "md"
        if format == "mermaid":
            return "mmd"
        if format in {"json", "py", "java", "js", "cpp", "txt", "md"}:
            return format
        return "md"

    @staticmethod
    def _normalize_requested_format(format: str) -> str:
        normalized = (format or "").lower()
        if normalized == "markdown":
            return "markdown"
        if normalized == "html":
            return "html"
        if normalized == "pdf":
            return "pdf"
        return normalized

    @staticmethod
    def _sanitize_file_stem(value: str) -> str:
        cleaned = re.sub(r'[\\/:*?"<>|]+', "-", str(value or "").strip())
        cleaned = re.sub(r"\s+", "_", cleaned).strip("._-")
        return cleaned[:80] or "resource"

    @staticmethod
    def _default_file_format(resource_type: int) -> str:
        return {
            1: "markdown",
            2: "mermaid",
            3: "json",
            4: "json",
            5: "txt",
        }.get(resource_type, "txt")
