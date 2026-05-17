"""
辅导问题配图：上传到 S3-compatible 对象存储，返回可写入 question_images 的 URL。
"""
from __future__ import annotations

import uuid

from app.services.s3_compatible_storage_service import S3CompatibleStorageService

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

    storage = S3CompatibleStorageService()
    ext = _EXT.get(ct, ".bin")
    key = f"tutoring/questions/{user_id}/{uuid.uuid4().hex}{ext}"
    return storage.upload_bytes(object_key=key, data=data, content_type=ct)
