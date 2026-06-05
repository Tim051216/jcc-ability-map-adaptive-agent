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
from app.services.rag_service import RagService


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

        try:
            course = await CourseClient().get_course_detail(int(course_context.course_id))
        except (TypeError, ValueError, httpx.HTTPError):
            course = None

        try:
            learning_record = await LearningClient().get_learning_record_by_course(int(course_context.course_id))
        except (TypeError, ValueError, httpx.HTTPError):
            learning_record = None

        course_name = course.name if course and course.name else course_context.course_name or course_context.course_code
        completion_rate = float(getattr(learning_record, "process_percent", 0) or 0)
        weekly_frequency = getattr(learning_record, "week_freq", None)
        progress_hint = (
            f"Current learning progress is about {completion_rate:.0f}%."
            if completion_rate
            else "No stable learning progress record was found yet. Start from the diagnostic stage."
        )

        rag = await RagService().search(
            RagSearchRequest(
                course_code=course_context.course_code,
                query=request.target,
                top_k=min(max(request.available_days, 3), 6),
            )
        )

        profile = request.profile or {}
        dimensions = profile.get("dimensions", {})
        weak_focus = dimensions.get("weak_point_preference", {}).get("evidence", []) or [request.target]
        preferred_resources = profile.get("recommended_resource_types") or [
            "lecture_note",
            "mindmap",
            "practice_set",
        ]
        stage_focuses = self._build_stage_focuses(request.target, weak_focus)
        stage_statuses = self._resolve_stage_statuses(completion_rate)
        stages = self._build_stages(stage_focuses, preferred_resources, stage_statuses, request.available_days)
        steps = self._build_steps(
            request=request,
            rag_titles=[hit.title for hit in rag.hits],
            stage_focuses=stage_focuses,
            weak_focus=weak_focus,
            preferred_resources=preferred_resources,
            stage_statuses=stage_statuses,
        )

        response = LearningPlanResponse(
            user_id=request.user_id,
            course_code=course_context.course_code,
            course_id=course_context.course_id,
            course_name=course_name,
            summary=f"A staged study path for '{request.target}' covering diagnosis, focused practice, and consolidation.",
            progress_hint=progress_hint,
            next_action="Complete day 1 first, then review weak points and continue with the next stage.",
            risk_alerts=self._build_risk_alerts(
                available_days=request.available_days,
                daily_study_minutes=request.daily_study_minutes,
                weekly_frequency=weekly_frequency,
            ),
            path_mode="laddered",
            current_stage=self._resolve_current_stage(stage_focuses, completion_rate),
            completion_rate=completion_rate,
            dynamic_adjustments=self._build_dynamic_adjustments(weak_focus, request.available_days),
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

    def _build_stages(
        self,
        stage_focuses: list[str],
        preferred_resources: list[str],
        stage_statuses: list[str],
        available_days: int,
    ) -> list[LearningPlanStage]:
        stage_names = ["Diagnostic", "Focused Practice", "Consolidation"]
        criteria = [
            ["Review core concepts", "Explain the key ideas in your own words"],
            ["Finish one round of targeted exercises", "Explain common mistakes and fixes"],
            ["Finish integrated practice", "Produce a final summary or solution walkthrough"],
        ]
        total_days = max(available_days, 3)
        days_per_stage = [1, max(1, total_days - 2), 1]

        stages: list[LearningPlanStage] = []
        for index, stage_name in enumerate(stage_names):
            stages.append(
                LearningPlanStage(
                    stage_no=index + 1,
                    stage_name=stage_name,
                    focus=stage_focuses[index],
                    objective=f"Build stable mastery around {stage_focuses[index]}.",
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
        rag_titles: list[str],
        stage_focuses: list[str],
        weak_focus: list[str],
        preferred_resources: list[str],
        stage_statuses: list[str],
    ) -> list[LearningPlanStep]:
        total_days = max(request.available_days, 3)
        titles = rag_titles or [
            f"{request.course_code} core concepts review",
            f"{request.course_code} common mistakes analysis",
            f"{request.course_code} integrated practice",
        ]
        stage_names = ["Diagnostic", "Focused Practice", "Consolidation"]

        steps: list[LearningPlanStep] = []
        for day in range(1, total_days + 1):
            stage_no = self._resolve_stage_no(day, total_days)
            focus = stage_focuses[stage_no - 1]
            title = titles[(day - 1) % len(titles)]
            steps.append(
                LearningPlanStep(
                    step_id=f"day-{day}",
                    day=day,
                    title=title,
                    objective=f"Finish the study tasks for {focus} and leave a reusable study note.",
                    tasks=self._build_tasks(title, focus, request.daily_study_minutes),
                    checkpoint=self._build_checkpoint(focus, stage_no),
                    stage_no=stage_no,
                    stage_name=stage_names[stage_no - 1],
                    node_type="path_node",
                    status=stage_statuses[stage_no - 1] if day == 1 else "pending",
                    duration_minutes=request.daily_study_minutes,
                    weak_point_focus=weak_focus[:2],
                    knowledge_points=[focus, title],
                    recommended_resource_types=preferred_resources[:3],
                    resource_pushes=self._build_resource_pushes(preferred_resources[:3], focus, day),
                )
            )
        return steps

    @staticmethod
    def _build_stage_focuses(target: str, weak_focus: list[str]) -> list[str]:
        primary_focus = weak_focus[0] if weak_focus else target
        secondary_focus = weak_focus[1] if len(weak_focus) > 1 else f"{target} common mistakes"
        return [f"{target} diagnosis", primary_focus, secondary_focus]

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
    def _resolve_stage_no(day: int, total_days: int) -> int:
        if day == 1:
            return 1
        if day >= total_days:
            return 3
        return 2

    @staticmethod
    def _build_tasks(title: str, focus: str, daily_study_minutes: int) -> list[str]:
        return [
            f"Read and understand '{title}' in about {max(daily_study_minutes // 3, 15)} minutes.",
            f"Write 3 short notes around {focus}: concept, mistake, and application.",
            "Finish one focused exercise set and record the reason behind each mistake.",
        ]

    @staticmethod
    def _build_resource_pushes(
        resource_types: list[str],
        focus: str,
        day: int,
    ) -> list[PlanResourcePush]:
        return [
            PlanResourcePush(
                resource_type=resource_type,
                title=f"Day {day} resource: {resource_type}",
                reason=f"Recommended for the current focus: {focus}.",
                status="ready",
            )
            for resource_type in resource_types
        ]

    @staticmethod
    def _build_checkpoint(focus: str, stage_no: int) -> str:
        if stage_no == 1:
            return f"Explain the basic definition and boundary of {focus}."
        if stage_no == 2:
            return f"Identify at least 2 common mistakes around {focus} and explain the fix."
        return f"Produce a complete summary or walkthrough based on {focus}."

    @staticmethod
    def _build_dynamic_adjustments(weak_focus: list[str], available_days: int) -> list[str]:
        adjustments = [
            "If quiz performance drops below 70%, increase weak-point practice weight.",
            "If two rounds of practice stay above 85%, raise the difficulty of later tasks.",
        ]
        if available_days <= 3:
            adjustments.append("The cycle is short, so focus on core knowledge and mistake review first.")
        if weak_focus:
            adjustments.append(f"Later resource pushes will keep reinforcing {weak_focus[0]}.")
        return adjustments

    @staticmethod
    def _build_recommended_checkpoints(weak_focus: list[str]) -> list[str]:
        focus = weak_focus[0] if weak_focus else "the current key topic"
        return [
            "Submit one self-check after the first diagnostic round.",
            f"Complete at least one mistake review focused on {focus}.",
            "Produce a final personal summary after the consolidation stage.",
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
