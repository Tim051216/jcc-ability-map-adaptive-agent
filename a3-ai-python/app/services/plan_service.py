from datetime import datetime, timezone

import httpx

from app.db.repositories.plan_repository import PlanRepository
from app.db.session import async_session_factory
from app.integrations.java_clients.course_client import CourseClient
from app.integrations.java_clients.learning_client import LearningClient
from app.schemas.plan import (
    LearningPlanRequest,
    LearningPlanResponse,
    LearningPlanStage,
    LearningPlanStep,
    PlanResourcePush,
)
from app.schemas.rag import RagSearchRequest
from app.services.rag_service import RagService


class PlanService:
    async def get_latest_plan(self, user_id: int, course_code: str) -> LearningPlanResponse | None:
        async with async_session_factory() as session:
            repo = PlanRepository()
            latest = await repo.latest_by_user_course(session, user_id, course_code)
            if latest is None or not latest.plan_data:
                return None
            return LearningPlanResponse.model_validate(latest.plan_data)

    async def generate_plan(self, request: LearningPlanRequest) -> LearningPlanResponse:
        try:
            course = await CourseClient().get_course_detail(int(request.course_code))
        except (ValueError, httpx.HTTPError):
            course = None

        try:
            learning_record = await LearningClient().get_learning_record_by_course(int(request.course_code))
        except (ValueError, httpx.HTTPError):
            learning_record = None

        course_name = course.name if course and course.name else request.course_code
        completion_rate = float(getattr(learning_record, "process_percent", 0) or 0)
        progress_hint = (
            f"当前课程历史学习进度约 {completion_rate:.0f}%"
            if completion_rate
            else "当前暂无稳定学习进度记录，先按首轮诊断路径推进"
        )
        weekly_frequency = getattr(learning_record, "week_freq", None)

        rag = await RagService().search(
            RagSearchRequest(
                course_code=request.course_code,
                query=request.target,
                top_k=min(max(request.available_days, 3), 6),
            )
        )

        profile = request.profile or {}
        dimensions = profile.get("dimensions", {})
        weak_focus = dimensions.get("weak_point_preference", {}).get("evidence", []) or [request.target]
        preferred_resources = profile.get("recommended_resource_types") or ["lecture_note", "mind_map", "quiz_set"]
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
            course_code=request.course_code,
            course_name=course_name,
            summary=f"围绕“{request.target}”生成的阶梯式学习路径，覆盖诊断、攻坚、巩固三个阶段。",
            progress_hint=progress_hint,
            next_action=f"先执行第 1 天节点任务，并在完成后提交一次针对“{request.target}”的阶段自评。",
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

        await self._persist_plan(request, response)
        return response

    async def _persist_plan(self, request: LearningPlanRequest, response: LearningPlanResponse) -> None:
        now = datetime.now(timezone.utc).isoformat()
        async with async_session_factory() as session:
            repo = PlanRepository()
            await repo.create_plan(
                session,
                user_id=request.user_id,
                course_code=request.course_code,
                status="generated",
                summary=response.summary,
                plan_data=response.model_dump(mode="json"),
                created_at=now,
                updated_at=now,
            )
            await session.commit()

    def _build_stages(
        self,
        stage_focuses: list[str],
        preferred_resources: list[str],
        stage_statuses: list[str],
        available_days: int,
    ) -> list[LearningPlanStage]:
        stage_names = ["基础诊断", "薄弱点攻坚", "综合巩固"]
        criteria = [
            ["完成知识点摸底", "能复述核心概念"],
            ["完成 1 轮弱项训练", "能解释常见错误原因"],
            ["完成综合练习", "能输出自己的总结或解题过程"],
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
                    objective=f"围绕{stage_focuses[index]}建立阶段性掌握与输出能力",
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
            f"{request.course_code} 核心概念梳理",
            f"{request.course_code} 典型错因分析",
            f"{request.course_code} 综合应用训练",
        ]
        stage_names = ["基础诊断", "薄弱点攻坚", "综合巩固"]

        steps: list[LearningPlanStep] = []
        for day in range(1, total_days + 1):
            stage_no = self._resolve_stage_no(day, total_days)
            stage_name = stage_names[stage_no - 1]
            focus = stage_focuses[stage_no - 1]
            title = titles[(day - 1) % len(titles)]
            tasks = self._build_tasks(title, focus, request.daily_study_minutes)
            resource_pushes = self._build_resource_pushes(preferred_resources[:3], focus, day)
            steps.append(
                LearningPlanStep(
                    day=day,
                    title=title,
                    objective=f"围绕{focus}完成当天节点任务，并沉淀可复用学习结论",
                    tasks=tasks,
                    checkpoint=self._build_checkpoint(focus, stage_no),
                    stage_no=stage_no,
                    stage_name=stage_name,
                    node_type="path_node",
                    status=stage_statuses[stage_no - 1] if day == 1 else "pending",
                    duration_minutes=request.daily_study_minutes,
                    weak_point_focus=weak_focus[:2],
                    knowledge_points=[focus, title],
                    recommended_resource_types=preferred_resources[:3],
                    resource_pushes=resource_pushes,
                )
            )
        return steps

    @staticmethod
    def _build_stage_focuses(target: str, weak_focus: list[str]) -> list[str]:
        primary_focus = weak_focus[0] if weak_focus else target
        secondary_focus = weak_focus[1] if len(weak_focus) > 1 else f"{target} 典型错因"
        return [f"{target} 基础诊断", primary_focus, secondary_focus]

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
            f"阅读并理解《{title}》中的核心概念，控制在 {max(daily_study_minutes // 3, 15)} 分钟内完成首轮吸收。",
            f"围绕“{focus}”整理 3 条自己的学习笔记，记录定义、易错点与应用场景。",
            f"完成 1 组分层练习并标记错误原因，作为后续评估与路径调整依据。",
        ]

    @staticmethod
    def _build_resource_pushes(
        resource_types: list[str],
        focus: str,
        day: int,
    ) -> list[PlanResourcePush]:
        title_mapping = {
            "lecture_note": "课程讲解文档",
            "mind_map": "知识点思维导图",
            "quiz_set": "分层练习题库",
            "extended_reading": "扩展阅读清单",
            "coding_lab": "代码实操案例",
        }
        return [
            PlanResourcePush(
                resource_type=resource_type,
                title=f"第 {day} 天推送 - {title_mapping.get(resource_type, resource_type)}",
                reason=f"当前节点聚焦“{focus}”，优先推送与该主题匹配的学习资源。",
                status="ready",
            )
            for resource_type in resource_types
        ]

    @staticmethod
    def _build_checkpoint(focus: str, stage_no: int) -> str:
        if stage_no == 1:
            return f"能够用自己的话解释“{focus}”的基础定义与边界。"
        if stage_no == 2:
            return f"能够指出“{focus}”至少 2 个典型错因，并说明修正思路。"
        return f"能够基于“{focus}”输出完整解题过程或总结。"

    @staticmethod
    def _build_dynamic_adjustments(weak_focus: list[str], available_days: int) -> list[str]:
        adjustments = [
            "若阶段测评低于 70 分，自动提高薄弱知识点练习占比，并延后综合训练节点。",
            "若连续两次练习正确率高于 85%，则提升后续节点难度并加入综合应用任务。",
        ]
        if available_days <= 3:
            adjustments.append("当前周期较短，建议压缩扩展阅读，优先保证核心知识点与错题复盘。")
        if weak_focus:
            adjustments.append(f"后续资源推送将持续围绕“{weak_focus[0]}”进行强化。")
        return adjustments

    @staticmethod
    def _build_recommended_checkpoints(weak_focus: list[str]) -> list[str]:
        focus = weak_focus[0] if weak_focus else "当前重点知识点"
        return [
            "完成首轮概念诊断后，提交一次自评结果。",
            f"围绕“{focus}”完成至少 1 次错题归因。",
            "综合巩固结束后，输出一份个人学习总结或思维导图。",
        ]

    @staticmethod
    def _build_risk_alerts(
        available_days: int,
        daily_study_minutes: int,
        weekly_frequency: int | None,
    ) -> list[str]:
        alerts: list[str] = []
        if available_days <= 3:
            alerts.append("可用天数较少，建议优先完成高频考点与基础题。")
        if daily_study_minutes < 30:
            alerts.append("单日学习时长偏短，建议拆分为概念学习与练习复盘两个小阶段。")
        if weekly_frequency is not None and weekly_frequency < 2:
            alerts.append("历史学习频次偏低，建议先建立固定复习节奏，再逐步增加任务量。")
        return alerts
