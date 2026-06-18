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
from app.integrations.llm.client import get_llm_client
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
from app.services.rag_service import RagService


class PlanService:
    _local_store_path = Path(__file__).resolve().parents[2] / "local_data" / "plan_store.json"

    def build_starter_plan(
        self,
        *,
        user_id: int,
        course_code: str,
        course_id: int | None = None,
        course_name: str | None = None,
    ) -> LearningPlanResponse:
        resolved_course_name = course_name or course_code or "当前课程"
        stages = [
            LearningPlanStage(
                stage_no=1,
                stage_name="目标对齐",
                focus="先确认这一轮最值得优先推进的学习目标",
                objective=f"明确你在 {resolved_course_name} 当前最想先拿下的内容。",
                estimated_days=1,
                status="in_progress",
                recommended_resource_types=["lecture_notes", "mind_map"],
                completion_criteria=["确定当前目标", "明确先学哪个知识点"],
            ),
            LearningPlanStage(
                stage_no=2,
                stage_name="专题强化",
                focus="围绕核心知识点完成一轮学习与练习",
                objective="把刚确定的目标推进成一轮可完成的小闭环。",
                estimated_days=2,
                status="pending",
                recommended_resource_types=["practice_set", "slides"],
                completion_criteria=["完成一段专注学习", "完成一组相关练习"],
            ),
            LearningPlanStage(
                stage_no=3,
                stage_name="复盘迁移",
                focus="复盘收获，并决定接下来继续补哪一块",
                objective="把这轮学习沉淀为可复用的理解和下一步动作。",
                estimated_days=1,
                status="pending",
                recommended_resource_types=["mind_map", "summary_notes"],
                completion_criteria=["写下一条复盘记录", "确定下一步行动"],
            ),
        ]
        steps = [
            LearningPlanStep(
                step_id="starter-step-1",
                day=1,
                title="确认当前最优先的学习目标",
                objective=f"先选出你在 {resolved_course_name} 这一轮最值得先完成的内容。",
                tasks=[
                    "快速浏览当前页面，找出最需要先解决的内容。",
                    "用一句话说清楚你接下来要先完成什么。",
                ],
                checkpoint="你能说明这一轮先学什么，以及为什么先学它。",
                stage_no=1,
                stage_name="目标对齐",
                node_type="study_task",
                status="in_progress",
                duration_minutes=20,
                recommended_resource_types=["lecture_notes"],
            ),
            LearningPlanStep(
                step_id="starter-step-2",
                day=1,
                title="完成一段聚焦练习",
                objective="借助一份资源或一组练习，把当前知识点往前推进一截。",
                tasks=[
                    "学完一段核心讲解或一份重点资料。",
                    "完成一组小练习或一个检查点。",
                ],
                checkpoint="这一轮结束后，手里已经有一份明确的学习产出。",
                stage_no=2,
                stage_name="专题强化",
                node_type="practice_task",
                status="pending",
                duration_minutes=35,
                recommended_resource_types=["practice_set", "slides"],
            ),
            LearningPlanStep(
                step_id="starter-step-3",
                day=1,
                title="写一条复盘，并确定下一步",
                objective="把刚学会的内容沉淀下来，并决定接下来继续补什么。",
                tasks=[
                    "写下这一轮真正搞懂的一点。",
                    "决定下一步是继续练习，还是回头补基础。",
                ],
                checkpoint="你已经留下复盘记录，并做出了下一步决定。",
                stage_no=3,
                stage_name="复盘迁移",
                node_type="review_task",
                status="pending",
                duration_minutes=15,
                recommended_resource_types=["mind_map", "summary_notes"],
            ),
        ]
        return LearningPlanResponse(
            plan_id=None,
            user_id=user_id,
            course_code=course_code,
            course_id=course_id,
            course_name=resolved_course_name,
            summary=f"{resolved_course_name} 的学习路径已生成，可先按这条路径开始推进。",
            progress_hint="系统会结合你的目标、学习进度和画像，在你开始后继续补全更细的个性化安排。",
            next_action="先完成第一个步骤，再继续生成更完整的个性化学习路径。",
            risk_alerts=[],
            path_mode="laddered",
            current_stage=stages[0].focus,
            completion_rate=0.0,
            dynamic_adjustments=["完成首轮任务后，系统会根据你的表现继续细化路径。"],
            recommended_checkpoints=["先完成第一轮学习，再看哪些点还需要继续补。"],
            stages=stages,
            steps=steps,
        )

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
                    return self._get_latest_local_plan(user_id=user_id, course_code=course_code)
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
        aligned_target = self._align_target_to_course(request.target, course_name)
        completion_rate = float(getattr(learning_record, "process_percent", 0) or 0)
        weekly_frequency = getattr(learning_record, "week_freq", None)
        progress_hint = (
            f"当前学习进度约为 {completion_rate:.0f}%，这条路径会优先围绕你目前最需要补强的部分来安排。"
            if completion_rate
            else "当前还没有稳定的学习进度记录，这条路径会先从诊断和起步阶段开始。"
        )

        rag = await RagService().search(
            RagSearchRequest(
                course_code=course_context.course_code,
                query=aligned_target,
                top_k=min(max(request.available_days, 3), 6),
            )
        )
        rag_titles = [hit.title for hit in rag.hits]

        profile = request.profile or {}
        dimensions = profile.get("dimensions", {})
        weak_focus = dimensions.get("weak_point_preference", {}).get("evidence", []) or [aligned_target]
        preferred_resources = profile.get("recommended_resource_types") or [
            "lecture_notes",
            "mind_map",
            "practice_set",
        ]
        stage_statuses = self._resolve_stage_statuses(completion_rate)
        course_topics = self._derive_course_topics(
            course_name=course_name,
            course_code=course_context.course_code,
            course_id=course_context.course_id,
            rag_titles=rag_titles,
        )
        stage_focuses = self._build_stage_focuses(
            target=aligned_target,
            weak_focus=weak_focus,
            course_name=course_name,
            course_topics=course_topics,
        )

        ai_blueprint = await self._generate_ai_plan_blueprint(
            request=request,
            course_name=course_name,
            completion_rate=completion_rate,
            weak_focus=weak_focus,
            preferred_resources=preferred_resources,
            rag_titles=rag_titles,
            profile=profile,
            aligned_target=aligned_target,
        )

        if ai_blueprint:
            stages = self._build_ai_stages(
                blueprint=ai_blueprint,
                preferred_resources=preferred_resources,
                stage_statuses=stage_statuses,
                available_days=request.available_days,
            )
            steps = self._build_ai_steps(
                request=request,
                blueprint=ai_blueprint,
                weak_focus=weak_focus,
                preferred_resources=preferred_resources,
                stage_statuses=stage_statuses,
            )
            stage_focuses = [stage.focus for stage in stages]
        else:
            stages = self._build_stages(stage_focuses, preferred_resources, stage_statuses, request.available_days)
            steps = self._build_steps(
                request=request,
                course_name=course_name,
                rag_titles=rag_titles,
                course_topics=course_topics,
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
            summary=f"已围绕“{aligned_target}”生成个性化学习路径，路径会结合你的画像、进度和薄弱点安排每天要学什么。",
            progress_hint=progress_hint,
            next_action="先完成今天的第一条任务，再根据完成结果继续推进下一阶段。",
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
                    steps=payload.steps,
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
        payload = response.model_dump(mode="json")
        payload.pop("plan_id", None)
        try:
            async with async_session_factory() as session:
                record = await PlanRepository().create_plan(
                    session,
                    user_id=request.user_id,
                    course_code=response.course_code,
                    status="generated",
                    summary=response.summary,
                    plan_data=payload,
                    created_at=now,
                    updated_at=now,
                )
                await session.commit()
                return response.model_copy(update={"plan_id": record.id})
        except (SQLAlchemyError, OSError):
            return self._persist_local_plan(request, response, created_at=now)

    def _read_local_store(self) -> dict:
        if not self._local_store_path.exists():
            return {"plans": [], "progress": []}
        try:
            return json.loads(self._local_store_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return {"plans": [], "progress": []}

    def _write_local_store(self, store: dict) -> None:
        self._local_store_path.parent.mkdir(parents=True, exist_ok=True)
        self._local_store_path.write_text(
            json.dumps(store, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

    def _persist_local_plan(
        self,
        request: LearningPlanRequest,
        response: LearningPlanResponse,
        *,
        created_at: str,
    ) -> LearningPlanResponse:
        store = self._read_local_store()
        plans = store.setdefault("plans", [])
        next_id = max((int(item.get("plan_id", 0)) for item in plans), default=0) + 1
        payload = response.model_dump(mode="json")
        payload["plan_id"] = next_id
        plans.append(
            {
                "plan_id": next_id,
                "user_id": request.user_id,
                "course_code": response.course_code,
                "summary": response.summary,
                "created_at": created_at,
                "updated_at": created_at,
                "plan_data": payload,
            }
        )
        self._write_local_store(store)
        return response.model_copy(update={"plan_id": next_id})

    def _get_local_plan(self, plan_id: int) -> LearningPlanResponse | None:
        store = self._read_local_store()
        for item in store.get("plans", []):
            if int(item.get("plan_id", 0)) == int(plan_id):
                data = item.get("plan_data") or {}
                return LearningPlanResponse.model_validate(data)
        return None

    def _get_latest_local_plan(self, *, user_id: int, course_code: str) -> LearningPlanResponse | None:
        store = self._read_local_store()
        candidates = [
            item
            for item in store.get("plans", [])
            if int(item.get("user_id", 0)) == int(user_id) and item.get("course_code") == course_code
        ]
        if not candidates:
            return None
        latest = max(candidates, key=lambda item: int(item.get("plan_id", 0)))
        return LearningPlanResponse.model_validate(latest.get("plan_data") or {})

    def _get_local_plan_progress(self, *, plan_id: int, user_id: int) -> PlanProgressResponse:
        payload = self._get_local_plan(plan_id)
        if payload is None:
            raise HTTPException(status_code=404, detail="plan not found")
        store = self._read_local_store()
        progress_items = [
            item
            for item in store.get("progress", [])
            if int(item.get("plan_id", 0)) == int(plan_id) and int(item.get("user_id", 0)) == int(user_id)
        ]
        progress_map = {item["step_id"]: item for item in progress_items}
        return self._build_progress_response(
            plan_id=plan_id,
            user_id=user_id,
            steps=payload.steps,
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
        if payload is None:
            raise HTTPException(status_code=404, detail="plan not found")
        step_ids = {step.step_id or f"day-{step.day}" for step in payload.steps}
        if step_id not in step_ids:
            raise HTTPException(status_code=404, detail="plan step not found")

        store = self._read_local_store()
        progress = store.setdefault("progress", [])
        status_map = {
            "complete": ("completed", "step completed"),
            "pause": ("paused", "step paused"),
            "resume": ("in_progress", "step resumed"),
        }
        status, note = status_map[action]
        for item in progress:
            if (
                int(item.get("plan_id", 0)) == int(plan_id)
                and int(item.get("user_id", 0)) == int(user_id)
                and item.get("step_id") == step_id
            ):
                item.update(
                    {
                        "status": status,
                        "progress_note": note,
                        "last_action": action,
                        "updated_at": updated_at,
                    }
                )
                self._write_local_store(store)
                return self._get_local_plan_progress(plan_id=plan_id, user_id=user_id)

        progress.append(
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
        steps: list[LearningPlanStep],
        progress_map: dict,
    ) -> PlanProgressResponse:
        completed_steps = 0
        items: list[PlanStepProgressItem] = []
        for step in steps:
            resolved_id = step.step_id or f"day-{step.day}"
            progress = progress_map.get(resolved_id)
            status = progress.get("status") if progress else "pending"
            if status == "completed":
                completed_steps += 1
            items.append(
                PlanStepProgressItem(
                    step_id=resolved_id,
                    status=status,
                    progress_note=progress.get("progress_note") if progress else None,
                    last_action=progress.get("last_action") if progress else "pending",
                    updated_at=str(progress.get("updated_at")) if progress and progress.get("updated_at") else None,
                )
            )

        total_steps = len(steps)
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
        stage_names = ["学习诊断", "专题强化", "巩固迁移"]
        criteria = [
            ["回看核心概念", "能用自己的话讲清关键知识点"],
            ["完成一轮针对性练习", "能说清常见问题与修正方式"],
            ["完成综合练习", "输出一份总结或完整解题过程"],
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
                    objective=f"围绕 {stage_focuses[index]} 建立更稳定的理解与应用能力。",
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
        rag_titles: list[str],
        course_topics: list[str],
        stage_focuses: list[str],
        weak_focus: list[str],
        preferred_resources: list[str],
        stage_statuses: list[str],
    ) -> list[LearningPlanStep]:
        total_days = max(request.available_days, 3)
        titles = rag_titles or [
            f"{course_name}：{course_topics[0]}",
            f"{course_name}：{course_topics[1]}",
            f"{course_name}：{course_topics[2]}",
        ]
        stage_names = ["学习诊断", "专题强化", "巩固迁移"]

        steps: list[LearningPlanStep] = []
        for day in range(1, total_days + 1):
            stage_no = self._resolve_stage_no(day, total_days)
            focus = stage_focuses[stage_no - 1]
            raw_title = titles[(day - 1) % len(titles)]
            title = self._build_course_specific_step_title(
                course_name=course_name,
                focus=focus,
                raw_title=raw_title,
                stage_no=stage_no,
                day=day,
            )
            steps.append(
                LearningPlanStep(
                    step_id=f"day-{day}",
                    day=day,
                    title=title,
                    objective=self._build_course_specific_objective(course_name, focus, stage_no),
                    tasks=self._build_tasks(title, focus, request.daily_study_minutes, course_name, stage_no),
                    checkpoint=self._build_checkpoint(focus, stage_no, course_name),
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

    def _build_ai_stages(
        self,
        *,
        blueprint: dict,
        preferred_resources: list[str],
        stage_statuses: list[str],
        available_days: int,
    ) -> list[LearningPlanStage]:
        stage_count = max(len(blueprint.get("stages", [])), 1)
        default_days = max(1, available_days // stage_count)
        stages: list[LearningPlanStage] = []
        for index, stage in enumerate(blueprint.get("stages", [])[:3]):
            criteria = stage.get("completion_criteria") or [
                "完成本阶段列出的核心任务",
                "能用自己的话说明本阶段学会了什么",
            ]
            stages.append(
                LearningPlanStage(
                    stage_no=index + 1,
                    stage_name=stage.get("stage_name") or f"阶段 {index + 1}",
                    focus=stage.get("focus") or stage.get("objective") or "围绕当前重点推进",
                    objective=stage.get("objective") or stage.get("focus") or "完成当前阶段核心学习任务",
                    estimated_days=int(stage.get("estimated_days") or default_days),
                    status=stage_statuses[index] if index < len(stage_statuses) else "pending",
                    recommended_resource_types=stage.get("recommended_resource_types") or preferred_resources[:3],
                    completion_criteria=criteria[:3],
                )
            )
        return stages

    def _build_ai_steps(
        self,
        *,
        request: LearningPlanRequest,
        blueprint: dict,
        weak_focus: list[str],
        preferred_resources: list[str],
        stage_statuses: list[str],
    ) -> list[LearningPlanStep]:
        steps: list[LearningPlanStep] = []
        stage_names = {
            stage.stage_no: stage.stage_name
            for stage in self._build_ai_stages(
                blueprint=blueprint,
                preferred_resources=preferred_resources,
                stage_statuses=stage_statuses,
                available_days=request.available_days,
            )
        }
        for index, item in enumerate(blueprint.get("steps", [])[: max(request.available_days, 3)]):
            stage_no = int(item.get("stage_no") or self._resolve_stage_no(index + 1, max(request.available_days, 3)))
            tasks = [str(task).strip() for task in (item.get("tasks") or []) if str(task).strip()]
            steps.append(
                LearningPlanStep(
                    step_id=f"day-{index + 1}",
                    day=index + 1,
                    title=item.get("title") or f"第 {index + 1} 天任务",
                    objective=item.get("objective") or item.get("focus") or "完成今天的阶段学习任务",
                    tasks=tasks[:4] or ["先看核心内容，再完成一轮练习并留下复盘记录。"],
                    checkpoint=item.get("deliverable") or item.get("checkpoint") or "完成后留下可复盘的学习产出",
                    stage_no=stage_no,
                    stage_name=stage_names.get(stage_no, f"阶段 {stage_no}"),
                    node_type=item.get("node_type") or "path_node",
                    status=stage_statuses[stage_no - 1] if index == 0 and stage_no - 1 < len(stage_statuses) else "pending",
                    duration_minutes=int(item.get("duration_minutes") or request.daily_study_minutes),
                    weak_point_focus=[str(focus) for focus in (item.get("weak_point_focus") or weak_focus[:2])][:2],
                    knowledge_points=[
                        str(point)
                        for point in (item.get("knowledge_points") or [item.get("focus"), item.get("title")])
                        if point
                    ][:3],
                    recommended_resource_types=item.get("recommended_resource_types") or preferred_resources[:3],
                    resource_pushes=self._build_resource_pushes(
                        item.get("recommended_resource_types") or preferred_resources[:3],
                        item.get("focus") or item.get("title") or request.target,
                        index + 1,
                    ),
                )
            )
        return steps

    @staticmethod
    def _build_stage_focuses(
        target: str,
        weak_focus: list[str],
        course_name: str,
        course_topics: list[str],
    ) -> list[str]:
        primary_focus = weak_focus[0] if weak_focus and course_name[:4] in weak_focus[0] else course_topics[1]
        secondary_focus = weak_focus[1] if len(weak_focus) > 1 and course_name[:4] in weak_focus[1] else f"{course_topics[2]} 与迁移应用"
        return [
            f"{course_name}：先对齐目标并补齐 {course_topics[0]}",
            primary_focus,
            secondary_focus,
        ]

    @staticmethod
    def _derive_course_topics(
        course_name: str,
        course_code: str,
        course_id: int | None,
        rag_titles: list[str],
    ) -> list[str]:
        known_course_topics: dict[str, list[str]] = {
            "vue3_engineering": [
                "项目初始化",
                "状态管理组织",
                "组件复用策略",
                "接口联调与容错",
                "页面性能优化",
                "项目上线与问题排查",
            ],
            "software_engineering_4th": [
                "软件危机与软件工程概念",
                "过程模型与基本原则",
                "可行性分析与研发策划",
                "软件需求分析与总体设计",
                "详细设计与模块划分",
                "测试计划与质量保证",
                "项目管理与进度控制",
            ],
        }
        if course_code in known_course_topics:
            return known_course_topics[course_code]

        fixture_topics: list[str] = []
        for item in CourseService.COURSE_FIXTURES:
            if item.get("course_code") == course_code or (
                course_id is not None and int(item.get("id", 0) or 0) == int(course_id)
            ):
                for chapter in item.get("chapters", []):
                    chapter_name = str(chapter.get("name") or "").strip()
                    if chapter_name:
                        fixture_topics.append(chapter_name)
                    for section in chapter.get("sections", []):
                        section_name = str(section.get("name") or "").strip()
                        if section_name:
                            fixture_topics.append(section_name)
                break

        deduped: list[str] = []
        for title in [*rag_titles, *fixture_topics]:
            normalized = str(title).strip()
            if normalized and normalized not in deduped:
                deduped.append(normalized)

        if len(deduped) >= 3:
            return deduped[:3]

        cleaned = [str(title).strip() for title in rag_titles if str(title).strip()]
        defaults = [
            "核心概念回看",
            "关键专题拆解",
            "综合应用练习",
        ]
        return cleaned + defaults[len(cleaned) :]

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
    def _build_tasks(
        title: str,
        focus: str,
        daily_study_minutes: int,
        course_name: str = "",
        stage_no: int = 2,
    ) -> list[str]:
        normalized_course = str(course_name or "").strip()
        if "软件工程" in normalized_course:
            return [
                f"先用 {max(daily_study_minutes // 3, 15)} 分钟看懂“{title}”涉及的定义、背景和核心问题。",
                f"围绕 {focus} 记下 3 条笔记，至少写清概念、适用场景和容易混淆的点。",
                "尝试用自己的话复述这部分内容，并补一段阶段总结。",
            ]
        if "Vue" in normalized_course or "前端" in normalized_course:
            return [
                f"先用 {max(daily_study_minutes // 3, 15)} 分钟看懂“{title}”里的实现思路和代码结构。",
                f"围绕 {focus} 完成一轮小练习，记录状态流转、组件边界或性能处理方式。",
                "把这一步的实现要点整理成后续可以直接复用的开发笔记。",
            ]
        return [
            f"先用 {max(daily_study_minutes // 3, 15)} 分钟看懂“{title}”的核心内容。",
            f"围绕 {focus} 记下 3 条笔记，分别写清概念、易错点和应用场景。",
            "完成一组针对性练习，并记录每次出错背后的原因。",
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
                title=f"第 {day} 天推荐资源：{resource_type}",
                reason=f"这份资源与当前学习重点“{focus}”直接相关，建议优先查看。",
                status="ready",
            )
            for resource_type in resource_types
        ]

    @staticmethod
    def _build_checkpoint(focus: str, stage_no: int, course_name: str = "") -> str:
        normalized_course = str(course_name or "").strip()
        if "软件工程" in normalized_course:
            if stage_no == 1:
                return f"请讲清 {focus} 的定义、边界以及它在软件工程中的作用。"
            if stage_no == 2:
                return f"请至少说出 {focus} 相关的 2 个关键方法或常见问题，并说明如何处理。"
            return f"请围绕 {focus} 输出一份结构化总结，说明它如何衔接后续分析、设计或实现。"
        if "Vue" in normalized_course or "前端" in normalized_course:
            if stage_no == 1:
                return f"请讲清 {focus} 在当前项目中的职责，以及它为什么影响工程质量或性能。"
            if stage_no == 2:
                return f"请围绕 {focus} 交付一段可运行、可对比或可复盘的实现结果。"
            return f"请把 {focus} 整理成一份后续还能直接套用的实现方案或总结。"
        if stage_no == 1:
            return f"请讲清 {focus} 的基本定义、边界以及它解决的核心问题。"
        if stage_no == 2:
            return f"请至少识别出 {focus} 相关的 2 个常见问题，并说明如何修正。"
        return f"请围绕 {focus} 输出一份完整总结，或整理一版可复用的应用过程。"

    @staticmethod
    def _build_course_specific_step_title(
        course_name: str,
        focus: str,
        raw_title: str,
        stage_no: int,
        day: int,
    ) -> str:
        normalized_title = str(raw_title or "").strip()
        normalized_course = str(course_name or "").strip()
        normalized_focus = str(focus or "").strip() or "当前重点"

        if normalized_course and normalized_course in normalized_title:
            normalized_title = normalized_title.replace(normalized_course, "").strip("：: ")

        if "软件工程" in normalized_course:
            if stage_no == 1:
                return f"第 {day} 天：读懂 {normalized_focus} 的定义与背景"
            if stage_no == 2:
                return f"第 {day} 天：围绕 {normalized_title or normalized_focus} 拆解关键方法"
            return f"第 {day} 天：用 {normalized_focus} 输出阶段总结"

        if "Vue" in normalized_course or "前端" in normalized_course:
            if stage_no == 1:
                return f"第 {day} 天：先搭起 {normalized_focus} 的基础认知"
            if stage_no == 2:
                return f"第 {day} 天：围绕 {normalized_title or normalized_focus} 完成实操练习"
            return f"第 {day} 天：把 {normalized_focus} 整理成可复用方案"

        return normalized_title or f"第 {day} 天：推进 {normalized_focus}"

    @staticmethod
    def _build_course_specific_objective(course_name: str, focus: str, stage_no: int) -> str:
        normalized_course = str(course_name or "").strip()
        normalized_focus = str(focus or "").strip() or "当前重点"

        if "软件工程" in normalized_course:
            if stage_no == 1:
                return f"先讲清 {normalized_focus} 的基本概念、产生背景和它要解决的问题。"
            if stage_no == 2:
                return f"把 {normalized_focus} 拆成可操作的方法步骤，并说明它适合什么场景。"
            return f"围绕 {normalized_focus} 输出一份结构化总结，并说明如何迁移到后续分析设计内容。"

        if "Vue" in normalized_course or "前端" in normalized_course:
            if stage_no == 1:
                return f"先建立对 {normalized_focus} 的整体认识，知道它在项目里负责什么。"
            if stage_no == 2:
                return f"围绕 {normalized_focus} 完成一轮代码级练习，并记录关键实现选择。"
            return f"把 {normalized_focus} 整理成可复用的实现思路，方便后续项目直接套用。"

        return f"完成围绕 {normalized_focus} 的今日学习任务，并留下可回看的学习记录。"

    @staticmethod
    def _build_dynamic_adjustments(weak_focus: list[str], available_days: int) -> list[str]:
        adjustments = [
            "如果测评结果低于 70%，后续会提高薄弱点练习的比重。",
            "如果连续两轮练习都高于 85%，后续任务会适度提高难度。",
        ]
        if available_days <= 3:
            adjustments.append("当前学习周期较短，建议优先抓核心知识和错题回看。")
        if weak_focus:
            adjustments.append(f"后续资源推荐会继续围绕“{weak_focus[0]}”强化巩固。")
        return adjustments

    @staticmethod
    def _build_recommended_checkpoints(weak_focus: list[str]) -> list[str]:
        focus = weak_focus[0] if weak_focus else "当前关键知识点"
        return [
            "完成第一轮诊断后，先做一次自检。",
            f"围绕 {focus} 至少完成一次错题或薄弱点回看。",
            "在巩固阶段结束后，输出一份个人总结。",
        ]

    @staticmethod
    def _align_target_to_course(target: str, course_name: str) -> str:
        normalized_target = str(target or "").strip()
        normalized_course = str(course_name or "").strip()
        if not normalized_course:
            return normalized_target
        generic_markers = [
            "个性化学习路径",
            "学习路径",
            "生成路径",
            "用户画像",
            "结合画像",
            "生成方案",
            "学习方案",
        ]
        if not normalized_target:
            if "Vue" in normalized_course or "前端" in normalized_course:
                return "Vue 3 项目工程化落地"
            return f"{normalized_course} 学习路径"
        if any(marker in normalized_target for marker in generic_markers):
            if "Vue" in normalized_course or "前端" in normalized_course:
                return "Vue 3 项目工程化落地"
            if "软件工程" in normalized_course:
                return f"{normalized_course} 核心知识巩固"
            return f"{normalized_course} 重点能力提升"
        if normalized_course in normalized_target:
            return normalized_target
        return f"{normalized_course}：{normalized_target}"

    @staticmethod
    def _build_risk_alerts(
        available_days: int,
        daily_study_minutes: int,
        weekly_frequency: int | None,
    ) -> list[str]:
        alerts: list[str] = []
        if available_days <= 3:
            alerts.append("可用天数较少，建议优先处理高频考点和基础内容。")
        if daily_study_minutes < 30:
            alerts.append("每日学习时间较短，建议拆成概念回看和错题回看两段。")
        if weekly_frequency is not None and weekly_frequency < 2:
            alerts.append("历史学习频率偏低，建议先恢复稳定的复习节奏。")
        return alerts

    async def _generate_ai_plan_blueprint(
        self,
        *,
        request: LearningPlanRequest,
        course_name: str,
        completion_rate: float,
        weak_focus: list[str],
        preferred_resources: list[str],
        rag_titles: list[str],
        profile: dict,
        aligned_target: str,
    ) -> dict | None:
        llm = get_llm_client()
        prompt = self._build_ai_plan_prompt(
            request=request,
            course_name=course_name,
            completion_rate=completion_rate,
            weak_focus=weak_focus,
            preferred_resources=preferred_resources,
            rag_titles=rag_titles,
            profile=profile,
            aligned_target=aligned_target,
        )
        try:
            response = await llm.chat_completion(
                messages=[
                    {
                        "role": "system",
                        "content": "你是一名个性化学习路径规划助手。输出必须是可解析 JSON，不要添加解释性文字。",
                    },
                    {"role": "user", "content": prompt},
                ],
                temperature=0.4,
                max_tokens=2200,
            )
            payload = self._extract_json_payload(response.content if hasattr(response, "content") else str(response))
            return self._normalize_ai_plan_blueprint(payload, request.available_days)
        except Exception:
            return None

    @staticmethod
    def _extract_json_payload(content: str) -> dict:
        raw = (content or "").strip()
        if "```json" in raw:
            raw = raw.split("```json", 1)[1].split("```", 1)[0].strip()
        elif "```" in raw:
            raw = raw.split("```", 1)[1].split("```", 1)[0].strip()
        start = raw.find("{")
        end = raw.rfind("}")
        if start >= 0 and end >= start:
            raw = raw[start : end + 1]
        return json.loads(raw)

    def _build_ai_plan_prompt(
        self,
        *,
        request: LearningPlanRequest,
        course_name: str,
        completion_rate: float,
        weak_focus: list[str],
        preferred_resources: list[str],
        rag_titles: list[str],
        profile: dict,
        aligned_target: str,
    ) -> str:
        return f"""
请围绕以下上下文，生成一份具体、可执行、避免空话的学习路径。

课程名称：{course_name}
课程编码：{request.course_code}
学习目标：{aligned_target}
可用天数：{request.available_days}
每日学习时长：{request.daily_study_minutes} 分钟
当前完成进度：{completion_rate:.0f}%
薄弱点：{json.dumps(weak_focus[:3], ensure_ascii=False)}
偏好资源：{json.dumps(preferred_resources[:3], ensure_ascii=False)}
相关课程/资料标题：{json.dumps(rag_titles[:6], ensure_ascii=False)}
用户画像摘要：{json.dumps(profile, ensure_ascii=False)}

要求：
1. 一共输出 3 个阶段，名称要像真实产品里的学习阶段，不要空泛。
2. 每个阶段都要说清楚“为什么学这一段”“这一段完成后得到什么”。
3. 输出不少于 {max(request.available_days, 3)} 条按天步骤，每条步骤必须具体到要学什么、做什么、产出什么。
4. 不要写“了解一下”“学习相关内容”这类空话，要直接写具体主题、动作和成果。
5. 如果用户当前进度较低，前几天先补基础和诊断；如果进度较高，后几天要强调迁移应用和复盘。
6. 语言全部使用简体中文。

严格返回下面这个 JSON：
{{
  "stages": [
    {{
      "stage_name": "阶段名",
      "focus": "这一阶段的核心重点",
      "objective": "这一阶段完成后应获得什么",
      "estimated_days": 2,
      "completion_criteria": ["标准1", "标准2"],
      "recommended_resource_types": ["video", "practice_set"]
    }}
  ],
  "steps": [
    {{
      "day": 1,
      "stage_no": 1,
      "title": "当天任务标题",
      "focus": "当天重点学什么",
      "objective": "当天为什么学这一项",
      "tasks": ["动作1", "动作2", "动作3"],
      "deliverable": "当天结束后要留下的结果",
      "duration_minutes": {request.daily_study_minutes},
      "recommended_resource_types": ["video", "mind_map"],
      "knowledge_points": ["知识点1", "知识点2"],
      "weak_point_focus": ["薄弱点1"]
    }}
  ]
}}
""".strip()

    @staticmethod
    def _normalize_ai_plan_blueprint(payload: dict, available_days: int) -> dict | None:
        if not isinstance(payload, dict):
            return None
        stages = payload.get("stages")
        steps = payload.get("steps")
        if not isinstance(stages, list) or not isinstance(steps, list):
            return None

        cleaned_stages = []
        for item in stages[:3]:
            if not isinstance(item, dict):
                continue
            cleaned_stages.append(
                {
                    "stage_name": str(item.get("stage_name") or "").strip(),
                    "focus": str(item.get("focus") or "").strip(),
                    "objective": str(item.get("objective") or "").strip(),
                    "estimated_days": int(item.get("estimated_days") or 1),
                    "completion_criteria": item.get("completion_criteria") or [],
                    "recommended_resource_types": item.get("recommended_resource_types") or [],
                }
            )

        cleaned_steps = []
        for index, item in enumerate(steps[: max(available_days, 3)]):
            if not isinstance(item, dict):
                continue
            cleaned_steps.append(
                {
                    "day": int(item.get("day") or index + 1),
                    "stage_no": int(item.get("stage_no") or 1),
                    "title": str(item.get("title") or "").strip(),
                    "focus": str(item.get("focus") or "").strip(),
                    "objective": str(item.get("objective") or "").strip(),
                    "tasks": item.get("tasks") or [],
                    "deliverable": str(item.get("deliverable") or "").strip(),
                    "duration_minutes": int(item.get("duration_minutes") or 45),
                    "recommended_resource_types": item.get("recommended_resource_types") or [],
                    "knowledge_points": item.get("knowledge_points") or [],
                    "weak_point_focus": item.get("weak_point_focus") or [],
                    "node_type": "path_node",
                }
            )

        if len(cleaned_stages) < 3 or len(cleaned_steps) < max(available_days, 3):
            return None
        return {"stages": cleaned_stages, "steps": cleaned_steps}
