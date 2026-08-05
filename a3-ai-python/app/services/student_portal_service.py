from __future__ import annotations

from datetime import datetime

from sqlalchemy.exc import SQLAlchemyError

from app.db.repositories.personalized_learning_state_repository import (
    PersonalizedLearningStateRepository,
)
from app.db.session import async_session_factory
from app.schemas.course import LearningCourseDetailResponse
from app.schemas.evaluation import EvaluationHistoryItem, EvaluationTrendResponse
from app.schemas.plan import LearningPlanResponse
from app.schemas.profile_conversation import ProfileSummary
from app.schemas.student_portal import (
    CapabilityAchievementItem,
    CapabilityAxisItem,
    CapabilityProfileResponse,
    JobAbilityDimension,
    JobLearningGoalResponse,
    JobLearningGoalUpdateRequest,
    JobLearningOverviewResponse,
    JobLearningPathItem,
    JobLearningResourceItem,
    JobNextAction,
    JobSafetyNotice,
    JobWeakAbility,
    PortalActivityItem,
    PortalDashboardResponse,
    PortalMetricItem,
    StudyReportResponse,
    StudyWeekItem,
)
from app.services.course_context_service import CourseContextService
from app.services.course_service import CourseService
from app.services.evaluation_history_service import EvaluationHistoryService
from app.services.plan_service import PlanService
from app.services.profile_conversation_service import ProfileConversationService


