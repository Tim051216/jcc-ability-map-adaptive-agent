from app.integrations.java_clients.base import BaseJavaClient
from app.schemas.java_models import JavaLearningRecord


class LearningClient(BaseJavaClient):
    async def get_learning_record_by_course(self, course_id: int) -> JavaLearningRecord | None:
        payload = await self.get(f"/ls/learning-records/course/{course_id}")
        if not payload:
            return None
        return JavaLearningRecord.model_validate(payload)
