from minio import Minio

from app.integrations.storage.object_storage_client import build_object_storage_client


def build_minio_client() -> Minio:
    return build_object_storage_client()
