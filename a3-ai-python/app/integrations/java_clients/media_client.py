"""
媒体 / 视频检索 Java 网关客户端（辅导视频推荐等）。
"""
from __future__ import annotations

from typing import Any

from app.core.logging import get_logger
from app.integrations.java_clients.base import BaseJavaClient

logger = get_logger(__name__)


class MediaClient(BaseJavaClient):
    async def search_videos(
        self,
        *,
        course_id: int,
        keyword: str,
        page: int = 1,
        page_size: int = 10,
    ) -> dict[str, Any]:
        """
        按课程与关键词检索视频。网关未实现或失败时返回空列表结构，不中断辅导主流程。
        """
        try:
            return await self.get(
                "/internal/media/videos/search",
                params={
                    "courseId": course_id,
                    "keyword": keyword,
                    "page": page,
                    "pageSize": page_size,
                },
            )
        except Exception as e:
            logger.warning("media.search_videos_failed", course_id=course_id, keyword=keyword, error=str(e))
            return {"items": []}

    async def get_play_signature(self, *, section_id: int, user_id: int) -> dict[str, Any]:
        return await self.get(
            "/ms/medias/signature/play",
            params={"sectionId": section_id},
            user_id=user_id,
        )
