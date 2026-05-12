from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = Field(default="a3-ai-python", alias="APP_NAME")
    app_env: str = Field(default="local", alias="APP_ENV")
    app_host: str = Field(default="0.0.0.0", alias="APP_HOST")
    app_port: int = Field(default=18080, alias="APP_PORT")
    app_debug: bool = Field(default=False, alias="APP_DEBUG")
    auth_bearer_tokens: str = Field(default="student-demo:1001,admin-demo:9001", alias="AUTH_BEARER_TOKENS")

    postgres_dsn: str = Field(alias="POSTGRES_DSN")
    redis_dsn: str = Field(alias="REDIS_DSN")
    celery_broker_url: str = Field(alias="CELERY_BROKER_URL")
    celery_result_backend: str = Field(alias="CELERY_RESULT_BACKEND")

    milvus_host: str = Field(alias="MILVUS_HOST")
    milvus_port: int = Field(alias="MILVUS_PORT")
    milvus_collection_prefix: str = Field(alias="MILVUS_COLLECTION_PREFIX")
    milvus_dimension: int = Field(default=1024, alias="MILVUS_DIMENSION")

    minio_endpoint: str = Field(alias="MINIO_ENDPOINT")
    minio_access_key: str = Field(alias="MINIO_ACCESS_KEY")
    minio_secret_key: str = Field(alias="MINIO_SECRET_KEY")
    minio_secure: bool = Field(default=False, alias="MINIO_SECURE")
    minio_bucket: str = Field(alias="MINIO_BUCKET")
    # 可选：对外访问对象的前缀（含 bucket 路径），如 http://127.0.0.1:19000/learning-assets
    # 未配置时使用 presigned GET（默认 7 天），便于私有桶内网访问
    minio_public_base_url: str | None = Field(default=None, alias="MINIO_PUBLIC_BASE_URL")

    java_gateway_base_url: str = Field(alias="JAVA_GATEWAY_BASE_URL")
    java_internal_token: str = Field(alias="JAVA_INTERNAL_TOKEN")

    llm_provider: str = Field(alias="LLM_PROVIDER")
    llm_model: str = Field(alias="LLM_MODEL")
    llm_api_key: str = Field(alias="LLM_API_KEY")
    llm_base_url: str = Field(alias="LLM_BASE_URL")
    llm_timeout_seconds: int = Field(default=30, alias="LLM_TIMEOUT_SECONDS")

    embedding_provider: str = Field(default="hash", alias="EMBEDDING_PROVIDER")
    embedding_model: str = Field(default="text-embedding-3-small", alias="EMBEDDING_MODEL")
    embedding_api_key: str = Field(default="", alias="EMBEDDING_API_KEY")
    embedding_base_url: str = Field(default="", alias="EMBEDDING_BASE_URL")
    embedding_timeout_seconds: int = Field(default=30, alias="EMBEDDING_TIMEOUT_SECONDS")

    # 智能辅导：敏感词过滤（逗号分隔，空则不拦截）
    tutoring_sensitive_filter_enabled: bool = Field(default=True, alias="TUTORING_SENSITIVE_FILTER_ENABLED")
    tutoring_sensitive_words: str = Field(default="", alias="TUTORING_SENSITIVE_WORDS")


settings = Settings()  # type: ignore[call-arg]
