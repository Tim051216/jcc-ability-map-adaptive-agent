from app.integrations.java_clients.base import BaseJavaClient
from app.schemas.java_models import JavaLearningRecord


class LearningClient(BaseJavaClient):
    async def get_learning_record_by_course(self, course_id: int, *, user_id: int | None = None) -> JavaLearningRecord | None:
        payload = await self.get(f"/ls/learning-records/course/{course_id}", user_id=user_id)
        if not payload:
            return None
        return JavaLearningRecord.model_validate(payload)

    async def update_learning_position(self, *, lesson_id: int, section_id: int, user_id: int) -> None:
        await self.post(
            "/ls/learning-records/position",
            json={
                "lessonId": lesson_id,
                "sectionId": section_id,
            },
            user_id=user_id,
        )
