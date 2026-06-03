from importlib import import_module

from fastapi import APIRouter


def _load_router(module_name: str):
    """Soft-load optional API modules so core routes can boot in lean test envs."""
    target_module = f"app.api.v1.{module_name}"
    try:
        return import_module(target_module)
    except ModuleNotFoundError as exc:
        if exc.name == target_module:
            return None
        raise


api_router = APIRouter()

for module_name, prefix, tags in [
    ("chat", "/v1/chat", ["chat"]),
    ("course", "/v1/course", ["course"]),
    ("course_comment", "/v1/course-comments", ["course-comments"]),
    ("danmaku", "/v1/danmaku", ["danmaku"]),
    ("learning", "/v1/learning", ["learning"]),
    ("profile", "/v1/profile", ["profile"]),
    ("profile_conversation", "/v1", ["profile-conversation"]),
    ("plan", "/v1/plan", ["plan"]),
    ("resource", "/v1/resource", ["resource"]),
    ("evaluation", "/v1/evaluation", ["evaluation"]),
    ("rag", "/v1/rag", ["rag"]),
    ("tutoring", "/v1/tutoring", ["tutoring"]),
    ("admin", "/v1/admin", ["admin"]),
]:
    module = _load_router(module_name)
    if module is not None:
        api_router.include_router(module.router, prefix=prefix, tags=tags)
