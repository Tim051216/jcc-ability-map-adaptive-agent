import pytest

from app.services.course_context_service import CourseContextService
from app.services.course_service import CourseService
from app.services.resource_service import ResourceService


def test_software_engineering_course_registered() -> None:
    course = next(
        item for item in CourseService.COURSE_FIXTURES if item["course_code"] == "software_engineering_4th"
    )

    assert course["id"] == 401
    assert course["name"] == "软件工程与实践（第4版）"
    assert len(course["chapters"]) == 3


@pytest.mark.asyncio
async def test_course_context_resolves_software_engineering_course_code() -> None:
    context = await CourseContextService().resolve(course_code="software_engineering_4th")

    assert context.course_id == 401
    assert context.course_name == "软件工程与实践（第4版）"


def test_resource_service_uses_human_friendly_course_label() -> None:
    label = ResourceService._course_label("software_engineering_4th")
    knowledge_points = ResourceService._normalize_knowledge_points(None, "software_engineering_4th")

    assert label == "Software Engineering Practice (4th Edition)"
    assert "requirements analysis" in knowledge_points
