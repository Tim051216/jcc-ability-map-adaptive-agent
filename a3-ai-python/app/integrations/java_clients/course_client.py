from app.integrations.java_clients.base import BaseJavaClient
from app.schemas.java_models import JavaCourseDetail


class CourseClient(BaseJavaClient):
    async def get_course_detail(
        self, course_id: int, with_catalogue: bool = True, with_teachers: bool = True
    ) -> JavaCourseDetail | None:
        payload = await self.get(
            f"/cs/course/{course_id}",
            params={
                "withCatalogue": str(with_catalogue).lower(),
                "withTeachers": str(with_teachers).lower(),
            },
        )
        if not payload:
            return None
        return JavaCourseDetail.model_validate(payload)
