from sqlalchemy import func, select

from app.db.models.evaluation_record import EvaluationRecord
from app.db.models.generation_task import GenerationTask
from app.db.models.learning_plan import LearningPlan
from app.db.models.user_profile import UserProfileSnapshot
from app.db.session import async_session_factory
from app.services.embedding_service import EmbeddingService


class AdminService:
    async def get_overview(self) -> dict:
        async with async_session_factory() as session:
            profile_count = await session.scalar(select(func.count()).select_from(UserProfileSnapshot)) or 0
            plan_count = await session.scalar(select(func.count()).select_from(LearningPlan)) or 0
            evaluation_count = await session.scalar(select(func.count()).select_from(EvaluationRecord)) or 0
            task_count = await session.scalar(select(func.count()).select_from(GenerationTask)) or 0
            running_task_count = (
                await session.scalar(
                    select(func.count()).select_from(GenerationTask).where(GenerationTask.status == "running")
                )
                or 0
            )
            failed_task_count = (
                await session.scalar(
                    select(func.count()).select_from(GenerationTask).where(GenerationTask.status == "failed")
                )
                or 0
            )

            latest_plan = await session.scalar(select(LearningPlan).order_by(LearningPlan.id.desc()).limit(1))
            latest_evaluation = await session.scalar(
                select(EvaluationRecord).order_by(EvaluationRecord.id.desc()).limit(1)
            )
            latest_profile = await session.scalar(
                select(UserProfileSnapshot).order_by(UserProfileSnapshot.id.desc()).limit(1)
            )

        embedding_status = await EmbeddingService().ping()
        alerts = []
        if failed_task_count > 0:
            alerts.append(f"当前存在 {failed_task_count} 个失败任务，建议排查模型或网关链路。")
        if running_task_count > 3:
            alerts.append(f"当前运行中任务 {running_task_count} 个，建议关注异步链路耗时。")
        if plan_count == 0 or evaluation_count == 0:
            alerts.append("当前学习路径或评估数据沉淀较少，建议先完成一轮完整学生端演示。")
        if not alerts:
            alerts.append("当前 AI 服务运行平稳，可继续进行学生端与后台端联合演示。")

        return {
            "service_status": {
                "api": "ok",
                "embedding": embedding_status.get("status", "unknown"),
            },
            "metrics": {
                "profile_count": profile_count,
                "plan_count": plan_count,
                "evaluation_count": evaluation_count,
                "task_count": task_count,
                "running_task_count": running_task_count,
                "failed_task_count": failed_task_count,
            },
            "latest_snapshot": {
                "profile_version": latest_profile.version if latest_profile else None,
                "latest_plan_summary": latest_plan.summary if latest_plan else None,
                "latest_evaluation_type": latest_evaluation.evaluation_type if latest_evaluation else None,
                "latest_evaluation_score": (
                    latest_evaluation.result_data.get("overall_score")
                    if latest_evaluation and latest_evaluation.result_data
                    else None
                ),
            },
            "alerts": alerts,
            "pending_reviews": [
                "待人工复核生成资源质量与答辩展示措辞。",
                "待联调真实用户数据与学习行为回流逻辑。",
            ],
        }
