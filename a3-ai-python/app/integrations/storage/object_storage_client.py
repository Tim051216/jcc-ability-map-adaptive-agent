from minio import Minio

from app.core.config import settings


def build_object_storage_client() -> Minio:
    client = Minio(
        settings.object_storage_endpoint,
        access_key=settings.object_storage_access_key,
        secret_key=settings.object_storage_secret_key,
        secure=bool(settings.object_storage_secure),
        region=settings.object_storage_region,
    )
    if settings.object_storage_virtual_hosted_style:
        client.enable_virtual_style_endpoint()
    return client
