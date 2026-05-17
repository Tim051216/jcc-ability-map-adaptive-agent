from dataclasses import dataclass

from fastapi import HTTPException

from app.services.course_service import CourseService


@dataclass
class ResolvedCourseContext:
    course_id: int | None
    course_code: str
    course_name: str | None = None


class CourseContextService:
    async def resolve(
        self,
        *,
        course_id: int | None = None,
        course_code: str | None = None,
    ) -> ResolvedCourseContext:
        normalized_code = str(course_code or "").strip()
        if course_id is not None:
            detail = await CourseService().get_course_detail(course_id)
            return ResolvedCourseContext(
                course_id=course_id,
                course_code=detail.course_code,
                course_name=detail.name,
            )
        if normalized_code:
            return ResolvedCourseContext(
                course_id=self._find_course_id_by_code(normalized_code),
                course_code=normalized_code,
                course_name=self._find_course_name_by_code(normalized_code),
            )
        raise HTTPException(status_code=400, detail="course context required")

    @staticmethod
    def _find_course_id_by_code(course_code: str) -> int | None:
        for item in CourseService.COURSE_FIXTURES:
            if item.get("course_code") == course_code:
                return int(item["id"])
        return None

    @staticmethod
    def _find_course_name_by_code(course_code: str) -> str | None:
        for item in CourseService.COURSE_FIXTURES:
            if item.get("course_code") == course_code:
                return item.get("name")
        return None
