from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.generated_resource import GeneratedResource, ResourceFavorite, ResourceFavoriteHistory


class ResourceRepository:
    async def create_resource(
        self,
        session: AsyncSession,
        *,
        user_id: int,
        course_code: str,
        resource_type: str,
        title: str,
        summary: str,
        content_markdown: str,
        source_titles: list[str],
        study_suggestion: str | None,
        generation_context: dict | None,
        created_at: str,
        updated_at: str,
    ) -> GeneratedResource:
        resource = GeneratedResource(
            user_id=user_id,
            course_code=course_code,
            resource_type=resource_type,
            title=title,
            summary=summary,
            content_markdown=content_markdown,
            source_titles=source_titles,
            study_suggestion=study_suggestion,
            generation_context=generation_context,
            created_at=created_at,
            updated_at=updated_at,
        )
        session.add(resource)
        await session.flush()
        return resource

    async def get_resource(self, session: AsyncSession, resource_id: int) -> GeneratedResource | None:
        return await session.get(GeneratedResource, resource_id)

    async def list_resources(
        self,
        session: AsyncSession,
        *,
        user_id: int,
        course_code: str | None = None,
        resource_type: str | None = None,
        archived_only: bool = False,
    ) -> tuple[list[GeneratedResource], int]:
        stmt: Select[tuple[GeneratedResource]] = select(GeneratedResource).where(GeneratedResource.user_id == user_id)
        count_stmt = select(func.count()).select_from(GeneratedResource).where(GeneratedResource.user_id == user_id)
        if course_code:
            stmt = stmt.where(GeneratedResource.course_code == course_code)
            count_stmt = count_stmt.where(GeneratedResource.course_code == course_code)
        if resource_type:
            stmt = stmt.where(GeneratedResource.resource_type == resource_type)
            count_stmt = count_stmt.where(GeneratedResource.resource_type == resource_type)
        if archived_only:
            stmt = stmt.where(GeneratedResource.is_archived.is_(True))
            count_stmt = count_stmt.where(GeneratedResource.is_archived.is_(True))
        else:
            stmt = stmt.where(GeneratedResource.is_archived.is_(False))
            count_stmt = count_stmt.where(GeneratedResource.is_archived.is_(False))
        stmt = stmt.order_by(GeneratedResource.id.desc())
        result = await session.execute(stmt)
        total = await session.scalar(count_stmt)
        return list(result.scalars().all()), int(total or 0)

    async def list_favorites(self, session: AsyncSession, *, user_id: int) -> list[GeneratedResource]:
        stmt = (
            select(GeneratedResource)
            .join(ResourceFavorite, ResourceFavorite.resource_id == GeneratedResource.id)
            .where(ResourceFavorite.user_id == user_id, GeneratedResource.is_archived.is_(False))
            .order_by(ResourceFavorite.id.desc())
        )
        result = await session.execute(stmt)
        return list(result.scalars().all())

    async def list_favorite_history(
        self,
        session: AsyncSession,
        *,
        user_id: int,
    ) -> list[ResourceFavoriteHistory]:
        stmt = (
            select(ResourceFavoriteHistory)
            .where(ResourceFavoriteHistory.user_id == user_id)
            .order_by(ResourceFavoriteHistory.id.desc())
        )
        result = await session.execute(stmt)
        return list(result.scalars().all())

    async def get_favorite(
        self,
        session: AsyncSession,
        *,
        user_id: int,
        resource_id: int,
    ) -> ResourceFavorite | None:
        stmt = select(ResourceFavorite).where(
            ResourceFavorite.user_id == user_id,
            ResourceFavorite.resource_id == resource_id,
        )
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    async def create_favorite(
        self,
        session: AsyncSession,
        *,
        user_id: int,
        resource_id: int,
        category: str = "默认分类",
        notes: str | None = None,
        created_at: str,
        updated_at: str,
    ) -> ResourceFavorite:
        favorite = ResourceFavorite(
            user_id=user_id,
            resource_id=resource_id,
            category=category,
            notes=notes,
            created_at=created_at,
            updated_at=updated_at,
        )
        session.add(favorite)
        await session.flush()
        return favorite

    async def update_favorite(
        self,
        session: AsyncSession,
        favorite: ResourceFavorite,
        *,
        category: str | None = None,
        notes: str | None = None,
        updated_at: str,
    ) -> ResourceFavorite:
        if category is not None:
            favorite.category = category
        if notes is not None:
            favorite.notes = notes
        favorite.updated_at = updated_at
        await session.flush()
        return favorite

    async def count_favorites_by_resource_ids(
        self,
        session: AsyncSession,
        resource_ids: list[int],
    ) -> dict[int, int]:
        if not resource_ids:
            return {}
        stmt = (
            select(ResourceFavorite.resource_id, func.count(ResourceFavorite.id))
            .where(ResourceFavorite.resource_id.in_(resource_ids))
            .group_by(ResourceFavorite.resource_id)
        )
        result = await session.execute(stmt)
        return {int(resource_id): int(total) for resource_id, total in result.all()}

    async def create_favorite_history(
        self,
        session: AsyncSession,
        *,
        user_id: int,
        resource_id: int,
        action: str,
        created_at: str,
        updated_at: str,
    ) -> ResourceFavoriteHistory:
        item = ResourceFavoriteHistory(
            user_id=user_id,
            resource_id=resource_id,
            action=action,
            created_at=created_at,
            updated_at=updated_at,
        )
        session.add(item)
        await session.flush()
        return item

    async def delete_favorite(self, session: AsyncSession, favorite: ResourceFavorite) -> None:
        await session.delete(favorite)

    async def increment_download_count(
        self,
        session: AsyncSession,
        *,
        resource: GeneratedResource,
        updated_at: str,
    ) -> GeneratedResource:
        resource.download_count = int(resource.download_count or 0) + 1
        resource.updated_at = updated_at
        await session.flush()
        return resource
