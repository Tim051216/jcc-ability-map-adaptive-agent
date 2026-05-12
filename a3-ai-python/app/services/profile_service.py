from datetime import datetime, timezone

import httpx
from pydantic import ValidationError

from app.db.repositories.profile_repository import ProfileRepository
from app.db.session import async_session_factory
from app.integrations.java_clients.user_client import UserClient
from app.schemas.profile import ProfileBuildRequest, ProfileResponse
from app.services.profile_builder import build_profile_payload


class ProfileService:
    async def get_latest_profile(self, user_id: int) -> ProfileResponse | None:
        async with async_session_factory() as session:
            repo = ProfileRepository()
            latest = await repo.latest_by_user(session, user_id)
            if latest is None or not latest.profile_data:
                return None
            payload = latest.profile_data
            return ProfileResponse(
                user_id=user_id,
                dimensions=payload.get("dimensions", {}),
                dimension_order=payload.get("dimension_order", []),
                profile_tags=payload.get("profile_tags", []),
                recommended_resource_types=payload.get("recommended_resource_types", []),
                summary=payload.get("summary", ""),
                version=payload.get("profile_version", latest.version),
            )

    async def build_profile(self, request: ProfileBuildRequest) -> ProfileResponse:
        try:
            user_profile = await UserClient().get_user(request.user_id)
        except (httpx.HTTPError, ValidationError, ValueError):
            user_profile = None

        payload = build_profile_payload(
            user_id=request.user_id,
            course_code=request.course_code,
            learning_goal=request.learning_goal,
            dialogue=request.dialogue,
            user_profile=user_profile,
        )

        now = datetime.now(timezone.utc).isoformat()
        async with async_session_factory() as session:
            repo = ProfileRepository()
            latest = await repo.latest_by_user(session, request.user_id)
            version = (latest.version + 1) if latest else 1
            payload["profile_version"] = version
            await repo.create_snapshot(
                session,
                user_id=request.user_id,
                version=version,
                profile_data=payload,
                source_summary=payload.get("source_summary"),
                created_at=now,
                updated_at=now,
            )
            await session.commit()

        return ProfileResponse(
            user_id=request.user_id,
            dimensions=payload["dimensions"],
            dimension_order=payload["dimension_order"],
            profile_tags=payload["profile_tags"],
            recommended_resource_types=payload["recommended_resource_types"],
            summary=payload["summary"],
            version=payload["profile_version"],
        )

    async def get_latest_profile(self, user_id: int) -> ProfileResponse | None:
        async with async_session_factory() as session:
            snapshot = await ProfileRepository().latest_by_user(session, user_id)
            if snapshot is None:
                return None

        profile_data = snapshot.profile_data or {}
        return ProfileResponse(
            user_id=user_id,
            dimensions=profile_data.get("dimensions", {}),
            dimension_order=profile_data.get("dimension_order", []),
            profile_tags=profile_data.get("profile_tags", []),
            recommended_resource_types=profile_data.get("recommended_resource_types", []),
            summary=profile_data.get("summary"),
            version=snapshot.version,
        )
