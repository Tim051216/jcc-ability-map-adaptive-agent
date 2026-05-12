"""
辅导问题配图：上传到 MinIO，返回可写入 question_images 的 URL（公网前缀或预签名）。
"""
from __future__ import annotations

import uuid
from datetime import timedelta
from io import BytesIO

from minio.error import S3Error

from app.core.config import settings
from app.integrations.storage.minio_client import build_minio_client

MAX_IMAGE_BYTES = 2 * 1024 * 1024
_ALLOWED_TYPES = frozenset({"image/jpeg", "image/png", "image/webp", "image/gif"})
_EXT = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
}


def upload_tutoring_question_image(user_id: int, data: bytes, content_type: str) -> str:
    if not data:
        raise ValueError("文件为空")
    if len(data) > MAX_IMAGE_BYTES:
        raise ValueError("图片请小于 2MB")
    ct = (content_type or "").split(";")[0].strip().lower()
    if ct not in _ALLOWED_TYPES:
        raise ValueError("仅支持 JPEG、PNG、WebP、GIF")

    client = build_minio_client()
    bucket = settings.minio_bucket
    ext = _EXT.get(ct, ".bin")
    key = f"tutoring/questions/{user_id}/{uuid.uuid4().hex}{ext}"

    try:
        if not client.bucket_exists(bucket):
            client.make_bucket(bucket)
    except S3Error as e:
        raise RuntimeError(f"无法确认存储桶: {e}") from e

    try:
        client.put_object(
            bucket,
            key,
            BytesIO(data),
            length=len(data),
            content_type=ct,
        )
    except S3Error as e:
        raise RuntimeError(f"上传失败: {e}") from e

    base = settings.minio_public_base_url
    if base:
        return f"{base.rstrip('/')}/{key}"

    try:
        return client.presigned_get_object(bucket, key, expires=timedelta(days=7))
    except S3Error as e:
        raise RuntimeError(f"无法生成访问链接: {e}") from e
