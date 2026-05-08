from app.core.config import settings


def build_internal_headers() -> dict[str, str]:
    return {"X-Internal-Token": settings.java_internal_token}
