from __future__ import annotations

from datetime import timedelta
from io import BytesIO
from pathlib import Path

from minio.error import S3Error

from app.core.config import settings
from app.integrations.storage.minio_client import build_minio_client


class S3CompatibleStorageService:
    def __init__(self) -> None:
        self._client = build_minio_client()
        self._bucket = settings.object_storage_bucket
        self._public_base_url = settings.object_storage_public_base_url

    def upload_bytes(self, *, object_key: str, data: bytes, content_type: str) -> str:
        self._ensure_bucket()
        try:
            self._client.put_object(
                self._bucket,
                object_key,
                BytesIO(data),
                length=len(data),
                content_type=content_type,
            )
        except S3Error as exc:
            raise RuntimeError(f"object storage upload failed: {exc}") from exc
        return self.build_download_url(object_key)

    def upload_file(self, *, object_key: str, file_path: Path, content_type: str) -> str:
        self._ensure_bucket()
        try:
            self._client.fput_object(self._bucket, object_key, str(file_path), content_type=content_type)
        except S3Error as exc:
            raise RuntimeError(f"object storage upload failed: {exc}") from exc
        return self.build_download_url(object_key)

    def build_download_url(self, object_key: str, *, expires_days: int | None = None) -> str:
        if self._public_base_url:
            return f"{self._public_base_url.rstrip('/')}/{object_key}"
        try:
            return self._client.presigned_get_object(
                self._bucket,
                object_key,
                expires=timedelta(days=expires_days or settings.object_storage_presign_days),
            )
        except S3Error as exc:
            raise RuntimeError(f"object storage download url generation failed: {exc}") from exc

    def _ensure_bucket(self) -> None:
        try:
            if not self._client.bucket_exists(self._bucket):
                self._client.make_bucket(self._bucket)
        except S3Error as exc:
            raise RuntimeError(f"object storage bucket unavailable: {exc}") from exc
