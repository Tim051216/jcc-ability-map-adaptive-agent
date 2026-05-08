import httpx

from app.core.constants import PROFILE_DIMENSIONS
from app.integrations.java_clients.user_client import UserClient
from app.schemas.profile import ProfileBuildRequest, ProfileResponse


class ProfileService:
    async def build_profile(self, request: ProfileBuildRequest) -> ProfileResponse:
        dimensions = {dimension: "待结合真实模型与业务数据进一步完善" for dimension in PROFILE_DIMENSIONS}
        try:
            user_profile = await UserClient().get_user(request.user_id)
        except httpx.HTTPError:
            user_profile = None

        if user_profile:
            dimensions["major"] = user_profile.major or "待补充专业信息"
            if user_profile.grade:
                dimensions["knowledge_level"] = f"可结合 {user_profile.grade} 年级课程进度进行推断"
        if request.learning_goal:
            dimensions["goal"] = request.learning_goal
        if request.dialogue:
            dimensions["learning_style"] = "对话中已体现主动提问倾向，适合任务分解式学习"
        if request.course_code:
            dimensions["weak_points"] = f"建议结合课程 {request.course_code} 的测评结果动态更新"
        return ProfileResponse(user_id=request.user_id, dimensions=dimensions)
