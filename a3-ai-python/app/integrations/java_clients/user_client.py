from app.integrations.java_clients.base import BaseJavaClient
from app.schemas.java_models import JavaUserProfile


class UserClient(BaseJavaClient):
    async def get_user(self, user_id: int) -> JavaUserProfile | None:
        payload = await self.get(f"/us/users/{user_id}")
        if not payload:
            return None
        return JavaUserProfile.model_validate(payload)
