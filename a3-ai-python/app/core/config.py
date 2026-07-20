from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = Field(default="a3-ai-python", alias="APP_NAME")
    app_env: str = Field(default="local", alias="APP_ENV")
    app_host: str = Field(default="0.0.0.0", alias="APP_HOST")
    app_port: int = Field(default=18080, alias="APP_PORT")
    app_debug: bool = Field(default=False, alias="APP_DEBUG")
    local_demo_sqlite_only: bool = Field(default=True, alias="LOCAL_DEMO_SQLITE_ONLY")
    rag_local_markdown_first: bool = Field(default=True, alias="RAG_LOCAL_MARKDOWN_FIRST")
    auth_bearer_tokens: str = Field(default="student-demo:1001,admin-demo:9001", alias="AUTH_BEARER_TOKENS")

    postgres_dsn: str = Field(alias="POSTGRES_DSN")
    local_postgres_dsn: str | None = Field(default=None, alias="LOCAL_POSTGRES_DSN")
    redis_dsn: str = Field(alias="REDIS_DSN")
    celery_broker_url: str = Field(alias="CELERY_BROKER_URL")
    celery_result_backend: str = Field(alias="CELERY_RESULT_BACKEND")

    milvus_enabled: bool = Field(default=True, alias="MILVUS_ENABLED")
    milvus_host: str = Field(default="127.0.0.1", alias="MILVUS_HOST")
    milvus_port: int = Field(default=19530, alias="MILVUS_PORT")
    milvus_collection_prefix: str = Field(default="a3_learning", alias="MILVUS_COLLECTION_PREFIX")
    milvus_dimension: int = Field(default=1024, alias="MILVUS_DIMENSION")

    minio_endpoint: str = Field(alias="MINIO_ENDPOINT")
    minio_access_key: str = Field(alias="MINIO_ACCESS_KEY")
    minio_secret_key: str = Field(alias="MINIO_SECRET_KEY")
    minio_secure: bool = Field(default=False, alias="MINIO_SECURE")
    minio_bucket: str = Field(alias="MINIO_BUCKET")
    # 可选：对外访问对象的前缀（含 bucket 路径），如 http://127.0.0.1:19000/learning-assets
    # 未配置时使用 presigned GET（默认 7 天），便于私有桶内网访问
    minio_public_base_url: str | None = Field(default=None, alias="MINIO_PUBLIC_BASE_URL")
    object_storage_provider: str = Field(default="s3-compatible", alias="OBJECT_STORAGE_PROVIDER")
    object_storage_endpoint: str | None = Field(default=None, alias="OBJECT_STORAGE_ENDPOINT")
    object_storage_access_key: str | None = Field(default=None, alias="OBJECT_STORAGE_ACCESS_KEY")
    object_storage_secret_key: str | None = Field(default=None, alias="OBJECT_STORAGE_SECRET_KEY")
    object_storage_secure: bool | None = Field(default=None, alias="OBJECT_STORAGE_SECURE")
    object_storage_region: str | None = Field(default=None, alias="OBJECT_STORAGE_REGION")
    object_storage_virtual_hosted_style: bool | None = Field(default=None, alias="OBJECT_STORAGE_VIRTUAL_HOSTED_STYLE")
    object_storage_bucket: str | None = Field(default=None, alias="OBJECT_STORAGE_BUCKET")
    object_storage_public_base_url: str | None = Field(default=None, alias="OBJECT_STORAGE_PUBLIC_BASE_URL")
    object_storage_presign_days: int = Field(default=7, alias="OBJECT_STORAGE_PRESIGN_DAYS")
    resource_source_file_storage_enabled: bool = Field(default=False, alias="RESOURCE_SOURCE_FILE_STORAGE_ENABLED")
    resource_source_file_presign_days: int = Field(default=7, alias="RESOURCE_SOURCE_FILE_PRESIGN_DAYS")

    java_gateway_base_url: str = Field(alias="JAVA_GATEWAY_BASE_URL")
    java_internal_token: str = Field(alias="JAVA_INTERNAL_TOKEN")

    llm_provider: str = Field(alias="LLM_PROVIDER")
    llm_model: str = Field(alias="LLM_MODEL")
    llm_fallback_models: str = Field(default="", alias="LLM_FALLBACK_MODELS")
    llm_vision_model: str | None = Field(default=None, alias="LLM_VISION_MODEL")
    llm_vision_fallback_models: str = Field(default="", alias="LLM_VISION_FALLBACK_MODELS")
    llm_api_key: str = Field(alias="LLM_API_KEY")
    llm_base_url: str = Field(alias="LLM_BASE_URL")
    llm_timeout_seconds: int = Field(default=30, alias="LLM_TIMEOUT_SECONDS")
    llm_prefer_ocr_over_vision: bool = Field(default=True, alias="LLM_PREFER_OCR_OVER_VISION")
    llm_ocr_min_chars_for_text_only: int = Field(default=24, alias="LLM_OCR_MIN_CHARS_FOR_TEXT_ONLY")

    embedding_provider: str = Field(default="hash", alias="EMBEDDING_PROVIDER")
    embedding_model: str = Field(default="text-embedding-3-small", alias="EMBEDDING_MODEL")
    embedding_api_key: str = Field(default="", alias="EMBEDDING_API_KEY")
    embedding_base_url: str = Field(default="", alias="EMBEDDING_BASE_URL")
    embedding_timeout_seconds: int = Field(default=30, alias="EMBEDDING_TIMEOUT_SECONDS")

    # 智能辅导：敏感词过滤（逗号分隔，空则不拦截）
    tutoring_sensitive_filter_enabled: bool = Field(default=True, alias="TUTORING_SENSITIVE_FILTER_ENABLED")
    tutoring_sensitive_words: str = Field(default="", alias="TUTORING_SENSITIVE_WORDS")
    guardrails_enabled: bool = Field(default=True, alias="GUARDRAILS_ENABLED")
    guardrails_block_on_input: bool = Field(default=True, alias="GUARDRAILS_BLOCK_ON_INPUT")
    guardrails_block_on_output: bool = Field(default=True, alias="GUARDRAILS_BLOCK_ON_OUTPUT")
    guardrails_hallucination_enabled: bool = Field(default=True, alias="GUARDRAILS_HALLUCINATION_ENABLED")
    guardrails_sensitive_words: str = Field(default="", alias="GUARDRAILS_SENSITIVE_WORDS")
    xfyun_content_safety_enabled: bool = Field(default=False, alias="XFYUN_CONTENT_SAFETY_ENABLED")
    xfyun_content_safety_base_url: str = Field(default="", alias="XFYUN_CONTENT_SAFETY_BASE_URL")
    xfyun_content_safety_app_id: str = Field(default="", alias="XFYUN_CONTENT_SAFETY_APP_ID")
    xfyun_content_safety_api_key: str = Field(default="", alias="XFYUN_CONTENT_SAFETY_API_KEY")
    xfyun_content_safety_api_secret: str = Field(default="", alias="XFYUN_CONTENT_SAFETY_API_SECRET")

    firecrawl_api_key: str = Field(default="", alias="FIRECRAWL_API_KEY")
    firecrawl_base_url: str = Field(default="https://api.firecrawl.dev/v2", alias="FIRECRAWL_BASE_URL")


settings = Settings()  # type: ignore[call-arg]

if settings.object_storage_endpoint is None:
    settings.object_storage_endpoint = settings.minio_endpoint
if settings.object_storage_access_key is None:
    settings.object_storage_access_key = settings.minio_access_key
if settings.object_storage_secret_key is None:
    settings.object_storage_secret_key = settings.minio_secret_key
if settings.object_storage_secure is None:
    settings.object_storage_secure = settings.minio_secure
if settings.object_storage_region is None:
    endpoint = (settings.object_storage_endpoint or "").lower()
    if endpoint.endswith(".aliyuncs.com"):
        settings.object_storage_region = endpoint.split(".", 1)[0]
if settings.object_storage_virtual_hosted_style is None:
    endpoint = (settings.object_storage_endpoint or "").lower()
    provider = (settings.object_storage_provider or "").lower()
    settings.object_storage_virtual_hosted_style = "aliyuncs.com" in endpoint or "oss" in provider
if settings.object_storage_bucket is None:
    settings.object_storage_bucket = settings.minio_bucket
if settings.object_storage_public_base_url is None:
    settings.object_storage_public_base_url = settings.minio_public_base_url
