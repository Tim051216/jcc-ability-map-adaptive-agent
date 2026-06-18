from __future__ import annotations

import html
import json
import mimetypes
import re
import shutil
import subprocess
import zipfile
from datetime import datetime
from pathlib import Path
from urllib.parse import quote
from xml.etree import ElementTree as ET

from fastapi import HTTPException
from fastapi.responses import FileResponse, RedirectResponse
from sqlalchemy.exc import IntegrityError
from sqlalchemy import func, select

from app.db.models.resource_source_file import ResourceSourceFile
from app.db.session import ai_data_engine, ai_data_session_factory
from app.schemas.common import ResourceSourceFileRef
from app.services.resource_source_file_storage_service import ResourceSourceFileStorageService


class ResourceSourceFileService:
    LIST_PREVIEW_FILE_LIMIT = 3
    _indexed_refs_cache: dict[int, list[ResourceSourceFileRef]] = {}
    _indexed_counts_cache: dict[int, int] = {}
    _index_cache_ready: bool = False
    _local_file_lookup_cache: dict[int, ResourceSourceFile] = {}
    SOFTWARE_ENGINEERING_RESOURCE_IDS = (101, 102, 103, 104, 105, 106)
    SUPPORTED_EXTENSIONS = {
        ".doc",
        ".docx",
        ".jpg",
        ".jpeg",
        ".m3u8",
        ".md",
        ".mov",
        ".mp4",
        ".pdf",
        ".png",
        ".ppt",
        ".pptx",
        ".txt",
        ".webm",
        ".xls",
        ".xlsx",
    }
    INLINE_EXTENSIONS = {".jpg", ".jpeg", ".md", ".pdf", ".png", ".txt"}
    OFFICE_EXTENSIONS = {".doc", ".docx", ".ppt", ".pptx", ".xls", ".xlsx"}
    OPENXML_HTML_FALLBACK_EXTENSIONS = {".docx", ".pptx", ".xlsx"}
    VIDEO_EXTENSIONS = {".m3u8", ".mov", ".mp4", ".webm"}
    EXCLUDED_PATH_PARTS = {"bin", "build", "crunch", "drawable", "gen", "libs", "res"}
    EXCLUDED_NAMES = {"~$资源文件.doc"}
    MAX_FILES_PER_RESOURCE = 48
    OPEN_URL_TEMPLATE = "/api/v1/resource/source-files/{file_id}/open"
    PREVIEW_URL_TEMPLATE = "/api/v1/resource/source-files/{file_id}/preview"
    PREVIEW_ASSET_URL_TEMPLATE = "/api/v1/resource/source-files/{file_id}/preview-assets/{asset_path}"
    MATERIAL_CATEGORY_RULES: dict[int, list[str]] = {
        101: ["1.教学大纲-进度计划", "2.教案"],
        102: ["★《软件工程与实践》4版PPT[新]"],
        103: ["2.教案（多种教学模式）"],
        104: ["3.企业实用报告案例（指导）", "4.实验报告-样例", "7.实验-课设参考资料"],
        105: ["4. 习题与答案（含自测）（加密）", "8.复习题及答案（加密）", "9.试卷库-测试[参考]（加密）"],
        106: ["1.教学大纲-进度计划", "2.教案", "★《软件工程与实践》4版PPT[新]", "7.实验-课设参考资料"],
    }

    def __init__(self) -> None:
        root = Path(__file__).resolve().parents[3]
        self._repo_root = root
        self._materials_root = root / "docs" / "course-materials" / "software-engineering-4th"
        self._preview_root = root / "output" / "resource-source-previews"
        self._soffice_path = self._detect_soffice_path()
        self._ffmpeg_path = shutil.which("ffmpeg")
        self._storage = ResourceSourceFileStorageService()

    async def list_for_resource(
        self,
        *,
        resource_id: int,
        course_code: str,
        limit: int | None = None,
    ) -> list[ResourceSourceFileRef]:
        if course_code != "software_engineering_4th":
            return []
        await self._ensure_table()
        return await self.list_indexed_for_resource(
            resource_id=resource_id,
            course_code=course_code,
            limit=limit,
        )

    async def list_indexed_for_resource(
        self,
        *,
        resource_id: int,
        course_code: str,
        limit: int | None = None,
    ) -> list[ResourceSourceFileRef]:
        if course_code != "software_engineering_4th":
            return []
        cached = self.__class__._indexed_refs_cache.get(resource_id)
        if cached is not None:
            return list(cached if limit is None else cached[:limit])
        try:
            async with ai_data_session_factory() as session:
                stmt = (
                    select(ResourceSourceFile)
                    .where(ResourceSourceFile.resource_id == resource_id)
                    .order_by(ResourceSourceFile.sort_order.asc(), ResourceSourceFile.display_name.asc())
                )
                if limit is not None:
                    stmt = stmt.limit(limit)
                result = await session.execute(stmt)
                rows = result.scalars().all()
        except Exception:
            rows = self._local_rows_for_resource(resource_id=resource_id, limit=limit)
        return [self._to_ref(row) for row in rows]

    async def count_for_resource(self, *, resource_id: int, course_code: str) -> int:
        if course_code != "software_engineering_4th":
            return 0
        await self._ensure_table()
        return await self.count_indexed_for_resource(
            resource_id=resource_id,
            course_code=course_code,
        )

    async def count_indexed_for_resource(self, *, resource_id: int, course_code: str) -> int:
        if course_code != "software_engineering_4th":
            return 0
        cached = self.__class__._indexed_counts_cache.get(resource_id)
        if cached is not None:
            return cached
        try:
            async with ai_data_session_factory() as session:
                result = await session.execute(
                    select(func.count(ResourceSourceFile.id)).where(ResourceSourceFile.resource_id == resource_id)
                )
                return int(result.scalar_one() or 0)
        except Exception:
            return len(self._local_rows_for_resource(resource_id=resource_id, limit=None))

    async def list_indexed_for_resources(
        self,
        *,
        resource_ids: list[int],
        course_code: str,
        limit: int | None = None,
    ) -> dict[int, list[ResourceSourceFileRef]]:
        if course_code != "software_engineering_4th" or not resource_ids:
            return {}
        if self.__class__._index_cache_ready:
            return {
                resource_id: list(
                    self.__class__._indexed_refs_cache.get(resource_id, [])
                    if limit is None
                    else self.__class__._indexed_refs_cache.get(resource_id, [])[:limit]
                )
                for resource_id in resource_ids
            }

        try:
            async with ai_data_session_factory() as session:
                stmt = (
                    select(ResourceSourceFile)
                    .where(ResourceSourceFile.resource_id.in_(resource_ids))
                    .order_by(
                        ResourceSourceFile.resource_id.asc(),
                        ResourceSourceFile.sort_order.asc(),
                        ResourceSourceFile.display_name.asc(),
                    )
                )
                result = await session.execute(stmt)
                rows = result.scalars().all()
        except Exception:
            grouped_rows = self._local_rows_grouped_by_resource(resource_ids=resource_ids)
            return {
                resource_id: [self._to_ref(row) for row in (grouped_rows.get(resource_id, [])[:limit] if limit is not None else grouped_rows.get(resource_id, []))]
                for resource_id in resource_ids
            }

        grouped: dict[int, list[ResourceSourceFileRef]] = {resource_id: [] for resource_id in resource_ids}
        for row in rows:
            items = grouped.setdefault(int(row.resource_id), [])
            if limit is None or len(items) < limit:
                items.append(self._to_ref(row))
        return grouped

    async def count_indexed_for_resources(
        self,
        *,
        resource_ids: list[int],
        course_code: str,
    ) -> dict[int, int]:
        if course_code != "software_engineering_4th" or not resource_ids:
            return {}
        if self.__class__._index_cache_ready:
            return {
                resource_id: int(self.__class__._indexed_counts_cache.get(resource_id, 0))
                for resource_id in resource_ids
            }

        try:
            async with ai_data_session_factory() as session:
                result = await session.execute(
                    select(ResourceSourceFile.resource_id, func.count(ResourceSourceFile.id))
                    .where(ResourceSourceFile.resource_id.in_(resource_ids))
                    .group_by(ResourceSourceFile.resource_id)
                )
                rows = result.all()
        except Exception:
            grouped_rows = self._local_rows_grouped_by_resource(resource_ids=resource_ids)
            return {resource_id: len(grouped_rows.get(resource_id, [])) for resource_id in resource_ids}

        counts = {resource_id: 0 for resource_id in resource_ids}
        for resource_id, count in rows:
            counts[int(resource_id)] = int(count or 0)
        return counts

    async def prebuild_software_engineering_index(self) -> None:
        await self._ensure_table()
        for resource_id in self.SOFTWARE_ENGINEERING_RESOURCE_IDS:
            await self._sync_resource_files(
                resource_id=resource_id,
                course_code="software_engineering_4th",
            )
        await self._refresh_index_cache()

    async def _refresh_index_cache(self) -> None:
        async with ai_data_session_factory() as session:
            result = await session.execute(
                select(ResourceSourceFile)
                .where(ResourceSourceFile.course_code == "software_engineering_4th")
                .order_by(
                    ResourceSourceFile.resource_id.asc(),
                    ResourceSourceFile.sort_order.asc(),
                    ResourceSourceFile.display_name.asc(),
                )
            )
            rows = result.scalars().all()

        refs_cache: dict[int, list[ResourceSourceFileRef]] = {}
        counts_cache: dict[int, int] = {}
        for row in rows:
            resource_id = int(row.resource_id)
            refs_cache.setdefault(resource_id, []).append(self._to_ref(row))
            counts_cache[resource_id] = counts_cache.get(resource_id, 0) + 1

        self.__class__._indexed_refs_cache = refs_cache
        self.__class__._indexed_counts_cache = counts_cache
        self.__class__._index_cache_ready = True

    async def open_source_file(self, file_id: int) -> FileResponse:
        source_file = await self._load_source_file(file_id)
        file_path = self._require_source_path(source_file)

        if self._storage.is_enabled():
            try:
                return RedirectResponse(url=self._build_source_storage_url(source_file))
            except Exception:
                pass

        disposition = "inline" if source_file.is_inline_previewable else "attachment"
        headers = {
            "Content-Disposition": f"{disposition}; filename*=UTF-8''{quote(file_path.name)}",
        }
        media_type = source_file.mime_type or mimetypes.guess_type(file_path.name)[0] or "application/octet-stream"
        return FileResponse(path=file_path, media_type=media_type, headers=headers)

    async def preview_source_file(self, file_id: int) -> FileResponse:
        source_file = await self._load_source_file(file_id)
        file_path = self._require_source_path(source_file)
        preview_mode = self._get_preview_mode(source_file)

        if preview_mode in {"image", "pdf", "text"}:
            media_type = source_file.mime_type or mimetypes.guess_type(file_path.name)[0] or "application/octet-stream"
            headers = {
                "Content-Disposition": f"inline; filename*=UTF-8''{quote(file_path.name)}",
            }
            return FileResponse(path=file_path, media_type=media_type, headers=headers)

        if preview_mode == "html":
            preview_path = self._ensure_office_preview_artifact(source_file, file_path)
            if self._storage.is_enabled():
                return RedirectResponse(
                    url=self._build_preview_storage_url(source_file=source_file, preview_path=preview_path, content_type="text/html")
                )
            return FileResponse(path=preview_path, media_type="text/html")

        if preview_mode == "office-pdf":
            preview_path = self._ensure_office_preview_artifact(source_file, file_path)
            if self._storage.is_enabled():
                return RedirectResponse(
                    url=self._build_preview_storage_url(
                        source_file=source_file,
                        preview_path=preview_path,
                        content_type="application/pdf",
                    )
                )
            return FileResponse(path=preview_path, media_type="application/pdf")

        if preview_mode == "video":
            if file_path.suffix.lower() == ".m3u8":
                return FileResponse(path=file_path, media_type="application/vnd.apple.mpegurl")
            preview_path = self._ensure_video_preview_artifact(source_file, file_path)
            media_type = "application/vnd.apple.mpegurl" if preview_path.suffix.lower() == ".m3u8" else (
                source_file.mime_type or mimetypes.guess_type(file_path.name)[0] or "application/octet-stream"
            )
            if self._storage.is_enabled() and preview_path.suffix.lower() != ".m3u8":
                return RedirectResponse(
                    url=self._build_preview_storage_url(source_file=source_file, preview_path=preview_path, content_type=media_type)
                )
            headers = {
                "Content-Disposition": f"inline; filename*=UTF-8''{quote(preview_path.name)}",
            }
            return FileResponse(path=preview_path, media_type=media_type, headers=headers)

        raise HTTPException(status_code=415, detail="resource source file preview unsupported")

    async def preview_source_file_asset(self, file_id: int, asset_path: str) -> FileResponse:
        source_file = await self._load_source_file(file_id)
        file_path = self._require_source_path(source_file)
        if self._get_preview_mode(source_file) != "video":
            raise HTTPException(status_code=415, detail="resource source file preview assets unsupported")

        asset_root = self._ensure_video_preview_directory(source_file, file_path)
        requested = (asset_root / asset_path).resolve()
        if asset_root.resolve() not in requested.parents and requested != asset_root.resolve():
            raise HTTPException(status_code=400, detail="invalid preview asset path")
        if not requested.exists() or not requested.is_file():
            raise HTTPException(status_code=404, detail="resource source file preview asset not found")

        media_type = mimetypes.guess_type(requested.name)[0] or "application/octet-stream"
        return FileResponse(path=requested, media_type=media_type)

    async def _load_source_file(self, file_id: int) -> ResourceSourceFile:
        await self._ensure_table()
        source_file = None
        try:
            async with ai_data_session_factory() as session:
                source_file = await session.get(ResourceSourceFile, file_id)
        except Exception:
            source_file = self._build_local_source_file_lookup().get(file_id)
        if source_file is None:
            source_file = self._build_local_source_file_lookup().get(file_id)
        if source_file is None:
            raise HTTPException(status_code=404, detail="resource source file not found")
        return source_file

    def _require_source_path(self, source_file: ResourceSourceFile) -> Path:
        file_path = Path(source_file.absolute_path)
        if not file_path.exists() or not file_path.is_file():
            raise HTTPException(status_code=404, detail="resource source file missing on disk")
        return file_path

    async def _ensure_table(self) -> None:
        try:
            async with ai_data_engine.begin() as conn:
                await conn.run_sync(lambda sync_conn: ResourceSourceFile.__table__.create(sync_conn, checkfirst=True))
        except Exception:
            return

    async def _sync_resource_files(self, *, resource_id: int, course_code: str) -> None:
        async with ai_data_session_factory() as session:
            existing = await session.execute(
                select(ResourceSourceFile.id, ResourceSourceFile.relative_path).where(ResourceSourceFile.resource_id == resource_id)
            )
            existing_rows = existing.all()
            existing_paths = {str(relative_path) for _, relative_path in existing_rows}

        selected_files = self._collect_selected_files(resource_id=resource_id)
        if not selected_files:
            return

        pending_files = [item for item in selected_files if str(item["relative_path"]) not in existing_paths]
        if not pending_files:
            return

        async with ai_data_session_factory() as session:
            preview_map = self._load_preview_map()
            created_at = datetime.now().isoformat(timespec="seconds")
            session.add_all(
                [
                    ResourceSourceFile(
                        resource_id=resource_id,
                        course_code=course_code,
                        display_name=item["display_name"],
                        relative_path=item["relative_path"],
                        absolute_path=item["absolute_path"],
                        top_level_category=item["top_level_category"],
                        file_extension=item["file_extension"],
                        mime_type=item["mime_type"],
                        file_size=item["file_size"],
                        preview_text=preview_map.get(item["relative_path"]),
                        is_inline_previewable=item["is_inline_previewable"],
                        sort_order=item["sort_order"],
                        created_at=created_at,
                        updated_at=created_at,
                    )
                    for item in pending_files
                ]
            )
            try:
                await session.commit()
            except IntegrityError:
                await session.rollback()

    def _collect_selected_files(self, *, resource_id: int) -> list[dict[str, object]]:
        course_dir = self._find_course_directory()
        if course_dir is None:
            return []

        allowed_prefixes = self.MATERIAL_CATEGORY_RULES.get(resource_id)
        rows: list[dict[str, object]] = []
        for file_path in sorted(course_dir.rglob("*")):
            if not file_path.is_file():
                continue
            if file_path.name in self.EXCLUDED_NAMES or file_path.name.startswith("~$"):
                continue
            suffix = file_path.suffix.lower()
            if suffix not in self.SUPPORTED_EXTENSIONS:
                continue

            rel_path = file_path.relative_to(course_dir)
            rel_parts = rel_path.parts
            if any(part.lower() in self.EXCLUDED_PATH_PARTS for part in rel_parts[:-1]):
                continue

            top_level = rel_parts[0] if rel_parts else file_path.name
            if allowed_prefixes and not any(
                top_level.startswith(prefix) or file_path.name == prefix for prefix in allowed_prefixes
            ):
                continue

            mime_type = mimetypes.guess_type(file_path.name)[0] or "application/octet-stream"
            relative_path = rel_path.as_posix()
            rows.append(
                {
                    "display_name": file_path.name,
                    "relative_path": relative_path,
                    "absolute_path": str(file_path.resolve()),
                    "top_level_category": top_level,
                    "file_extension": suffix,
                    "mime_type": mime_type,
                    "file_size": file_path.stat().st_size,
                    "is_inline_previewable": suffix in self.INLINE_EXTENSIONS,
                    "sort_order": self._sort_order(top_level, relative_path),
                }
            )

        rows.sort(key=lambda item: (int(item["sort_order"]), str(item["relative_path"])))
        return rows[: self.MAX_FILES_PER_RESOURCE]

    def _build_local_source_file_lookup(self) -> dict[int, ResourceSourceFile]:
        if self.__class__._local_file_lookup_cache:
            return self.__class__._local_file_lookup_cache

        lookup: dict[int, ResourceSourceFile] = {
            row.id: row for row in self._build_builtin_preview_rows()
        }
        next_file_id = 1
        preview_map = self._load_preview_map()

        for resource_id in self.SOFTWARE_ENGINEERING_RESOURCE_IDS:
            for item in self._collect_selected_files(resource_id=resource_id):
                lookup[next_file_id] = ResourceSourceFile(
                    id=next_file_id,
                    resource_id=resource_id,
                    course_code="software_engineering_4th",
                    display_name=str(item["display_name"]),
                    relative_path=str(item["relative_path"]),
                    absolute_path=str(item["absolute_path"]),
                    top_level_category=str(item["top_level_category"]),
                    file_extension=str(item["file_extension"]),
                    mime_type=str(item["mime_type"]),
                    file_size=int(item["file_size"]) if item.get("file_size") is not None else None,
                    preview_text=preview_map.get(str(item["relative_path"])),
                    is_inline_previewable=bool(item["is_inline_previewable"]),
                    sort_order=int(item["sort_order"]),
                    created_at=None,
                    updated_at=None,
                )
                next_file_id += 1

        self.__class__._local_file_lookup_cache = lookup
        return lookup

    def _build_builtin_preview_rows(self) -> list[ResourceSourceFile]:
        preview_root = self._repo_root / "a3-student-react-web" / "public"
        builtin_files = [
            {
                "id": 901,
                "resource_id": 900001,
                "display_name": "project-demo.mp4",
                "relative_path": "/videos/software-engineering-4th/project-demo.mp4",
                "absolute_path": preview_root / "videos" / "software-engineering-4th" / "project-demo.mp4",
                "top_level_category": "视频",
                "file_extension": ".mp4",
                "mime_type": "video/mp4",
                "file_size": 13631541,
                "preview_text": "软件工程课程项目演示视频",
                "is_inline_previewable": True,
                "sort_order": 0,
            },
            {
                "id": 902,
                "resource_id": 900002,
                "display_name": "visio-flow-demo.mp4",
                "relative_path": "/videos/software-engineering-4th/visio-flow-demo.mp4",
                "absolute_path": preview_root / "videos" / "software-engineering-4th" / "visio-flow-demo.mp4",
                "top_level_category": "视频",
                "file_extension": ".mp4",
                "mime_type": "video/mp4",
                "file_size": 24477668,
                "preview_text": "系统流程设计演示视频",
                "is_inline_previewable": True,
                "sort_order": 0,
            },
            {
                "id": 903,
                "resource_id": 900003,
                "display_name": "cloud-app-demo.mp4",
                "relative_path": "/videos/software-engineering-4th/cloud-app-demo.mp4",
                "absolute_path": preview_root / "videos" / "software-engineering-4th" / "cloud-app-demo.mp4",
                "top_level_category": "视频",
                "file_extension": ".mp4",
                "mime_type": "video/mp4",
                "file_size": 78228810,
                "preview_text": "云端应用集成演示视频",
                "is_inline_previewable": True,
                "sort_order": 0,
            },
            {
                "id": 904,
                "resource_id": 900004,
                "display_name": "software-engineering-ui-board.jpg",
                "relative_path": "/preview-assets/software-engineering-ui-board.jpg",
                "absolute_path": preview_root / "preview-assets" / "software-engineering-ui-board.jpg",
                "top_level_category": "图片",
                "file_extension": ".jpg",
                "mime_type": "image/jpeg",
                "file_size": 310742,
                "preview_text": "软件工程界面素材参考图",
                "is_inline_previewable": True,
                "sort_order": 0,
            },
            {
                "id": 905,
                "resource_id": 900005,
                "display_name": "software-engineering-preview-note.txt",
                "relative_path": "/preview-assets/software-engineering-preview-note.txt",
                "absolute_path": preview_root / "preview-assets" / "software-engineering-preview-note.txt",
                "top_level_category": "文本",
                "file_extension": ".txt",
                "mime_type": "text/plain",
                "file_size": 547,
                "preview_text": "软件工程资源导览说明",
                "is_inline_previewable": True,
                "sort_order": 0,
            },
        ]

        rows: list[ResourceSourceFile] = []
        for item in builtin_files:
            absolute_path = Path(item["absolute_path"])
            if not absolute_path.exists():
                continue
            rows.append(
                ResourceSourceFile(
                    id=int(item["id"]),
                    resource_id=int(item["resource_id"]),
                    course_code="software_engineering_4th",
                    display_name=str(item["display_name"]),
                    relative_path=str(item["relative_path"]),
                    absolute_path=str(absolute_path),
                    top_level_category=str(item["top_level_category"]),
                    file_extension=str(item["file_extension"]),
                    mime_type=str(item["mime_type"]),
                    file_size=int(item["file_size"]),
                    preview_text=str(item["preview_text"]),
                    is_inline_previewable=bool(item["is_inline_previewable"]),
                    sort_order=int(item["sort_order"]),
                    created_at=None,
                    updated_at=None,
                )
            )
        return rows

    def _local_rows_for_resource(self, *, resource_id: int, limit: int | None) -> list[ResourceSourceFile]:
        rows = [
            row
            for row in self._build_local_source_file_lookup().values()
            if int(row.resource_id) == resource_id
        ]
        rows.sort(key=lambda row: (int(row.sort_order or 0), str(row.display_name or "")))
        return rows if limit is None else rows[:limit]

    def _local_rows_grouped_by_resource(self, *, resource_ids: list[int]) -> dict[int, list[ResourceSourceFile]]:
        wanted = {int(resource_id) for resource_id in resource_ids}
        grouped: dict[int, list[ResourceSourceFile]] = {resource_id: [] for resource_id in resource_ids}
        for row in self._build_local_source_file_lookup().values():
            resource_id = int(row.resource_id)
            if resource_id in wanted:
                grouped.setdefault(resource_id, []).append(row)
        for resource_id in grouped:
            grouped[resource_id].sort(key=lambda row: (int(row.sort_order or 0), str(row.display_name or "")))
        return grouped

    def _load_preview_map(self) -> dict[str, str]:
        index_path = self._materials_root / "material_index.json"
        if not index_path.exists():
            return {}
        try:
            data = json.loads(index_path.read_text(encoding="utf-8"))
        except Exception:
            return {}

        preview_map: dict[str, str] = {}
        for item in data:
            relative_path = str(item.get("relative_path") or "").strip()
            preview_text = str(item.get("preview") or "").strip()
            if relative_path and preview_text:
                preview_map[relative_path.replace("\\", "/")] = preview_text[:1000]
        return preview_map

    def _find_course_directory(self) -> Path | None:
        if not self._materials_root.exists():
            return None
        for child in sorted(self._materials_root.iterdir()):
            if child.is_dir() and child.name.startswith("9787302610724"):
                return child
        return None

    def _sort_order(self, top_level: str, relative_path: str) -> int:
        prefixes = self.MATERIAL_CATEGORY_RULES.get(106, [])
        for index, prefix in enumerate(prefixes):
            if top_level.startswith(prefix) or Path(relative_path).name == prefix:
                return index
        return len(prefixes) + 1

    def _to_ref(self, source_file: ResourceSourceFile) -> ResourceSourceFileRef:
        preview_mode = self._get_preview_mode(source_file)
        preview_url = None
        open_url = self.OPEN_URL_TEMPLATE.format(file_id=source_file.id)

        if preview_mode != "unsupported":
            preview_url = self.PREVIEW_URL_TEMPLATE.format(file_id=source_file.id)
        return ResourceSourceFileRef(
            file_id=source_file.id,
            display_name=self._normalize_text(source_file.display_name),
            relative_path=self._normalize_text(source_file.relative_path),
            top_level_category=self._normalize_text(source_file.top_level_category),
            file_extension=source_file.file_extension,
            mime_type=source_file.mime_type,
            file_size=source_file.file_size,
            preview_text=self._normalize_text(source_file.preview_text),
            is_inline_previewable=source_file.is_inline_previewable,
            preview_mode=preview_mode,
            preview_url=preview_url,
            open_url=open_url,
        )

    def _build_source_storage_url(self, source_file: ResourceSourceFile) -> str:
        file_path = self._require_source_path(source_file)
        object_key = self._build_source_object_key(source_file)
        content_type = source_file.mime_type or mimetypes.guess_type(file_path.name)[0] or "application/octet-stream"
        return self._storage.upload_file(object_key=object_key, file_path=file_path, content_type=content_type)

    def _build_source_object_key(self, source_file: ResourceSourceFile) -> str:
        safe_relative_path = source_file.relative_path.replace("\\", "/").lstrip("/")
        return f"course-source-files/{source_file.course_code}/{source_file.resource_id}/{safe_relative_path}"

    def _build_preview_storage_url(self, *, source_file: ResourceSourceFile, preview_path: Path, content_type: str) -> str:
        object_key = self._build_preview_object_key(source_file=source_file, preview_path=preview_path)
        return self._storage.upload_file(object_key=object_key, file_path=preview_path, content_type=content_type)

    def _build_preview_object_key(self, *, source_file: ResourceSourceFile, preview_path: Path) -> str:
        safe_name = preview_path.name
        return f"course-source-previews/{source_file.course_code}/{source_file.resource_id}/{source_file.id}/{safe_name}"

    def _get_preview_mode(self, source_file: ResourceSourceFile) -> str:
        suffix = (source_file.file_extension or "").lower()
        mime_type = (source_file.mime_type or "").lower()
        if mime_type.startswith("image/"):
            return "image"
        if suffix == ".pdf" or mime_type == "application/pdf":
            return "pdf"
        if suffix in {".md", ".txt"} or mime_type.startswith("text/"):
            return "text"
        if suffix in self.VIDEO_EXTENSIONS or mime_type.startswith("video/"):
            return "video"
        if suffix in self.OFFICE_EXTENSIONS:
            if self._soffice_path:
                return "office-pdf"
            if suffix in self.OPENXML_HTML_FALLBACK_EXTENSIONS:
                return "html"
        return "unsupported"

    def _ensure_office_preview_artifact(self, source_file: ResourceSourceFile, file_path: Path) -> Path:
        self._preview_root.mkdir(parents=True, exist_ok=True)
        suffix = file_path.suffix.lower()

        if self._soffice_path:
            preview_path = self._preview_root / f"{source_file.id}-{self._sanitize_name(file_path.stem)}.pdf"
            if preview_path.exists() and preview_path.stat().st_mtime >= file_path.stat().st_mtime:
                return preview_path
            self._convert_office_to_pdf(file_path, preview_path)
            return preview_path

        preview_path = self._preview_root / f"{source_file.id}-{self._sanitize_name(file_path.stem)}.html"
        if preview_path.exists() and preview_path.stat().st_mtime >= file_path.stat().st_mtime:
            return preview_path

        if suffix == ".docx":
            html_body = self._render_docx_html(file_path)
        elif suffix == ".xlsx":
            html_body = self._render_xlsx_html(file_path)
        elif suffix == ".pptx":
            html_body = self._render_pptx_html(file_path)
        else:
            raise HTTPException(status_code=415, detail="resource source file preview unsupported")

        html_page = self._wrap_preview_html(source_file.display_name, html_body)
        preview_path.write_text(html_page, encoding="utf-8")
        return preview_path

    def _convert_office_to_pdf(self, file_path: Path, preview_path: Path) -> None:
        if not self._soffice_path:
            raise HTTPException(status_code=500, detail="libreoffice runtime unavailable")
        preview_path.parent.mkdir(parents=True, exist_ok=True)
        command = [
            self._soffice_path,
            "--headless",
            "--convert-to",
            "pdf:writer_pdf_Export",
            "--outdir",
            str(preview_path.parent),
            str(file_path),
        ]
        try:
            subprocess.run(command, check=True, capture_output=True, text=True, timeout=180)
        except subprocess.CalledProcessError as exc:
            stderr = (exc.stderr or exc.stdout or "").strip()
            raise HTTPException(status_code=500, detail=f"office preview generation failed: {stderr or exc}") from exc
        except subprocess.TimeoutExpired as exc:
            raise HTTPException(status_code=500, detail="office preview generation timed out") from exc

        generated_path = preview_path.parent / f"{file_path.stem}.pdf"
        if not generated_path.exists():
            raise HTTPException(status_code=500, detail="office preview generation missing output")
        if generated_path.resolve() != preview_path.resolve():
            generated_path.replace(preview_path)

    def _ensure_video_preview_artifact(self, source_file: ResourceSourceFile, file_path: Path) -> Path:
        if file_path.suffix.lower() == ".m3u8":
            return file_path
        if not self._ffmpeg_path:
            return file_path

        asset_root = self._ensure_video_preview_directory(source_file, file_path)
        playlist_path = asset_root / "index.m3u8"
        if playlist_path.exists() and playlist_path.stat().st_mtime >= file_path.stat().st_mtime:
            return playlist_path

        segment_pattern = asset_root / "segment_%03d.ts"
        command = [
            self._ffmpeg_path,
            "-y",
            "-i",
            str(file_path),
            "-codec:v",
            "libx264",
            "-codec:a",
            "aac",
            "-preset",
            "veryfast",
            "-crf",
            "23",
            "-g",
            "48",
            "-keyint_min",
            "48",
            "-hls_time",
            "6",
            "-hls_playlist_type",
            "vod",
            "-hls_segment_filename",
            str(segment_pattern),
            str(playlist_path),
        ]
        try:
            subprocess.run(command, check=True, capture_output=True, text=True, timeout=600)
        except subprocess.CalledProcessError as exc:
            return file_path
        except subprocess.TimeoutExpired:
            return file_path

        if not playlist_path.exists():
            return file_path

        self._rewrite_playlist_urls(source_file.id, playlist_path)
        return playlist_path

    def _ensure_video_preview_directory(self, source_file: ResourceSourceFile, file_path: Path) -> Path:
        asset_root = self._preview_root / f"{source_file.id}-{self._sanitize_name(file_path.stem)}-video"
        asset_root.mkdir(parents=True, exist_ok=True)
        return asset_root

    def _rewrite_playlist_urls(self, file_id: int, playlist_path: Path) -> None:
        lines = playlist_path.read_text(encoding="utf-8").splitlines()
        rewritten: list[str] = []
        for line in lines:
            stripped = line.strip()
            if stripped and not stripped.startswith("#"):
                rewritten.append(
                    self.PREVIEW_ASSET_URL_TEMPLATE.format(file_id=file_id, asset_path=quote(stripped))
                )
            else:
                rewritten.append(line)
        playlist_path.write_text("\n".join(rewritten) + "\n", encoding="utf-8")

    def _wrap_preview_html(self, title: str, body: str) -> str:
        safe_title = html.escape(title)
        return (
            "<!doctype html>"
            "<html lang='zh-CN'>"
            "<head>"
            "<meta charset='utf-8' />"
            "<meta name='viewport' content='width=device-width, initial-scale=1' />"
            f"<title>{safe_title}</title>"
            "<style>"
            "body{margin:0;padding:24px;background:#f8fafc;color:#0f172a;font:16px/1.7 'Segoe UI',sans-serif;}"
            ".page{max-width:980px;margin:0 auto;background:#fff;border:1px solid #dbe4ee;border-radius:24px;padding:28px 32px;box-shadow:0 12px 40px rgba(15,23,42,.06);}"
            "h1{margin:0 0 12px;font-size:28px;line-height:1.3;}"
            "h2{margin:28px 0 12px;font-size:20px;line-height:1.4;}"
            "p,li{white-space:pre-wrap;word-break:break-word;}"
            "table{width:100%;border-collapse:collapse;margin:12px 0 24px;font-size:14px;}"
            "th,td{border:1px solid #dbe4ee;padding:8px 10px;text-align:left;vertical-align:top;}"
            ".muted{color:#64748b;font-size:14px;margin-bottom:24px;}"
            ".slide,.sheet{margin-top:28px;padding-top:20px;border-top:1px solid #e2e8f0;}"
            "</style>"
            "</head>"
            "<body><main class='page'>"
            f"<h1>{safe_title}</h1>"
            "<div class='muted'>当前内容为服务端预处理生成的站内预览版本。</div>"
            f"{body}"
            "</main></body></html>"
        )

    def _render_docx_html(self, file_path: Path) -> str:
        namespace = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
        try:
            with zipfile.ZipFile(file_path) as archive:
                xml_bytes = archive.read("word/document.xml")
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"docx preview generation failed: {exc}") from exc

        root = ET.fromstring(xml_bytes)
        blocks: list[str] = []
        for paragraph in root.findall(".//w:body/w:p", namespace):
            texts = [node.text or "" for node in paragraph.findall(".//w:t", namespace)]
            line = "".join(texts).strip()
            if line:
                blocks.append(f"<p>{html.escape(line)}</p>")

        if not blocks:
            blocks.append("<p>未提取到可显示的文本内容。</p>")
        return "".join(blocks)

    def _render_xlsx_html(self, file_path: Path) -> str:
        ns_main = {"a": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
        try:
            with zipfile.ZipFile(file_path) as archive:
                shared_strings = self._load_xlsx_shared_strings(archive)
                sheet_names = self._load_xlsx_sheet_names(archive)
                parts = []
                sheet_files = sorted(
                    name for name in archive.namelist() if re.fullmatch(r"xl/worksheets/sheet\d+\.xml", name)
                )
                for index, sheet_file in enumerate(sheet_files, start=1):
                    sheet_xml = ET.fromstring(archive.read(sheet_file))
                    rows_html: list[str] = []
                    for row in sheet_xml.findall(".//a:sheetData/a:row", ns_main):
                        cells_html: list[str] = []
                        for cell in row.findall("a:c", ns_main):
                            value = self._read_xlsx_cell_value(cell, ns_main, shared_strings)
                            cells_html.append(f"<td>{html.escape(value)}</td>")
                        if cells_html:
                            rows_html.append(f"<tr>{''.join(cells_html)}</tr>")
                    sheet_title = html.escape(
                        sheet_names[index - 1] if index - 1 < len(sheet_names) else f"Sheet {index}"
                    )
                    if rows_html:
                        parts.append(
                            f"<section class='sheet'><h2>{sheet_title}</h2><table>{''.join(rows_html)}</table></section>"
                        )
                if parts:
                    return "".join(parts)
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"xlsx preview generation failed: {exc}") from exc

        return "<p>未提取到可显示的表格内容。</p>"

    def _load_xlsx_shared_strings(self, archive: zipfile.ZipFile) -> list[str]:
        ns_main = {"a": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
        if "xl/sharedStrings.xml" not in archive.namelist():
            return []
        root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
        values: list[str] = []
        for item in root.findall("a:si", ns_main):
            texts = [node.text or "" for node in item.findall(".//a:t", ns_main)]
            values.append("".join(texts))
        return values

    def _load_xlsx_sheet_names(self, archive: zipfile.ZipFile) -> list[str]:
        ns_main = {"a": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
        if "xl/workbook.xml" not in archive.namelist():
            return []
        root = ET.fromstring(archive.read("xl/workbook.xml"))
        return [sheet.attrib.get("name", "") for sheet in root.findall(".//a:sheets/a:sheet", ns_main)]

    def _read_xlsx_cell_value(self, cell: ET.Element, namespace: dict[str, str], shared_strings: list[str]) -> str:
        cell_type = cell.attrib.get("t")
        value_node = cell.find("a:v", namespace)
        if cell_type == "inlineStr":
            texts = [node.text or "" for node in cell.findall(".//a:t", namespace)]
            return "".join(texts).strip()
        if value_node is None or value_node.text is None:
            return ""
        raw_value = value_node.text.strip()
        if cell_type == "s":
            try:
                return shared_strings[int(raw_value)]
            except Exception:
                return raw_value
        return raw_value

    def _render_pptx_html(self, file_path: Path) -> str:
        ns_drawing = {"a": "http://schemas.openxmlformats.org/drawingml/2006/main"}
        try:
            with zipfile.ZipFile(file_path) as archive:
                slide_files = sorted(
                    name for name in archive.namelist() if re.fullmatch(r"ppt/slides/slide\d+\.xml", name)
                )
                slides: list[str] = []
                for index, slide_file in enumerate(slide_files, start=1):
                    root = ET.fromstring(archive.read(slide_file))
                    texts = [
                        node.text.strip()
                        for node in root.findall(".//a:t", ns_drawing)
                        if node.text and node.text.strip()
                    ]
                    if texts:
                        slide_html = "".join(f"<p>{html.escape(text)}</p>" for text in texts)
                    else:
                        slide_html = "<p>本页未提取到文本内容。</p>"
                    slides.append(f"<section class='slide'><h2>幻灯片 {index}</h2>{slide_html}</section>")
                if slides:
                    return "".join(slides)
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"pptx preview generation failed: {exc}") from exc

        return "<p>未提取到可显示的幻灯片内容。</p>"

    def _sanitize_name(self, value: str) -> str:
        lowered = value.strip().lower() or "preview"
        return re.sub(r"[^a-z0-9_-]+", "-", lowered).strip("-") or "preview"

    def _detect_soffice_path(self) -> str | None:
        detected = shutil.which("soffice") or shutil.which("soffice.exe")
        if detected:
            return detected

        candidates = [
            Path("C:/Program Files/LibreOffice/program/soffice.exe"),
            Path("C:/Program Files (x86)/LibreOffice/program/soffice.exe"),
        ]
        for candidate in candidates:
            if candidate.exists():
                return str(candidate)
        return None

    def _normalize_text(self, value: str | None) -> str:
        return _normalize_text(value)

def _normalize_text(value: str | None) -> str:
    if value is None:
        return ""
    text = str(value).replace("\uFFFD", "").strip()
    if not text:
        return ""

    suspicious_markers = ("?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?")
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
        mojibake_tokens = ("?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?")
        penalty = sum(candidate.count(token) for token in mojibake_tokens)
        cjk = sum(1 for ch in candidate if "\u4e00" <= ch <= "\u9fff")
        return (penalty, -cjk)

    return min(candidates, key=score).strip()

