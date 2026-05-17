from __future__ import annotations

import mimetypes
from pathlib import Path

from app.core.config import settings
from app.services.s3_compatible_storage_service import S3CompatibleStorageService


class ResourceSourceFileStorageService:
    def __init__(self) -> None:
        self._storage = S3CompatibleStorageService()

    def is_enabled(self) -> bool:
        return settings.resource_source_file_storage_enabled

    def upload_file(self, *, object_key: str, file_path: Path, content_type: str | None = None) -> str:
        resolved_type = content_type or mimetypes.guess_type(file_path.name)[0] or "application/octet-stream"
        return self._storage.upload_file(object_key=object_key, file_path=file_path, content_type=resolved_type)

    def build_download_url(self, object_key: str) -> str:
        return self._storage.build_download_url(object_key, expires_days=settings.resource_source_file_presign_days)
