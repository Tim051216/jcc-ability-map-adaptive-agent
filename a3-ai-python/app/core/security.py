from app.core.config import settings


def build_internal_headers(*, user_id: int | None = None) -> dict[str, str]:
    headers = {"X-Internal-Token": settings.java_internal_token}
    if user_id is not None:
        headers["user-info"] = str(user_id)
    return headers
