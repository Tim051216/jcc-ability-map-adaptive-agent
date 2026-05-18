import os


_TEST_ENV = {
    "POSTGRES_DSN": "postgresql+asyncpg://test:test@127.0.0.1:5432/test",
    "REDIS_DSN": "redis://127.0.0.1:6379/0",
    "CELERY_BROKER_URL": "redis://127.0.0.1:6379/1",
    "CELERY_RESULT_BACKEND": "redis://127.0.0.1:6379/2",
    "MILVUS_HOST": "127.0.0.1",
    "MILVUS_PORT": "19530",
    "MILVUS_COLLECTION_PREFIX": "test",
    "MINIO_ENDPOINT": "127.0.0.1:9000",
    "MINIO_ACCESS_KEY": "test-access-key",
    "MINIO_SECRET_KEY": "test-secret-key",
    "MINIO_BUCKET": "test-bucket",
    "OBJECT_STORAGE_ENDPOINT": "127.0.0.1:9000",
    "OBJECT_STORAGE_ACCESS_KEY": "test-access-key",
    "OBJECT_STORAGE_SECRET_KEY": "test-secret-key",
    "OBJECT_STORAGE_SECURE": "false",
    "OBJECT_STORAGE_BUCKET": "test-bucket",
    "JAVA_GATEWAY_BASE_URL": "http://127.0.0.1:8080",
    "JAVA_INTERNAL_TOKEN": "test-token",
    "LLM_PROVIDER": "mock",
    "LLM_MODEL": "mock-model",
    "LLM_API_KEY": "mock-key",
    "LLM_BASE_URL": "http://127.0.0.1:9999",
}


for key, value in _TEST_ENV.items():
    os.environ.setdefault(key, value)