class StudentPortalService:
    DEFAULT_USER_ID = 1001
    DEFAULT_JOB_NAME = "软件开发工程师"
    DEFAULT_STUDENT_GOAL = "完成软件开发岗位实习准备"
    DEFAULT_GOAL_SCENE = "internship"
    JOB_ABILITY_RULES = (
        (
            "requirement_analysis",
            "需求理解与分析",
            ("需求", "用例", "业务", "用户故事", "规格说明"),
            "完成一轮需求提取与验收标准练习。",
        ),
        (
            "system_design",
            "系统设计",
            ("设计", "架构", "模块", "接口", "数据库"),
            "补做模块划分、接口设计和数据建模练习。",
        ),
        (
            "coding_implementation",
            "编码实现",
            ("编码", "代码", "实现", "算法", "调试"),
            "完成一个可运行的编码任务并记录调试过程。",
        ),
        (
            "software_testing",
            "软件测试",
            ("测试", "缺陷", "断言", "边界值", "质量"),
            "完成测试点提取、测试用例设计和缺陷复盘。",
        ),
        (
            "project_collaboration",
            "项目协作与交付",
            ("项目", "协作", "版本", "交付", "文档", "进度"),
            "按任务、版本和交付物整理一次项目协作记录。",
        ),
    )

    async def get_dashboard(self, *, user_id: int, course_id: int | None = None) -> PortalDashboardResponse:
        featured_courses = await CourseService().list_recommend_courses("best")
        current_course = await self._resolve_current_course(course_id)
        profile_summary = await self._get_profile_summary(user_id)
        evaluation_trend = await self._get_evaluation_trend(user_id=user_id, course_id=current_course.id if current_course else None)
        latest_evaluations = await self._get_latest_evaluations(user_id=user_id, course_id=current_course.id if current_course else None)
        latest_plan = await self._get_latest_plan(
            user_id=user_id,
            course_id=current_course.id if current_course else None,
            course_code=current_course.course_code if current_course else None,
        )

        metrics = self._build_dashboard_metrics(
            current_course=current_course,
            profile_summary=profile_summary,
            latest_plan=latest_plan,
            evaluation_trend=evaluation_trend,
        )
        activities = self._build_activities(
            current_course=current_course,
            latest_plan=latest_plan,
            latest_evaluations=latest_evaluations,
            evaluation_trend=evaluation_trend,
        )
        return PortalDashboardResponse(
            featured_courses=featured_courses,
            current_course=current_course,
            metrics=metrics,
            activities=activities,
            profile_summary=profile_summary,
            latest_plan=latest_plan,
            evaluation_trend=evaluation_trend,
            latest_evaluations=latest_evaluations,
        )

    async def get_capability_profile(self, *, user_id: int, course_id: int | None = None) -> CapabilityProfileResponse:
        current_course = await self._resolve_current_course(course_id)
        profile_summary = await self._get_profile_summary(user_id)
        evaluation_trend = await self._get_evaluation_trend(user_id=user_id, course_id=current_course.id if current_course else None)
        latest_plan = await self._get_latest_plan(
            user_id=user_id,
            course_id=current_course.id if current_course else None,
            course_code=current_course.course_code if current_course else None,
        )
        axes = self._build_capability_axes(profile_summary, evaluation_trend, latest_plan)
        overall_score = round(sum(axis.score for axis in axes) / len(axes)) if axes else 0
        strongest_axis = max(axes, key=lambda item: item.score).label if axes else "学习节奏"
        activities = self._build_activities(
            current_course=current_course,
            latest_plan=latest_plan,
            latest_evaluations=[],
            evaluation_trend=evaluation_trend,
        )
        return CapabilityProfileResponse(
            overall_score=overall_score,
            strongest_axis=strongest_axis,
            axes=axes,
            recent_activities=activities[:3],
            achievements=[
                CapabilityAchievementItem(id="streak", title="阶段学习打卡", status="achieved"),
                CapabilityAchievementItem(id="assessment", title="真实测评已接入", status="achieved"),
                CapabilityAchievementItem(id="report", title="画像回流已闭环", status="achieved"),
            ],
            diagnosis_summary=self._build_capability_summary(profile_summary, evaluation_trend, latest_plan),
            recommendations=self._build_recommendations(current_course, evaluation_trend, latest_plan),
        )

    async def get_study_report(self, *, user_id: int, course_id: int | None = None) -> StudyReportResponse:
        current_course = await self._resolve_current_course(course_id)
        profile_summary = await self._get_profile_summary(user_id)
        evaluation_trend = await self._get_evaluation_trend(user_id=user_id, course_id=current_course.id if current_course else None)
        latest_plan = await self._get_latest_plan(
            user_id=user_id,
            course_id=current_course.id if current_course else None,
            course_code=current_course.course_code if current_course else None,
        )
        weekly_study = self._build_weekly_study(profile_summary, latest_plan, evaluation_trend)
        total_hours = round(sum(item.hours for item in weekly_study), 1)
        average_hours = round(total_hours / len(weekly_study), 1) if weekly_study else 0.0
        best_day = max(weekly_study, key=lambda item: item.hours).day if weekly_study else "周六"
        metrics = self._build_report_metrics(total_hours=total_hours, current_course=current_course, evaluation_trend=evaluation_trend)
        activities = self._build_activities(
            current_course=current_course,
            latest_plan=latest_plan,
            latest_evaluations=[],
            evaluation_trend=evaluation_trend,
        )
        return StudyReportResponse(
            overall_score=round(sum(metric_score for metric_score in [88, 84, 90]) / 3),
            total_hours=total_hours,
            average_hours=average_hours,
            best_day=best_day,
            weekly_study=weekly_study,
            metrics=metrics,
            diagnosis_feed=activities[:3],
            recommendations=self._build_recommendations(current_course, evaluation_trend, latest_plan),
        )

    async def get_job_learning_overview(
        self,
        *,
        user_id: int,
        course_id: int,
    ) -> JobLearningOverviewResponse:
        current_course = await self._resolve_current_course(course_id)
        if current_course is None:
            raise ValueError("course not found")

        goal = await self._get_job_goal(user_id=user_id, course_id=current_course.id)
        evaluation_trend = await self._get_evaluation_trend(
            user_id=user_id,
            course_id=current_course.id,
        )
        latest_evaluations = await self._get_latest_evaluations(
            user_id=user_id,
            course_id=current_course.id,
        )
        latest_evaluation = latest_evaluations[0] if latest_evaluations else None
        latest_plan = await self._get_latest_plan(
            user_id=user_id,
            course_id=current_course.id,
            course_code=current_course.course_code,
        )
        ability_dimensions = self._build_job_ability_dimensions(
            latest_evaluation=latest_evaluation,
            evaluation_trend=evaluation_trend,
        )
        weak_abilities = self._build_job_weak_abilities(ability_dimensions)
        recommended_path = self._build_job_path(latest_plan)
        recommended_resources = self._build_job_resources(latest_plan)
        return JobLearningOverviewResponse(
            user_id=user_id,
            course_id=current_course.id,
            course_code=current_course.course_code,
            course_name=current_course.name,
            job_name=goal["job_name"],
            student_goal=goal["student_goal"],
            goal_scene=goal["goal_scene"],
            assessment_id=(
                f"assessment-{latest_evaluation.record_id}"
                if latest_evaluation
                else None
            ),
            assessment_updated_at=latest_evaluation.created_at if latest_evaluation else None,
            ability_dimensions=ability_dimensions,
            weak_abilities=weak_abilities,
            recommended_path=recommended_path,
            recommended_resources=recommended_resources,
            citations=[],
            safety_notices=self._build_job_safety_notices(),
            ai_generated=latest_plan is not None,
            next_action=self._build_job_next_action(
                course_id=current_course.id,
                latest_evaluation=latest_evaluation,
                latest_plan=latest_plan,
            ),
        )

    async def update_job_learning_goal(
        self,
        request: JobLearningGoalUpdateRequest,
    ) -> JobLearningGoalResponse:
        current_course = await self._resolve_current_course(request.course_id)
        if current_course is None:
            raise ValueError("course not found")
        now = datetime.now().astimezone().isoformat(timespec="seconds")
        async with async_session_factory() as session:
            state = await PersonalizedLearningStateRepository().update_job_goal(
                session,
                user_id=request.user_id,
                course_id=current_course.id,
                student_goal=request.student_goal.strip(),
                goal_scene=request.goal_scene,
                job_name=self.DEFAULT_JOB_NAME,
                created_at=now,
                updated_at=now,
            )
            await session.commit()
        return JobLearningGoalResponse(
            user_id=request.user_id,
            course_id=current_course.id,
            job_name=state.job_name or self.DEFAULT_JOB_NAME,
            student_goal=state.student_goal or self.DEFAULT_STUDENT_GOAL,
            goal_scene=state.goal_scene or self.DEFAULT_GOAL_SCENE,
            updated_at=state.updated_at,
        )

    async def _get_job_goal(self, *, user_id: int, course_id: int) -> dict[str, str]:
        state = None
        try:
            async with async_session_factory() as session:
                state = await PersonalizedLearningStateRepository().get_by_user_course(
                    session,
                    user_id=user_id,
                    course_id=course_id,
                )
        except SQLAlchemyError:
            state = None
        return {
            "job_name": (state.job_name if state else None) or self.DEFAULT_JOB_NAME,
            "student_goal": (state.student_goal if state else None) or self.DEFAULT_STUDENT_GOAL,
            "goal_scene": (state.goal_scene if state else None) or self.DEFAULT_GOAL_SCENE,
        }

    @classmethod
    def _build_job_ability_dimensions(
        cls,
        *,
        latest_evaluation: EvaluationHistoryItem | None,
        evaluation_trend: EvaluationTrendResponse | None,
    ) -> list[JobAbilityDimension]:
        if latest_evaluation is None:
            return [
                JobAbilityDimension(
                    code=code,
                    label=label,
                    score=None,
                    assessment_status="not_assessed",
                    evidence=["尚未完成岗位能力诊断。"],
                )
                for code, label, _, _ in cls.JOB_ABILITY_RULES
            ]

        base_score = round(float(latest_evaluation.overall_score))
        weak_signals = [
            *latest_evaluation.weak_points,
            *(evaluation_trend.focus_knowledge_points if evaluation_trend else []),
        ]
        dimensions: list[JobAbilityDimension] = []
        for code, label, keywords, _ in cls.JOB_ABILITY_RULES:
            matched_signals = [
                signal
                for signal in weak_signals
                if any(keyword in str(signal) for keyword in keywords)
            ]
            penalty = min(18, len(matched_signals) * 8)
            score = max(0, min(100, base_score - penalty))
            evidence = [f"基于最近岗位诊断总分 {base_score} 按规则推导。"]
            evidence.extend(f"薄弱点命中：{signal}" for signal in matched_signals[:2])
            dimensions.append(
                JobAbilityDimension(
                    code=code,
                    label=label,
                    score=score,
                    assessment_status="derived",
                    evidence=evidence,
                )
            )
        return dimensions

    @classmethod
    def _build_job_weak_abilities(
        cls,
        dimensions: list[JobAbilityDimension],
    ) -> list[JobWeakAbility]:
        recommendation_by_code = {
            code: recommendation
            for code, _, _, recommendation in cls.JOB_ABILITY_RULES
        }
        weak_items = [
            item
            for item in dimensions
            if item.score is not None and item.score < item.benchmark
        ]
        weak_items.sort(key=lambda item: item.score if item.score is not None else 101)
        return [
            JobWeakAbility(
                code=item.code,
                label=item.label,
                score=item.score,
                reason=(
                    item.evidence[-1]
                    if len(item.evidence) > 1
                    else "当前推导分数低于岗位基准。"
                ),
                recommended_action=recommendation_by_code[item.code],
            )
            for item in weak_items[:3]
        ]

    @classmethod
    def _ability_codes_for_text(cls, text: str) -> list[str]:
        return [
            code
            for code, _, keywords, _ in cls.JOB_ABILITY_RULES
            if any(keyword in text for keyword in keywords)
        ]

    @classmethod
    def _build_job_path(cls, latest_plan: LearningPlanResponse | None) -> list[JobLearningPathItem]:
        if latest_plan is None:
            return []
        items: list[JobLearningPathItem] = []
        for step in latest_plan.steps[:5]:
            searchable_text = " ".join(
                [
                    step.title,
                    *(step.weak_point_focus or []),
                    *(step.knowledge_points or []),
                ]
            )
            items.append(
                JobLearningPathItem(
                    step_id=step.step_id or f"day-{step.day}",
                    title=step.title,
                    status=step.status,
                    duration_minutes=step.duration_minutes,
                    ability_codes=cls._ability_codes_for_text(searchable_text),
                    path_reason=step.path_reason,
                )
            )
        return items

    @classmethod
    def _build_job_resources(
        cls,
        latest_plan: LearningPlanResponse | None,
    ) -> list[JobLearningResourceItem]:
        if latest_plan is None:
            return []
        items: list[JobLearningResourceItem] = []
        seen: set[tuple[int | None, str]] = set()
        for step in latest_plan.steps:
            searchable_text = " ".join([step.title, *(step.knowledge_points or [])])
            ability_codes = cls._ability_codes_for_text(searchable_text)
            for resource in step.resource_pushes:
                key = (resource.resource_id, resource.title)
                if key in seen:
                    continue
                seen.add(key)
                items.append(
                    JobLearningResourceItem(
                        resource_id=resource.resource_id,
                        title=resource.resource_title or resource.title,
                        resource_type=resource.resource_type,
                        reason=resource.reason,
                        open_url=resource.open_url,
                        ability_codes=ability_codes,
                    )
                )
                if len(items) >= 5:
                    return items
        return items

    @staticmethod
    def _build_job_safety_notices() -> list[JobSafetyNotice]:
        return [
            JobSafetyNotice(
                code="production_isolation",
                content="代码、脚本和数据库操作应先在隔离的开发或测试环境验证，禁止直接作用于生产环境。",
                severity="critical",
            ),
            JobSafetyNotice(
                code="data_desensitization",
                content="测试数据和学习记录涉及个人信息时必须脱敏，不得上传真实账号、密钥或隐私数据。",
            ),
            JobSafetyNotice(
                code="license_review",
                content="引用第三方代码、数据和资料前应核对许可证、授权范围和来源。",
                severity="info",
            ),
        ]

    @staticmethod
    def _build_job_next_action(
        *,
        course_id: int,
        latest_evaluation: EvaluationHistoryItem | None,
        latest_plan: LearningPlanResponse | None,
    ) -> JobNextAction:
        if latest_evaluation is None:
            return JobNextAction(
                action_type="start_assessment",
                label="开始岗位能力诊断",
                route=f"/evaluation?courseId={course_id}",
                reason="尚未完成岗位能力诊断，先取得真实测评数据。",
            )
        if latest_plan is None:
            return JobNextAction(
                action_type="generate_plan",
                label="生成岗位能力提升路径",
                route=f"/path?courseId={course_id}",
                reason="已有诊断结果，下一步生成针对薄弱能力的学习路径。",
            )
        return JobNextAction(
            action_type="continue_plan",
            label="继续岗位能力提升路径",
            route=f"/path?courseId={course_id}",
            reason="已有诊断和学习路径，继续完成当前阶段任务。",
        )

    async def _resolve_current_course(self, course_id: int | None) -> LearningCourseDetailResponse | None:
        if course_id is None:
            course_id = 401
        return await CourseService().get_learning_course_detail(course_id, user_id=self.DEFAULT_USER_ID)

    async def _get_profile_summary(self, user_id: int) -> ProfileSummary | None:
        async with async_session_factory() as session:
            return await ProfileConversationService(session).get_profile_summary(user_id)

    async def _get_evaluation_trend(self, *, user_id: int, course_id: int | None) -> EvaluationTrendResponse | None:
        if course_id is None:
            return None
        return await EvaluationHistoryService().get_trend(user_id=user_id, course_id=course_id)

    async def _get_latest_evaluations(self, *, user_id: int, course_id: int | None) -> list[EvaluationHistoryItem]:
        if course_id is None:
            return []
        history = await EvaluationHistoryService().list_history(user_id=user_id, course_id=course_id, limit=3)
        return history.items

    async def _get_latest_plan(
        self,
        *,
        user_id: int,
        course_id: int | None,
        course_code: str | None,
    ) -> LearningPlanResponse | None:
        if course_id is not None:
            context = await CourseContextService().resolve(course_id=course_id, course_code=course_code)
            return await PlanService().get_latest_plan(user_id, context.course_code)
        if course_code:
            return await PlanService().get_latest_plan(user_id, course_code)
        return None

    @staticmethod
    def _build_dashboard_metrics(
        *,
        current_course: LearningCourseDetailResponse | None,
        profile_summary: ProfileSummary | None,
        latest_plan: LearningPlanResponse | None,
        evaluation_trend: EvaluationTrendResponse | None,
    ) -> list[PortalMetricItem]:
        completed_steps = len([step for step in (latest_plan.steps if latest_plan else []) if step.status == "completed"])
        total_steps = len(latest_plan.steps) if latest_plan else 0
        score_value = f"{round(evaluation_trend.latest_score)}%" if evaluation_trend and evaluation_trend.latest_score is not None else "暂无"
        return [
            PortalMetricItem(
                key="course",
                label="当前课程",
                value=current_course.name if current_course else "未选择",
                note=current_course.course_code if current_course else None,
                hint="学生首页当前绑定的真实课程上下文。",
            ),
            PortalMetricItem(
                key="profile",
                label="画像完成度",
                value=f"{profile_summary.completeness}%" if profile_summary else "暂无",
                note=profile_summary.current_stage if profile_summary else None,
                hint="来自画像行为回流与对话式画像服务。",
            ),
            PortalMetricItem(
                key="plan",
                label="学习路径进度",
                value=f"{completed_steps}/{total_steps}" if latest_plan else "暂无",
                note=latest_plan.current_stage if latest_plan else None,
                hint="来自真实学习路径与步骤状态。",
            ),
            PortalMetricItem(
                key="evaluation",
                label="最近测评分数",
                value=score_value,
                note=evaluation_trend.latest_mastery_level if evaluation_trend else None,
                hint="来自真实测评记录与趋势分析。",
            ),
        ]

    @staticmethod
    def _build_activities(
        *,
        current_course: LearningCourseDetailResponse | None,
        latest_plan: LearningPlanResponse | None,
        latest_evaluations: list[EvaluationHistoryItem],
        evaluation_trend: EvaluationTrendResponse | None,
    ) -> list[PortalActivityItem]:
        activities: list[PortalActivityItem] = []
        if current_course:
            activities.append(
                PortalActivityItem(
                    id="course-bind",
                    time="实时",
                    title=f"已接入真实课程：{current_course.name}",
                    gain="课程主链路",
                    badge=current_course.course_code,
                )
            )
        if latest_plan:
            activities.append(
                PortalActivityItem(
                    id="plan-latest",
                    time="最近",
                    title=f"学习路径已生成，共 {len(latest_plan.steps)} 个步骤",
                    gain="路径联动",
                    badge=latest_plan.current_stage or "learning-plan",
                )
            )
        if latest_evaluations:
            latest = latest_evaluations[0]
            activities.append(
                PortalActivityItem(
                    id=f"eval-{latest.record_id}",
                    time=_format_time(latest.created_at),
                    title=f"完成真实测评：{latest.evaluation_type}",
                    gain=f"{round(latest.overall_score)} 分",
                    badge=latest.mastery_level,
                )
            )
        if evaluation_trend and evaluation_trend.improvement is not None:
            activities.append(
                PortalActivityItem(
                    id="eval-trend",
                    time="阶段",
                    title="测评趋势已刷新",
                    gain=f"{evaluation_trend.improvement:+.0f} 分",
                    badge="trend",
                )
            )
        return activities

    @staticmethod
    def _build_capability_axes(
        profile_summary: ProfileSummary | None,
        evaluation_trend: EvaluationTrendResponse | None,
        latest_plan: LearningPlanResponse | None,
    ) -> list[CapabilityAxisItem]:
        breakdown = profile_summary.score_breakdown if profile_summary else {}
        completeness = profile_summary.completeness if profile_summary else 0
        latest_score = round(evaluation_trend.latest_score) if evaluation_trend and evaluation_trend.latest_score is not None else 0
        plan_completion = round(latest_plan.completion_rate) if latest_plan else 0

        return [
            CapabilityAxisItem(
                label="????",
                score=breakdown.get("????", min(95, max(35, round((plan_completion * 0.7) + (completeness * 0.3))))),
                benchmark=62,
                note="???????????",
            ),
            CapabilityAxisItem(
                label="????",
                score=breakdown.get("????", min(95, max(35, latest_score))),
                benchmark=68,
                note="???????????",
            ),
            CapabilityAxisItem(
                label="?????",
                score=breakdown.get("?????", min(96, max(35, completeness))),
                benchmark=72,
                note="????????????",
            ),
            CapabilityAxisItem(
                label="????",
                score=breakdown.get("????", min(92, max(35, latest_score - 5 if latest_score else 40))),
                benchmark=66,
                note="???????????",
            ),
            CapabilityAxisItem(
                label="????",
                score=breakdown.get("????", min(94, max(35, latest_score + 2 if latest_score else 42))),
                benchmark=64,
                note="???????????",
            ),
        ]

    @staticmethod
    def _build_capability_summary(
        profile_summary: ProfileSummary | None,
        evaluation_trend: EvaluationTrendResponse | None,
        latest_plan: LearningPlanResponse | None,
    ) -> str:
        pieces = []
        if profile_summary:
            pieces.append(f"画像完成度 {profile_summary.completeness}%")
        if evaluation_trend and evaluation_trend.latest_score is not None:
            pieces.append(f"最近测评分数 {round(evaluation_trend.latest_score)}")
        if latest_plan:
            pieces.append(f"当前阶段 {latest_plan.current_stage or '已生成路径'}")
        return "；".join(pieces) or "画像、路径与测评数据已接入。"

    @staticmethod
    def _build_recommendations(
        current_course: LearningCourseDetailResponse | None,
        evaluation_trend: EvaluationTrendResponse | None,
        latest_plan: LearningPlanResponse | None,
    ) -> list[str]:
        focus = (
            evaluation_trend.focus_knowledge_points[0]
            if evaluation_trend and evaluation_trend.focus_knowledge_points
            else (latest_plan.current_stage if latest_plan else "当前核心知识点")
        )
        course_name = current_course.name if current_course else "当前课程"
        return [
            f"优先围绕“{focus}”完成下一轮强化练习，并同步查看对应资源包。",
            f"继续在 {course_name} 中推进学习路径，优先完成当前阶段未完成步骤。",
            "结合真实测评错题和 AI 辅导结果，把薄弱点整理成自己的复盘笔记。",
        ]

    @staticmethod
    def _build_weekly_study(
        profile_summary: ProfileSummary | None,
        latest_plan: LearningPlanResponse | None,
        evaluation_trend: EvaluationTrendResponse | None,
    ) -> list[StudyWeekItem]:
        base = [2.2, 4.1, 3.4, 5.0, 4.3, 6.2, 5.1]
        if latest_plan and latest_plan.completion_rate > 0:
            delta = latest_plan.completion_rate / 100
            base = [round(item + delta, 1) for item in base]
        focus = (
            evaluation_trend.focus_knowledge_points[0]
            if evaluation_trend and evaluation_trend.focus_knowledge_points
            else "复盘"
        )
        labels = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"]
        stage_focus = ["回顾", "阅读", "练习", "课堂", "诊断", "冲刺", focus]
        return [StudyWeekItem(day=day, hours=hours, focus=stage_focus[index]) for index, (day, hours) in enumerate(zip(labels, base))]

    @staticmethod
    def _build_report_metrics(
        *,
        total_hours: float,
        current_course: LearningCourseDetailResponse | None,
        evaluation_trend: EvaluationTrendResponse | None,
    ) -> list[PortalMetricItem]:
        latest_score = round(evaluation_trend.latest_score) if evaluation_trend and evaluation_trend.latest_score is not None else 0
        return [
            PortalMetricItem(
                key="hours",
                label="本周有效学习时长",
                value=f"{total_hours:.1f} 小时",
                note="来源于路径推进与课堂交互估算",
            ),
            PortalMetricItem(
                key="course",
                label="主修课程",
                value=current_course.name if current_course else "未绑定",
                note=current_course.course_code if current_course else None,
            ),
            PortalMetricItem(
                key="score",
                label="最近测评得分",
                value=f"{latest_score}%" if latest_score else "暂无",
                note=evaluation_trend.latest_mastery_level if evaluation_trend else None,
            ),
        ]


def _format_time(value: str | None) -> str:
    if not value:
        return "最近"
    try:
        parsed = datetime.fromisoformat(value)
        return parsed.strftime("%m-%d %H:%M")
    except Exception:
        return value
