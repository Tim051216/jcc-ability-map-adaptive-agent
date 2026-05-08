import httpx

from app.integrations.java_clients.course_client import CourseClient
from app.integrations.java_clients.learning_client import LearningClient
from app.schemas.plan import LearningPlanRequest, LearningPlanResponse, LearningPlanStep
from app.schemas.rag import RagSearchRequest
from app.services.rag_service import RagService


class PlanService:
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
        progress_hint = (
            f"当前学习进度约 {learning_record.process_percent}%"
            if learning_record and learning_record.process_percent is not None
            else "当前学习进度待同步"
        )
        weekly_frequency = (
            learning_record.week_freq if learning_record and learning_record.week_freq is not None else None
        )

        rag = await RagService().search(
            RagSearchRequest(
                course_code=request.course_code,
                query=request.target,
                top_k=min(max(request.available_days, 3), 7),
            )
        )

        steps: list[LearningPlanStep] = []
        if rag.hits:
            for index, hit in enumerate(rag.hits[: request.available_days], start=1):
                steps.append(
                    LearningPlanStep(
                        day=index,
                        title=hit.title,
                        objective=self._build_objective(hit.title, request.target),
                        tasks=[
                            f"阅读并理解《{hit.title}》的核心概念",
                            f"整理 3 条与“{request.target}”直接相关的学习笔记",
                            f"用 {request.daily_study_minutes} 分钟完成 1 组针对性练习",
                        ],
                        checkpoint=self._build_checkpoint(hit.title),
                    )
                )
        else:
            steps = [
                LearningPlanStep(
                    day=1,
                    title="建立知识地图",
                    objective=f"建立 {course_name} 的整体认知框架",
                    tasks=[f"了解 {course_name} 课程结构", "完成基础诊断"],
                    checkpoint="能够口头说明课程模块划分和当前薄弱点",
                ),
                LearningPlanStep(
                    day=2,
                    title="攻克核心概念",
                    objective=f"围绕 {request.target} 建立第一轮概念理解",
                    tasks=["学习重点章节", "完成基础练习"],
                    checkpoint="能独立解释至少 2 个核心概念",
                ),
            ]

        risk_alerts = self._build_risk_alerts(
            available_days=request.available_days,
            daily_study_minutes=request.daily_study_minutes,
            weekly_frequency=weekly_frequency,
        )

        return LearningPlanResponse(
            user_id=request.user_id,
            course_code=request.course_code,
            course_name=course_name,
            summary=f"围绕 {request.target} 生成的学习路径，{progress_hint}",
            progress_hint=progress_hint,
            next_action=f"先执行第 1 天任务，并在学习结束后回填一次关于“{request.target}”的自评结果。",
            risk_alerts=risk_alerts,
            steps=steps,
        )

    @staticmethod
    def _build_objective(title: str, target: str) -> str:
        return f"围绕“{target}”完成《{title}》的重点吸收与迁移。"

    @staticmethod
    def _build_checkpoint(title: str) -> str:
        return f"能够结合《{title}》输出 1 段自己的理解，并指出 1 个易错点。"

    @staticmethod
    def _build_risk_alerts(
        available_days: int,
        daily_study_minutes: int,
        weekly_frequency: int | None,
    ) -> list[str]:
        alerts: list[str] = []
        if available_days <= 3:
            alerts.append("可用天数较少，建议优先完成高频考点和基础题。")
        if daily_study_minutes < 30:
            alerts.append("单日学习时长偏短，建议把任务拆成概念学习和练习两段执行。")
        if weekly_frequency is not None and weekly_frequency < 2:
            alerts.append("历史学习频次偏低，建议先建立固定复习节奏。")
        return alerts
