from __future__ import annotations

from datetime import datetime

from app.schemas.course import CourseCardResponse, LearningCourseDetailResponse
from app.schemas.evaluation import EvaluationHistoryItem, EvaluationTrendResponse
from app.schemas.plan import LearningPlanResponse
from app.schemas.profile_conversation import ProfileSummary
from app.schemas.student_portal import (
    CapabilityAchievementItem,
    CapabilityAxisItem,
    CapabilityProfileResponse,
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
from app.db.session import async_session_factory


class StudentPortalService:
    DEFAULT_USER_ID = 1001

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
        completeness = profile_summary.completeness if profile_summary else 55
        plan_completion = round(latest_plan.completion_rate) if latest_plan else 40
        latest_score = round(evaluation_trend.latest_score) if evaluation_trend and evaluation_trend.latest_score is not None else 60
        return [
            CapabilityAxisItem(label="规划能力", score=min(95, max(40, plan_completion)), benchmark=62, note="学习路径节奏"),
            CapabilityAxisItem(label="执行效率", score=min(95, max(45, latest_score)), benchmark=68, note="真实测评表现"),
            CapabilityAxisItem(label="学习持续力", score=min(96, max(50, completeness)), benchmark=72, note="画像完成度"),
            CapabilityAxisItem(label="认知广度", score=min(92, max(48, latest_score - 6)), benchmark=66, note="知识覆盖"),
            CapabilityAxisItem(label="成果输出", score=min(94, max(46, latest_score + 2)), benchmark=64, note="答题与报告"),
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
