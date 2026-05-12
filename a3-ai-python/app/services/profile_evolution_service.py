from datetime import datetime, timezone

from fastapi import HTTPException

from app.db.repositories.profile_repository import ProfileRepository
from app.db.session import async_session_factory
from app.schemas.profile import (
    ProfileBehaviorFeedbackRequest,
    ProfileHistoryItem,
    ProfileHistoryResponse,
    ProfileResponse,
    ProfileTuneRequest,
)


class ProfileEvolutionService:
    async def list_history(self, *, user_id: int, limit: int = 10) -> ProfileHistoryResponse:
        async with async_session_factory() as session:
            snapshots = await ProfileRepository().list_by_user(session, user_id, limit=limit)

        items = [
            ProfileHistoryItem(
                snapshot_id=snapshot.id,
                user_id=snapshot.user_id,
                version=snapshot.version,
                summary=(snapshot.profile_data or {}).get("summary"),
                source_summary=snapshot.source_summary,
                profile_tags=(snapshot.profile_data or {}).get("profile_tags", []),
                updated_at=snapshot.updated_at,
            )
            for snapshot in snapshots
        ]
        return ProfileHistoryResponse(items=items, total=len(items))

    async def tune_profile(self, request: ProfileTuneRequest) -> ProfileResponse:
        now = datetime.now(timezone.utc).isoformat()
        async with async_session_factory() as session:
            repo = ProfileRepository()
            latest = await repo.latest_by_user(session, request.user_id)
            if latest is None:
                raise HTTPException(status_code=404, detail="profile not found")

            profile_data = dict(latest.profile_data or {})
            dimensions = dict(profile_data.get("dimensions", {}))
            dimensions.update(request.dimensions_patch)
            profile_data["dimensions"] = dimensions

            # 保持原有维度顺序，并把新增维度追加到末尾。
            base_order = list(profile_data.get("dimension_order", []))
            for key in dimensions:
                if key not in base_order:
                    base_order.append(key)
            profile_data["dimension_order"] = base_order

            if request.profile_tags is not None:
                profile_data["profile_tags"] = request.profile_tags
            else:
                profile_data.setdefault("profile_tags", [])

            if request.recommended_resource_types is not None:
                profile_data["recommended_resource_types"] = request.recommended_resource_types
            else:
                profile_data.setdefault("recommended_resource_types", [])

            if request.summary is not None:
                profile_data["summary"] = request.summary

            next_version = latest.version + 1
            profile_data["profile_version"] = next_version
            profile_data["tuned_from_version"] = latest.version
            profile_data["last_manual_tune"] = {
                "updated_by": request.updated_by,
                "source_summary": request.source_summary,
                "updated_at": now,
            }

            await repo.create_snapshot(
                session,
                user_id=request.user_id,
                version=next_version,
                profile_data=profile_data,
                source_summary=request.source_summary or latest.source_summary,
                created_at=now,
                updated_at=now,
            )
            await session.commit()

        return ProfileResponse(
            user_id=request.user_id,
            dimensions=profile_data.get("dimensions", {}),
            dimension_order=profile_data.get("dimension_order", []),
            profile_tags=profile_data.get("profile_tags", []),
            recommended_resource_types=profile_data.get("recommended_resource_types", []),
            summary=profile_data.get("summary"),
            version=next_version,
        )

    async def apply_behavior_feedback(self, request: ProfileBehaviorFeedbackRequest) -> ProfileResponse:
        now = datetime.now(timezone.utc).isoformat()
        async with async_session_factory() as session:
            repo = ProfileRepository()
            latest = await repo.latest_by_user(session, request.user_id)
            if latest is None:
                raise HTTPException(status_code=404, detail="profile not found")

            profile_data = dict(latest.profile_data or {})
            dimensions = dict(profile_data.get("dimensions", {}))
            dimension_order = list(profile_data.get("dimension_order", []))

            self._apply_behavior_dimension_updates(
                dimensions=dimensions,
                dimension_order=dimension_order,
                request=request,
            )
            profile_data["dimensions"] = dimensions
            profile_data["dimension_order"] = dimension_order

            current_tags = list(profile_data.get("profile_tags", []))
            if request.completion_rate is not None and request.completion_rate >= 80:
                current_tags = self._append_unique_tag(current_tags, "执行稳定")
            if request.resource_usage_count is not None and request.resource_usage_count >= 3:
                current_tags = self._append_unique_tag(current_tags, "资源利用积极")
            if request.weak_points:
                current_tags = self._append_unique_tag(current_tags, "需持续巩固")
            profile_data["profile_tags"] = current_tags

            feedback_summary = self._build_feedback_summary(request)
            profile_data["summary"] = feedback_summary
            next_version = latest.version + 1
            profile_data["profile_version"] = next_version
            profile_data["behavior_feedback"] = {
                "activity_type": request.activity_type,
                "course_code": request.course_code,
                "duration_minutes": request.duration_minutes,
                "completion_rate": request.completion_rate,
                "resource_usage_count": request.resource_usage_count,
                "weak_points": request.weak_points,
                "note": request.note,
                "updated_by": request.updated_by,
                "updated_at": now,
            }

            await repo.create_snapshot(
                session,
                user_id=request.user_id,
                version=next_version,
                profile_data=profile_data,
                source_summary=request.note or f"behavior_feedback:{request.activity_type}",
                created_at=now,
                updated_at=now,
            )
            await session.commit()

        return ProfileResponse(
            user_id=request.user_id,
            dimensions=profile_data.get("dimensions", {}),
            dimension_order=profile_data.get("dimension_order", []),
            profile_tags=profile_data.get("profile_tags", []),
            recommended_resource_types=profile_data.get("recommended_resource_types", []),
            summary=profile_data.get("summary"),
            version=next_version,
        )

    @staticmethod
    def _apply_behavior_dimension_updates(
        *,
        dimensions: dict,
        dimension_order: list[str],
        request: ProfileBehaviorFeedbackRequest,
    ) -> None:
        if request.completion_rate is not None:
            score = round(max(0.0, min(1.0, request.completion_rate / 100)), 2)
            dimensions["discipline"] = {
                "score": score,
                "label": "执行度",
                "evidence": f"completion_rate={request.completion_rate}",
            }
            if "discipline" not in dimension_order:
                dimension_order.append("discipline")

        if request.duration_minutes is not None or request.resource_usage_count is not None:
            duration_score = min(1.0, max(0.0, (request.duration_minutes or 0) / 120))
            usage_score = min(1.0, max(0.0, (request.resource_usage_count or 0) / 5))
            score = round((duration_score + usage_score) / 2, 2)
            dimensions["engagement"] = {
                "score": score,
                "label": "投入度",
                "evidence": (
                    f"duration_minutes={request.duration_minutes}, "
                    f"resource_usage_count={request.resource_usage_count}"
                ),
            }
            if "engagement" not in dimension_order:
                dimension_order.append("engagement")

        if request.weak_points:
            dimensions["reinforcement_need"] = {
                "score": 0.4,
                "label": "巩固需求",
                "evidence": "weak_points=" + ",".join(request.weak_points),
            }
            if "reinforcement_need" not in dimension_order:
                dimension_order.append("reinforcement_need")

    @staticmethod
    def _append_unique_tag(tags: list[str], tag: str) -> list[str]:
        if tag not in tags:
            tags.append(tag)
        return tags

    @staticmethod
    def _build_feedback_summary(request: ProfileBehaviorFeedbackRequest) -> str:
        parts = [f"最近一次{request.activity_type}行为已回流画像"]
        if request.completion_rate is not None:
            parts.append(f"完成度 {request.completion_rate:.0f}%")
        if request.duration_minutes is not None:
            parts.append(f"学习时长 {request.duration_minutes} 分钟")
        if request.weak_points:
            parts.append("待巩固: " + "、".join(request.weak_points))
        if request.note:
            parts.append(request.note)
        return "；".join(parts)
