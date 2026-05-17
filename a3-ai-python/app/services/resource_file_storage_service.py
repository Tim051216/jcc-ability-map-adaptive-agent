"""
Generated resource file storage service backed by S3-compatible object storage.
"""

from __future__ import annotations

import re

from app.services.s3_compatible_storage_service import S3CompatibleStorageService


def _slugify(value: str) -> str:
    cleaned = re.sub(r"[^0-9A-Za-z\u4e00-\u9fff._-]+", "-", value).strip("-")
    return cleaned[:80] or "resource"


class ResourceFileStorageService:
    def __init__(self) -> None:
        self._storage = S3CompatibleStorageService()

    def upload_generated_resource(
        self,
        *,
        resource_id: int,
        resource_type_name: str,
        title: str,
        content: str,
        file_format: str,
    ) -> dict[str, str]:
        payload = (content or "").encode("utf-8")
        if not payload:
            raise ValueError("resource content is empty")

        ext = (file_format or "txt").lower().lstrip(".")
        key = (
            f"generated-resources/{resource_type_name}/{resource_id}/"
            f"{_slugify(title)}.{ext}"
        )
        file_url = self._storage.upload_bytes(
            object_key=key,
            data=payload,
            content_type=self._content_type(file_format),
        )
        return {"object_key": key, "file_url": file_url}

    def build_download_url(self, object_key: str) -> str:
        return self._storage.build_download_url(object_key)

    @staticmethod
    def _content_type(file_format: str) -> str:
        normalized = (file_format or "").lower()
        return {
            "markdown": "text/markdown; charset=utf-8",
            "md": "text/markdown; charset=utf-8",
            "html": "text/html; charset=utf-8",
            "json": "application/json; charset=utf-8",
            "mermaid": "text/plain; charset=utf-8",
            "py": "text/x-python; charset=utf-8",
            "java": "text/x-java-source; charset=utf-8",
            "js": "text/javascript; charset=utf-8",
            "cpp": "text/x-c++; charset=utf-8",
            "txt": "text/plain; charset=utf-8",
            "pdf": "application/pdf",
        }.get(normalized, "text/plain; charset=utf-8")
