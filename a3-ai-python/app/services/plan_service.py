import json
from datetime import datetime, timezone
from pathlib import Path

import httpx
from fastapi import HTTPException
from sqlalchemy.exc import SQLAlchemyError

from app.db.repositories.plan_progress_repository import PlanProgressRepository
from app.db.repositories.plan_repository import PlanRepository
from app.db.session import async_session_factory
from app.integrations.java_clients.course_client import CourseClient
from app.integrations.java_clients.learning_client import LearningClient
from app.schemas.common import ResourceCard, ResourceSourceFileRef
from app.schemas.course import LearningCourseDetailResponse
from app.schemas.plan import (
    LearningPlanRequest,
    LearningPlanResponse,
    LearningPlanStage,
    LearningPlanStep,
    PlanProgressResponse,
    PlanResourcePush,
    PlanStepProgressItem,
)
from app.schemas.rag import RagSearchRequest
from app.services.course_context_service import CourseContextService
from app.services.course_service import CourseService
from app.services.profile_conversation_service import ProfileConversationService
from app.services.profile_service import ProfileService
from app.services.rag_service import RagService
from app.services.resource_service import ResourceService


class PlanService:
    _local_store_path = Path(__file__).resolve().parents[2] / "local_data" / "plan_store.json"

    async def get_plan(self, plan_id: int) -> LearningPlanResponse | None:
        try:
            async with async_session_factory() as session:
                plan = await PlanRepository().get_by_id(session, plan_id)
                if plan is None or not plan.plan_data:
                    return None
                return LearningPlanResponse.model_validate({**plan.plan_data, "plan_id": plan.id})
        except (SQLAlchemyError, OSError):
            return self._get_local_plan(plan_id)

    async def get_latest_plan(self, user_id: int, course_code: str) -> LearningPlanResponse | None:
        try:
            async with async_session_factory() as session:
                plan = await PlanRepository().latest_by_user_course(session, user_id, course_code)
                if plan is None or not plan.plan_data:
                    return None
                return LearningPlanResponse.model_validate({**plan.plan_data, "plan_id": plan.id})
        except (SQLAlchemyError, OSError):
            return self._get_latest_local_plan(user_id=user_id, course_code=course_code)

    async def generate_plan(self, request: LearningPlanRequest) -> LearningPlanResponse:
        course_context = await CourseContextService().resolve(
            course_id=request.course_id,
            course_code=request.course_code,
        )
        request = request.model_copy(
            update={
                "course_id": course_context.course_id,
                "course_code": course_context.course_code,
            }
        )
        if course_context.course_id is None:
            raise HTTPException(status_code=400, detail="course id required for plan generation")

        profile_payload = request.profile or await self._load_profile_payload(request.user_id)
        course_id = int(course_context.course_id)
        course_detail = await self._load_learning_course_detail(course_id, request.user_id)
        if course_detail is None:
            raise HTTPException(status_code=404, detail="course detail not found")

        try:
            course = await CourseClient().get_course_detail(course_id)
        except (TypeError, ValueError, httpx.HTTPError):
            course = None

        try:
            learning_record = await LearningClient().get_learning_record_by_course(
                course_id,
                user_id=request.user_id,
            )
        except (TypeError, ValueError, httpx.HTTPError):
            learning_record = None

        course_name = (
            course_detail.name
            or (course.name if course and course.name else None)
            or course_context.course_name
            or course_context.course_code
        )
        completion_rate = float(getattr(learning_record, "process_percent", 0) or 0)
        weekly_frequency = getattr(learning_record, "week_freq", None)
        progress_hint = self._build_progress_hint(completion_rate, course_detail)

        rag = await RagService().search(
            RagSearchRequest(
                course_code=course_context.course_code,
                query=request.target,
                top_k=min(max(request.available_days, 3), 6),
            )
        )

        resources = await self._load_course_resources(request.user_id, course_id, course_context.course_code)
        plan_profile = self._normalize_plan_profile(profile_payload)
        weak_focus = plan_profile["weak_focus"] or [request.target]
        preferred_resources = plan_profile["preferred_resources"]
        learning_style = plan_profile["learning_style"]
        profile_summary = plan_profile["summary"]
        focus_topics = self._build_focus_topics(
            target=request.target,
            weak_focus=weak_focus,
            rag_titles=[hit.title for hit in rag.hits],
            profile_tags=plan_profile["tags"],
        )
        stage_focuses = self._build_stage_focuses(request.target, focus_topics)
        stage_statuses = self._resolve_stage_statuses(completion_rate)
        planned_sections = self._select_plan_sections(
            course_detail=course_detail,
            focus_topics=focus_topics,
            available_days=request.available_days,
        )
        stages = self._build_stages(
            stage_focuses=stage_focuses,
            preferred_resources=preferred_resources,
            stage_statuses=stage_statuses,
            available_days=request.available_days,
            plan_sections=planned_sections,
        )
        steps = self._build_steps(
            request=request,
            course_name=course_name,
            course_detail=course_detail,
            plan_sections=planned_sections,
            stage_focuses=stage_focuses,
            weak_focus=weak_focus,
            preferred_resources=preferred_resources,
            stage_statuses=stage_statuses,
            resources=resources,
            learning_style=learning_style,
        )
        current_step = self._resolve_current_step(steps, completion_rate)
        available_resource_types = self._collect_available_resource_types(resources)

        response = LearningPlanResponse(
            user_id=request.user_id,
            course_code=course_context.course_code,
            course_id=course_context.course_id,
            course_name=course_name,
            summary=self._build_plan_summary(
                course_name=course_name,
                learning_style=learning_style,
                weak_focus=weak_focus,
                current_step=current_step,
            ),
            profile_summary=profile_summary,
            progress_hint=progress_hint,
            next_action=self._build_next_action(current_step),
            risk_alerts=self._build_risk_alerts(
                available_days=request.available_days,
                daily_study_minutes=request.daily_study_minutes,
                weekly_frequency=weekly_frequency,
            ),
            path_mode="profile_resource_path",
            current_stage=current_step.stage_name if current_step and current_step.stage_name else self._resolve_current_stage(stage_focuses, completion_rate),
            recommended_learning_style=learning_style,
            available_resource_types=available_resource_types,
            completion_rate=completion_rate,
            dynamic_adjustments=self._build_dynamic_adjustments(weak_focus, request.available_days, learning_style),
            recommended_checkpoints=self._build_recommended_checkpoints(weak_focus),
            stages=stages,
            steps=steps,
        )
        return await self._persist_plan(request, response)

    async def update_step_status(
        self,
        *,
        plan_id: int,
        user_id: int,
        step_id: str,
        action: str,
    ) -> PlanProgressResponse:
        now = datetime.now(timezone.utc).isoformat()
        try:
            async with async_session_factory() as session:
                plan = await PlanRepository().get_by_id(session, plan_id)
                if plan is None or plan.user_id != user_id:
                    raise HTTPException(status_code=404, detail="plan not found")

                payload = LearningPlanResponse.model_validate({**plan.plan_data, "plan_id": plan.id})
                step_ids = {step.step_id or f"day-{step.day}" for step in payload.steps}
                if step_id not in step_ids:
                    raise HTTPException(status_code=404, detail="plan step not found")

                status_map = {
                    "complete": ("completed", "step completed"),
                    "pause": ("paused", "step paused"),
                    "resume": ("in_progress", "step resumed"),
                }
                status, note = status_map[action]

                await PlanProgressRepository().upsert_step(
                    session,
                    plan_id=plan_id,
                    user_id=user_id,
                    step_id=step_id,
                    status=status,
                    last_action=action,
                    progress_note=note,
                    created_at=now,
                    updated_at=now,
                )
                await session.commit()
            return await self.get_plan_progress(plan_id=plan_id, user_id=user_id)
        except (SQLAlchemyError, OSError):
            return self._update_local_step_status(
                plan_id=plan_id,
                user_id=user_id,
                step_id=step_id,
                action=action,
                updated_at=now,
            )

    async def get_plan_progress(self, *, plan_id: int, user_id: int) -> PlanProgressResponse:
        try:
            async with async_session_factory() as session:
                plan = await PlanRepository().get_by_id(session, plan_id)
                if plan is None or plan.user_id != user_id:
                    raise HTTPException(status_code=404, detail="plan not found")

                payload = LearningPlanResponse.model_validate({**plan.plan_data, "plan_id": plan.id})
                progress_items = await PlanProgressRepository().list_by_plan_user(
                    session,
                    plan_id=plan_id,
                    user_id=user_id,
                )
                progress_map = {
                    item.step_id: {
                        "status": item.status,
                        "progress_note": item.progress_note,
                        "last_action": item.last_action,
                        "updated_at": item.updated_at,
                    }
                    for item in progress_items
                }
                return self._build_progress_response(
                    plan_id=plan_id,
                    user_id=user_id,
                    payload=payload,
                    progress_map=progress_map,
                )
        except (SQLAlchemyError, OSError):
            return self._get_local_plan_progress(plan_id=plan_id, user_id=user_id)

    async def _persist_plan(
        self,
        request: LearningPlanRequest,
        response: LearningPlanResponse,
    ) -> LearningPlanResponse:
        now = datetime.now(timezone.utc).isoformat()
        try:
            async with async_session_factory() as session:
                plan = await PlanRepository().create_plan(
                    session,
                    user_id=request.user_id,
                    course_code=response.course_code,
                    status="generated",
                    summary=response.summary,
                    plan_data=response.model_dump(mode="json"),
                    created_at=now,
                    updated_at=now,
                )
                await session.commit()
            return response.model_copy(update={"plan_id": plan.id})
        except (SQLAlchemyError, OSError):
            return self._persist_local_plan(request=request, response=response, now=now)

    def _read_local_store(self) -> dict:
        if not self._local_store_path.exists():
            return {"next_plan_id": 1, "plans": [], "progress": []}
        try:
            return json.loads(self._local_store_path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            return {"next_plan_id": 1, "plans": [], "progress": []}

    def _write_local_store(self, store: dict) -> None:
        self._local_store_path.parent.mkdir(parents=True, exist_ok=True)
        self._local_store_path.write_text(
            json.dumps(store, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

    def _persist_local_plan(
        self,
        *,
        request: LearningPlanRequest,
        response: LearningPlanResponse,
        now: str,
    ) -> LearningPlanResponse:
        store = self._read_local_store()
        plan_id = int(store.get("next_plan_id", 1) or 1)
        store["next_plan_id"] = plan_id + 1
        store.setdefault("plans", []).append(
            {
                "id": plan_id,
                "user_id": request.user_id,
                "course_code": response.course_code,
                "status": "generated",
                "summary": response.summary,
                "plan_data": response.model_dump(mode="json"),
                "created_at": now,
                "updated_at": now,
            }
        )
        self._write_local_store(store)
        return response.model_copy(update={"plan_id": plan_id})

    def _get_local_plan(self, plan_id: int) -> LearningPlanResponse | None:
        store = self._read_local_store()
        for plan in store.get("plans", []):
            if int(plan.get("id", 0) or 0) == plan_id and plan.get("plan_data"):
                return LearningPlanResponse.model_validate({**plan["plan_data"], "plan_id": plan_id})
        return None

    def _get_latest_local_plan(self, *, user_id: int, course_code: str) -> LearningPlanResponse | None:
        store = self._read_local_store()
        matched = [
            plan
            for plan in store.get("plans", [])
            if plan.get("user_id") == user_id and plan.get("course_code") == course_code and plan.get("plan_data")
        ]
        if not matched:
            return None
        latest = max(matched, key=lambda item: int(item.get("id", 0) or 0))
        return LearningPlanResponse.model_validate({**latest["plan_data"], "plan_id": latest["id"]})

    def _get_local_plan_progress(self, *, plan_id: int, user_id: int) -> PlanProgressResponse:
        payload = self._get_local_plan(plan_id)
        if payload is None or payload.user_id != user_id:
            raise HTTPException(status_code=404, detail="plan not found")

        store = self._read_local_store()
        progress_map = {
            item["step_id"]: item
            for item in store.get("progress", [])
            if item.get("plan_id") == plan_id and item.get("user_id") == user_id
        }
        return self._build_progress_response(
            plan_id=plan_id,
            user_id=user_id,
            payload=payload,
            progress_map=progress_map,
        )

    def _update_local_step_status(
        self,
        *,
        plan_id: int,
        user_id: int,
        step_id: str,
        action: str,
        updated_at: str,
    ) -> PlanProgressResponse:
        payload = self._get_local_plan(plan_id)
        if payload is None or payload.user_id != user_id:
            raise HTTPException(status_code=404, detail="plan not found")

        step_ids = {step.step_id or f"day-{step.day}" for step in payload.steps}
        if step_id not in step_ids:
            raise HTTPException(status_code=404, detail="plan step not found")

        status_map = {
            "complete": ("completed", "step completed locally"),
            "pause": ("paused", "step paused locally"),
            "resume": ("in_progress", "step resumed locally"),
        }
        status, note = status_map[action]

        store = self._read_local_store()
        progress_items = store.setdefault("progress", [])
        for item in progress_items:
            if item.get("plan_id") == plan_id and item.get("user_id") == user_id and item.get("step_id") == step_id:
                item.update(
                    {
                        "status": status,
                        "progress_note": note,
                        "last_action": action,
                        "updated_at": updated_at,
                    }
                )
                break
        else:
            progress_items.append(
                {
                    "plan_id": plan_id,
                    "user_id": user_id,
                    "step_id": step_id,
                    "status": status,
                    "progress_note": note,
                    "last_action": action,
                    "updated_at": updated_at,
                }
            )

        self._write_local_store(store)
        return self._get_local_plan_progress(plan_id=plan_id, user_id=user_id)

    def _build_progress_response(
        self,
        *,
        plan_id: int,
        user_id: int,
        payload: LearningPlanResponse,
        progress_map: dict[str, dict],
    ) -> PlanProgressResponse:
        items: list[PlanStepProgressItem] = []
        completed_steps = 0
        for step in payload.steps:
            resolved_step_id = step.step_id or f"day-{step.day}"
            progress = progress_map.get(resolved_step_id)
            status = progress["status"] if progress else step.status
            if status == "completed":
                completed_steps += 1
            items.append(
                PlanStepProgressItem(
                    step_id=resolved_step_id,
                    status=status,
                    progress_note=progress.get("progress_note") if progress else None,
                    last_action=progress.get("last_action") if progress else "initialize",
                    updated_at=str(progress.get("updated_at")) if progress and progress.get("updated_at") else None,
                )
            )

        total_steps = len(payload.steps)
        completion_rate = round((completed_steps / total_steps) * 100, 1) if total_steps else 0.0
        return PlanProgressResponse(
            plan_id=plan_id,
            user_id=user_id,
            completion_rate=completion_rate,
            completed_steps=completed_steps,
            total_steps=total_steps,
            items=items,
        )

    async def _load_learning_course_detail(
        self,
        course_id: int,
        user_id: int,
    ) -> LearningCourseDetailResponse | None:
        try:
            return await CourseService().get_learning_course_detail(course_id, user_id=user_id)
        except Exception:
            return None

    async def _load_course_resources(
        self,
        user_id: int,
        course_id: int,
        course_code: str,
    ) -> list[ResourceCard]:
        try:
            response = await ResourceService().list_resources(
                user_id=user_id,
                course_id=course_id,
                course_code=course_code,
            )
            return list(response.items)
        except Exception:
            return []

    async def _load_profile_payload(self, user_id: int) -> dict:
        try:
            async with async_session_factory() as session:
                detail = await ProfileConversationService(session).get_profile(user_id)
                if detail:
                    return self._convert_conversation_profile_to_plan_profile(detail)
        except Exception:
            pass

        try:
            profile = await ProfileService().get_latest_profile(user_id)
            if profile is not None:
                return profile.model_dump(mode="json")
        except Exception:
            pass

        return {}

    def _convert_conversation_profile_to_plan_profile(self, detail) -> dict:
        dimensions: dict[str, dict] = {}
        recommended_resource_types: list[str] = []
        learning_style = ""
        weak_focus: list[str] = []

        for item in detail.dimensions:
            dim_data = dict(item.data or {})
            dimensions[item.dimension_code] = dim_data
            if item.dimension_code == "cognitive_style":
                preferred_format = dim_data.get("preferred_format") or []
                if preferred_format:
                    learning_style = " / ".join(str(value) for value in preferred_format[:2])
            if item.dimension_code == "error_preference":
                tracked_points = dim_data.get("tracked_points") or dim_data.get("high_frequency_errors") or []
                weak_focus = [str(value) for value in tracked_points if value][:3]
            if item.dimension_code == "interest_direction":
                interested_topics = dim_data.get("interested_topics") or []
                if interested_topics and "mindmap" not in recommended_resource_types:
                    recommended_resource_types.append("mindmap")
            if item.dimension_code == "knowledge_base" and "lecture_note" not in recommended_resource_types:
                recommended_resource_types.append("lecture_note")
            if item.dimension_code == "learning_progress" and "practice_set" not in recommended_resource_types:
                recommended_resource_types.append("practice_set")

        if not recommended_resource_types:
            recommended_resource_types = ["lecture_note", "mindmap", "practice_set"]

        if weak_focus:
            dimensions["weak_point_preference"] = {"evidence": weak_focus}

        return {
            "dimensions": dimensions,
            "recommended_resource_types": recommended_resource_types,
            "summary": detail.summary,
            "profile_tags": list(detail.tags or []),
            "recommended_learning_style": learning_style,
        }

    def _normalize_plan_profile(self, profile_payload: dict) -> dict:
        dimensions = profile_payload.get("dimensions", {}) if isinstance(profile_payload, dict) else {}
        tags = [str(item) for item in profile_payload.get("profile_tags", []) if item] if isinstance(profile_payload, dict) else []
        preferred_resources = profile_payload.get("recommended_resource_types") if isinstance(profile_payload, dict) else None
        preferred_resources = [
            str(item)
            for item in (preferred_resources or ["lecture_note", "mindmap", "practice_set"])
            if item
        ]

        weak_focus = []
        weak_point_dimension = dimensions.get("weak_point_preference")
        if isinstance(weak_point_dimension, dict):
            weak_focus = [str(item) for item in weak_point_dimension.get("evidence", []) if item]

        if not weak_focus:
            error_preference = dimensions.get("error_preference")
            if isinstance(error_preference, dict):
                weak_focus = [
                    str(item)
                    for item in (error_preference.get("tracked_points") or error_preference.get("high_frequency_errors") or [])
                    if item
                ]

        summary = str(profile_payload.get("summary") or "").strip() if isinstance(profile_payload, dict) else ""
        learning_style = str(profile_payload.get("recommended_learning_style") or "").strip() if isinstance(profile_payload, dict) else ""
        if not learning_style:
            cognitive_style = dimensions.get("cognitive_style")
            if isinstance(cognitive_style, dict):
                current_level = cognitive_style.get("current_level")
                preferred_format = cognitive_style.get("preferred_format") or []
                learning_style = str(current_level or (" / ".join(str(item) for item in preferred_format[:2]) if preferred_format else "结构化讲解 + 练习巩固"))
        if not learning_style:
            learning_style = "结构化讲解 + 练习巩固"

        return {
            "dimensions": dimensions,
            "weak_focus": weak_focus,
            "preferred_resources": preferred_resources[:4],
            "summary": summary,
            "learning_style": learning_style,
            "tags": tags,
        }

    def _build_focus_topics(
        self,
        *,
        target: str,
        weak_focus: list[str],
        rag_titles: list[str],
        profile_tags: list[str],
    ) -> list[str]:
        candidates: list[str] = []
        for value in [*weak_focus, *rag_titles, *profile_tags, target]:
            text = str(value or "").strip()
            if not text or text in candidates:
                continue
            candidates.append(text)
        return candidates[:6] or [target]

    def _select_plan_sections(
        self,
        *,
        course_detail: LearningCourseDetailResponse,
        focus_topics: list[str],
        available_days: int,
    ) -> list[dict]:
        all_sections: list[dict] = []
        for chapter in course_detail.chapters:
            for section in chapter.sections:
                all_sections.append(
                    {
                        "chapter_id": chapter.id,
                        "chapter_name": chapter.name,
                        "section": section,
                    }
                )

        if not all_sections:
            return []

        desired_count = max(3, min(len(all_sections), available_days))
        scored: list[tuple[int, dict]] = []
        focus_text = " ".join(focus_topics).lower()
        for item in all_sections:
            section_name = str(item["section"].name or "")
            chapter_name = str(item["chapter_name"] or "")
            text = f"{chapter_name} {section_name}".lower()
            score = 0
            for focus in focus_topics:
                normalized_focus = str(focus or "").lower()
                if normalized_focus and normalized_focus in text:
                    score += 3
            if section_name and section_name.lower() in focus_text:
                score += 2
            if item["section"].id == course_detail.latest_section_id:
                score += 4
            score += max(0, 6 - int(item["section"].index or 0))
            scored.append((score, item))

        scored.sort(key=lambda value: (-value[0], int(value[1]["section"].index or 0)))
        selected = [item for _, item in scored[:desired_count]]
        selected.sort(key=lambda value: int(value["section"].index or 0))

        result: list[dict] = []
        total = len(selected)
        for index, item in enumerate(selected, start=1):
            result.append(
                {
                    **item,
                    "focus": focus_topics[min(index - 1, len(focus_topics) - 1)],
                    "stage_no": self._resolve_stage_no(index, total),
                }
            )
        return result

    def _match_resources_for_section(
        self,
        *,
        resources: list[ResourceCard],
        section_name: str,
        chapter_name: str,
        focus: str,
        preferred_resource_types: list[str],
    ) -> list[ResourceCard]:
        if not resources:
            return []

        scored: list[tuple[int, ResourceCard]] = []
        keywords = [section_name, chapter_name, focus]
        for resource in resources:
            score = 0
            resource_type = str(resource.resource_type or "")
            if resource_type in preferred_resource_types:
                score += 4
            title_text = f"{resource.title} {resource.summary} {' '.join(resource.source_titles)}".lower()
            for keyword in keywords:
                normalized = str(keyword or "").strip().lower()
                if normalized and normalized in title_text:
                    score += 3
            for source_file in resource.source_files or []:
                file_name = str(source_file.display_name or "").lower()
                if any(str(keyword or "").strip().lower() in file_name for keyword in keywords if keyword):
                    score += 2
                    break
            scored.append((score, resource))

        scored.sort(
            key=lambda value: (
                -value[0],
                0 if value[1].resource_type in preferred_resource_types else 1,
                str(value[1].title or ""),
            )
        )
        matched = [resource for score, resource in scored if score > 0][:3]
        if matched:
            return matched

        by_type = [resource for resource in resources if resource.resource_type in preferred_resource_types]
        return by_type[:3] or resources[:3]

    def _build_resource_pushes(
        self,
        *,
        matched_resources: list[ResourceCard],
        preferred_resource_types: list[str],
        focus: str,
    ) -> list[PlanResourcePush]:
        pushes: list[PlanResourcePush] = []
        for resource in matched_resources:
            primary_file = self._pick_primary_source_file(resource)
            pushes.append(
                PlanResourcePush(
                    resource_type=resource.resource_type,
                    title=f"推荐资源：{resource.title}",
                    reason=f"围绕 {focus} 推荐现有资源，优先用于课堂前后衔接。",
                    status="ready",
                    resource_id=resource.resource_id,
                    resource_title=resource.title,
                    source_file_id=primary_file.file_id if primary_file else None,
                    open_url=primary_file.open_url if primary_file else None,
                )
            )

        existing_types = {item.resource_type for item in pushes}
        for resource_type in preferred_resource_types:
            if resource_type in existing_types:
                continue
            pushes.append(
                PlanResourcePush(
                    resource_type=resource_type,
                    title=f"待补充资源类型：{resource_type}",
                    reason=f"当前阶段围绕 {focus} 建议补充该类资源。",
                    status="suggested",
                )
            )
        return pushes[:4]

    @staticmethod
    def _pick_primary_source_file(resource: ResourceCard) -> ResourceSourceFileRef | None:
        source_files = list(resource.source_files or [])
        if not source_files:
            return None
        source_files.sort(key=lambda item: (0 if item.is_inline_previewable else 1, str(item.display_name or "")))
        return source_files[0]

    @staticmethod
    def _resolve_step_duration(*, daily_study_minutes: int, section_minutes: int) -> int:
        section_budget = max(20, round((section_minutes or 0) / 60)) if section_minutes else 0
        if not section_budget:
            return max(30, daily_study_minutes)
        return max(30, min(max(daily_study_minutes, section_budget), daily_study_minutes + 20))

    def _build_tasks(
        self,
        *,
        course_name: str,
        section_name: str,
        focus: str,
        chapter_name: str,
        daily_study_minutes: int,
        learning_style: str,
        resources: list[ResourceCard],
    ) -> list[str]:
        tasks = [
            f"在《{course_name}》课堂中学习 {chapter_name} / {section_name}，控制在约 {daily_study_minutes} 分钟内完成。",
            f"围绕 {focus} 记录 2 到 3 个关键点，说明它与当前画像薄弱项的关系。",
            f"按当前学习风格“{learning_style}”复盘本节内容，并整理一条可复用的总结。",
        ]
        if resources:
            tasks.append(f"同步使用资源《{resources[0].title}》完成课堂前预习或课堂后巩固。")
        return tasks

    @staticmethod
    def _build_path_reason(focus: str, chapter_name: str, section_name: str, learning_style: str) -> str:
        return f"根据当前画像，优先把 {focus} 映射到 {chapter_name} / {section_name}，并采用 {learning_style} 的方式推进。"

    @staticmethod
    def _resolve_current_step(steps: list[LearningPlanStep], completion_rate: float) -> LearningPlanStep | None:
        if not steps:
            return None
        if completion_rate >= 80:
            return steps[-1]
        if completion_rate >= 45:
            return steps[min(1, len(steps) - 1)]
        return steps[0]

    @staticmethod
    def _collect_available_resource_types(resources: list[ResourceCard]) -> list[str]:
        result: list[str] = []
        for resource in resources:
            resource_type = str(resource.resource_type or "").strip()
            if resource_type and resource_type not in result:
                result.append(resource_type)
        return result

    @staticmethod
    def _build_progress_hint(completion_rate: float, course_detail: LearningCourseDetailResponse) -> str:
        if completion_rate:
            return f"当前课程学习进度约为 {completion_rate:.0f}%，路径已按现有进度定位到对应课堂节点。"
        latest_section_id = course_detail.latest_section_id
        if latest_section_id:
            return "尚未取到稳定进度记录，已按最近课堂章节为你生成起步路径。"
        return "尚未取到学习进度，将从课程导入章节开始推荐学习路径。"

    @staticmethod
    def _build_plan_summary(
        *,
        course_name: str,
        learning_style: str,
        weak_focus: list[str],
        current_step: LearningPlanStep | None,
    ) -> str:
        focus = weak_focus[0] if weak_focus else "当前核心知识点"
        current = current_step.title if current_step else "课程起始章节"
        return f"基于画像为《{course_name}》重组课堂路径，优先补强“{focus}”，并从“{current}”开始，以 {learning_style} 的方式推进。"

    @staticmethod
    def _build_next_action(current_step: LearningPlanStep | None) -> str:
        if current_step is None:
            return "先进入课堂页，开始当前推荐章节。"
        section_name = current_step.title
        resource_title = current_step.resource_titles[0] if current_step.resource_titles else None
        if resource_title:
            return f"先进入课堂学习《{section_name}》，再结合《{resource_title}》完成巩固。"
        return f"先进入课堂学习《{section_name}》，完成后再进行资源巩固。"

    def _build_stages(
        self,
        *,
        stage_focuses: list[str],
        preferred_resources: list[str],
        stage_statuses: list[str],
        available_days: int,
        plan_sections: list[dict],
    ) -> list[LearningPlanStage]:
        stage_names = ["画像诊断", "资源强化", "课堂收束"]
        criteria = [
            ["确认当前基础与薄弱点", "明确第一批推荐章节与资料"],
            ["完成针对性章节学习", "结合现有资源进行练习和巩固"],
            ["回到课堂完成串联", "输出总结并准备测评或答疑"],
        ]
        total_days = max(available_days, 3)
        days_per_stage = [1, max(1, total_days - 2), 1]

        stages: list[LearningPlanStage] = []
        for index, stage_name in enumerate(stage_names):
            stage_sections = [item for item in plan_sections if item["stage_no"] == index + 1]
            objective = (
                f"围绕 {stage_focuses[index]}，优先完成 {stage_sections[0]['section'].name} 等课堂节点。"
                if stage_sections
                else f"围绕 {stage_focuses[index]} 建立稳定掌握。"
            )
            stages.append(
                LearningPlanStage(
                    stage_no=index + 1,
                    stage_name=stage_name,
                    focus=stage_focuses[index],
                    objective=objective,
                    estimated_days=days_per_stage[index],
                    status=stage_statuses[index],
                    recommended_resource_types=preferred_resources[:3],
                    completion_criteria=criteria[index],
                )
            )
        return stages

    def _build_steps(
        self,
        *,
        request: LearningPlanRequest,
        course_name: str,
        course_detail: LearningCourseDetailResponse,
        plan_sections: list[dict],
        stage_focuses: list[str],
        weak_focus: list[str],
        preferred_resources: list[str],
        stage_statuses: list[str],
        resources: list[ResourceCard],
        learning_style: str,
    ) -> list[LearningPlanStep]:
        steps: list[LearningPlanStep] = []
        for index, item in enumerate(plan_sections, start=1):
            section = item["section"]
            chapter_name = item["chapter_name"]
            stage_no = item["stage_no"]
            focus = item["focus"]
            matched_resources = self._match_resources_for_section(
                resources=resources,
                section_name=section.name,
                chapter_name=chapter_name,
                focus=focus,
                preferred_resource_types=preferred_resources,
            )
            resource_pushes = self._build_resource_pushes(
                matched_resources=matched_resources,
                preferred_resource_types=preferred_resources,
                focus=focus,
            )
            resource_ids = [resource.resource_id for resource in matched_resources if resource.resource_id is not None]
            resource_titles = [resource.title for resource in matched_resources[:3]]
            duration_minutes = self._resolve_step_duration(
                daily_study_minutes=request.daily_study_minutes,
                section_minutes=section.media_duration,
            )
            steps.append(
                LearningPlanStep(
                    step_id=f"section-{section.id}",
                    day=index,
                    title=section.name,
                    objective=f"结合画像优先学习《{chapter_name}》中的 {section.name}，并完成一轮针对性巩固。",
                    tasks=self._build_tasks(
                        course_name=course_name,
                        section_name=section.name,
                        focus=focus,
                        chapter_name=chapter_name,
                        daily_study_minutes=duration_minutes,
                        learning_style=learning_style,
                        resources=matched_resources,
                    ),
                    checkpoint=self._build_checkpoint(focus, stage_no, section.name),
                    stage_no=stage_no,
                    stage_name=["画像诊断", "资源强化", "课堂收束"][stage_no - 1],
                    chapter_id=item["chapter_id"],
                    chapter_name=chapter_name,
                    section_id=section.id,
                    node_type="classroom_path_node",
                    status=self._resolve_step_status(index, len(plan_sections), stage_statuses),
                    duration_minutes=duration_minutes,
                    weak_point_focus=weak_focus[:2],
                    knowledge_points=[focus, chapter_name, section.name],
                    recommended_resource_types=preferred_resources[:3],
                    resource_pushes=resource_pushes,
                    resource_ids=resource_ids,
                    resource_titles=resource_titles,
                    path_reason=self._build_path_reason(focus, chapter_name, section.name, learning_style),
                )
            )
        return steps

    @staticmethod
    def _build_stage_focuses(target: str, focus_topics: list[str]) -> list[str]:
        primary_focus = focus_topics[0] if focus_topics else target
        secondary_focus = focus_topics[1] if len(focus_topics) > 1 else primary_focus
        closing_focus = focus_topics[2] if len(focus_topics) > 2 else secondary_focus
        return [f"{target} 画像诊断", primary_focus, closing_focus]

    @staticmethod
    def _resolve_stage_statuses(completion_rate: float) -> list[str]:
        if completion_rate >= 80:
            return ["completed", "completed", "in_progress"]
        if completion_rate >= 45:
            return ["completed", "in_progress", "pending"]
        return ["in_progress", "pending", "pending"]

    @staticmethod
    def _resolve_current_stage(stage_focuses: list[str], completion_rate: float) -> str:
        if completion_rate >= 80:
            return stage_focuses[2]
        if completion_rate >= 45:
            return stage_focuses[1]
        return stage_focuses[0]

    @staticmethod
    def _resolve_step_status(index: int, total_steps: int, stage_statuses: list[str]) -> str:
        if index == 1:
            return stage_statuses[0]
        if index == total_steps and stage_statuses[2] == "in_progress":
            return "in_progress"
        if index == 2 and stage_statuses[1] == "in_progress":
            return "in_progress"
        return "pending"

    @staticmethod
    def _build_checkpoint(focus: str, stage_no: int, section_name: str) -> str:
        if stage_no == 1:
            return f"说明为什么当前先学 {section_name}，并写出与 {focus} 的对应关系。"
        if stage_no == 2:
            return f"结合资源完成 {section_name} 的强化练习，并复盘 {focus} 的易错点。"
        return f"回到课堂页串联 {section_name}，输出一份围绕 {focus} 的总结。"

    @staticmethod
    def _build_dynamic_adjustments(weak_focus: list[str], available_days: int, learning_style: str) -> list[str]:
        adjustments = [
            "若课堂章节完成后测评仍低于 70 分，优先回退到同主题讲义与练习集。",
            "若连续两轮课堂与资源联动都完成顺利，后续路径可以压缩导入阶段。",
        ]
        if available_days <= 3:
            adjustments.append("可用时间较短，优先保留课堂核心章节与薄弱点复盘。")
        if weak_focus:
            adjustments.append(f"后续资源推荐会持续围绕 {weak_focus[0]} 强化。")
        if learning_style:
            adjustments.append(f"资源呈现方式优先遵循当前画像学习风格：{learning_style}。")
        return adjustments

    @staticmethod
    def _build_recommended_checkpoints(weak_focus: list[str]) -> list[str]:
        focus = weak_focus[0] if weak_focus else "the current key topic"
        return [
            "完成第一步后，确认课堂章节与推荐资源是否匹配当前基础。",
            f"围绕 {focus} 至少完成一次针对性错因复盘。",
            "完成最终课堂节点后，输出个人总结并进入测评或答疑。",
        ]

    @staticmethod
    def _build_risk_alerts(
        available_days: int,
        daily_study_minutes: int,
        weekly_frequency: int | None,
    ) -> list[str]:
        alerts: list[str] = []
        if available_days <= 3:
            alerts.append("Few available days: prioritize high-frequency and foundational topics.")
        if daily_study_minutes < 30:
            alerts.append("Short daily study time: split into concept review and mistake review.")
        if weekly_frequency is not None and weekly_frequency < 2:
            alerts.append("Low historical study frequency: rebuild a stable review rhythm first.")
        return alerts
