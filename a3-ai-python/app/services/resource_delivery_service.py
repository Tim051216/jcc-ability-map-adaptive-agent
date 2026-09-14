from datetime import datetime, timezone

from fastapi import HTTPException

from app.db.repositories.resource_repository import ResourceRepository
from app.db.session import ai_data_session_factory as async_session_factory
from app.schemas.resource import ResourceDownloadResponse, ResourcePreviewResponse


class ResourceDeliveryService:
    async def get_preview(self, resource_id: int) -> ResourcePreviewResponse:
        async with async_session_factory() as session:
            resource = await ResourceRepository().get_resource(session, resource_id)
            if resource is None:
                raise HTTPException(status_code=404, detail="resource not found")

        return ResourcePreviewResponse(
            resource_id=resource.id,
            title=resource.title,
            resource_type=resource.resource_type,
            summary=resource.summary,
            excerpt_markdown=self._build_excerpt(resource.content_markdown),
            source_titles=list(resource.source_titles or []),
            archived=bool(resource.is_archived),
        )

    async def download_resource(self, *, user_id: int, resource_id: int) -> ResourceDownloadResponse:
        now = datetime.now(timezone.utc).isoformat()
        async with async_session_factory() as session:
            repo = ResourceRepository()
            resource = await repo.get_resource(session, resource_id)
            if resource is None:
                raise HTTPException(status_code=404, detail="resource not found")
            if resource.is_archived:
                raise HTTPException(status_code=403, detail="resource archived")
            if resource.download_scope != "public" and resource.user_id != user_id:
                raise HTTPException(status_code=403, detail="resource download forbidden")

            resource = await repo.increment_download_count(session, resource=resource, updated_at=now)
            await session.commit()

        return ResourceDownloadResponse(
            resource_id=resource.id,
            user_id=user_id,
            title=resource.title,
            download_scope=resource.download_scope,
            download_count=int(resource.download_count or 0),
            content_markdown=resource.content_markdown,
        )

    @staticmethod
    def _build_excerpt(content_markdown: str | None, max_lines: int = 8) -> str:
        if not content_markdown:
            return ""
        lines = [line for line in content_markdown.splitlines() if line.strip()]
        return "\n".join(lines[:max_lines])
