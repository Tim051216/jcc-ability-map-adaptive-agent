from datetime import datetime, timezone

from app.db.repositories.evaluation_repository import EvaluationRepository
from app.db.session import async_session_factory
from app.schemas.evaluation import (
    EvaluationLayerResult,
    EvaluationMetric,
    EvaluationRequest,
    EvaluationResponse,
)


class EvaluationService:
    async def get_latest_evaluation(self, user_id: int, course_code: str) -> EvaluationResponse | None:
        async with async_session_factory() as session:
            repo = EvaluationRepository()
            latest = await repo.latest_by_user_course(session, user_id, course_code)
            if latest is None or not latest.result_data:
                return None
            return EvaluationResponse.model_validate(latest.result_data)

    async def evaluate(self, request: EvaluationRequest) -> EvaluationResponse:
        profile = request.profile or {}
        plan = request.plan or {}
        resources = request.resources or []
        dimensions = profile.get("dimensions", {})
        weak_points = dimensions.get("weak_point_preference", {}).get("evidence", []) or [request.course_code]
        plan_steps = plan.get("steps", [])

        answer_count = len(request.answers)
        learning_duration = request.learning_duration_minutes or max(len(plan_steps) * 35, 45)
        resource_usage_count = request.resource_usage_count if request.resource_usage_count is not None else len(resources)

        overall_score = 72.0
        overall_score += min(answer_count * 2.0, 8.0)
        overall_score += min(len(plan_steps) * 1.2, 10.0)
        overall_score += min(resource_usage_count * 1.5, 6.0)
        overall_score = min(round(overall_score, 1), 95.0)

        mastery_level = self._resolve_mastery_level(overall_score)
        layered_results = self._build_layered_results(overall_score)
        metrics = self._build_metrics(overall_score, learning_duration, resource_usage_count, weak_points)

        response = EvaluationResponse(
            overall_score=overall_score,
            evaluation_type="path_diagnostic",
            mastery_level=mastery_level,
            report_summary=f"当前已形成一份围绕 {request.course_code} 的阶段性学习评估，可用于回流画像与路径调优。",
            strengths=[
                "已具备围绕目标知识点组织学习任务的能力。",
                "能够结合计划节点与资源推送形成较完整的学习闭环。",
            ],
            weak_points=[
                f"当前仍需重点攻克“{weak_points[0]}”相关错误模式。",
                "综合应用与迁移输出能力仍需通过阶段测评持续验证。",
            ],
            suggestions=[
                "建议在每个路径节点结束后补充一次 5 分钟自评，便于后续动态调优。",
                "建议把错题按概念不清、步骤遗漏、迁移困难三类归档，作为后续画像更新依据。",
                "建议将薄弱知识点与资源收藏夹联动，形成可回溯强化清单。",
            ],
            layered_results=layered_results,
            metrics=metrics,
            knowledge_points=weak_points[:3],
            recommended_actions=[
                "追加一轮薄弱点专项练习。",
                "保留当前阶段任务节奏，并在综合巩固阶段增加输出型任务。",
                "将本次评估结果同步到画像与路径规划模块。",
            ],
            path_feedback={
                "should_adjust_path": overall_score < 80,
                "next_focus": weak_points[0],
                "recommended_changes": [
                    "提升薄弱点节点权重",
                    "若后续正确率提升，则恢复综合训练节点比例",
                ],
            },
            profile_feedback={
                "should_update_profile": True,
                "affected_dimensions": ["learning_progress", "weak_point_preference", "learning_habit"],
                "summary": "建议依据本次评估结果更新学习进度、薄弱点偏好与学习习惯维度。",
            },
        )

        await self._persist_record(request, response)
        return response

    async def _persist_record(self, request: EvaluationRequest, response: EvaluationResponse) -> None:
        now = datetime.now(timezone.utc).isoformat()
        async with async_session_factory() as session:
            repo = EvaluationRepository()
            await repo.create_record(
                session,
                user_id=request.user_id,
                course_code=request.course_code,
                evaluation_type=response.evaluation_type,
                result_data=response.model_dump(mode="json"),
                created_at=now,
                updated_at=now,
            )
            await session.commit()

    @staticmethod
    def _resolve_mastery_level(score: float) -> str:
        if score >= 88:
            return "proficient"
        if score >= 78:
            return "stable"
        return "developing"

    @staticmethod
    def _build_layered_results(score: float) -> list[EvaluationLayerResult]:
        base_score = min(score + 4, 96)
        advanced_score = max(min(score - 2, 92), 60)
        challenge_score = max(min(score - 6, 88), 55)
        return [
            EvaluationLayerResult(
                level="基础层",
                score=round(base_score, 1),
                status="good" if base_score >= 80 else "watch",
                comment="基础概念理解与常规题型处理能力整体可用。",
            ),
            EvaluationLayerResult(
                level="进阶层",
                score=round(advanced_score, 1),
                status="good" if advanced_score >= 78 else "watch",
                comment="进阶分析能力受薄弱点稳定性影响，仍需专项巩固。",
            ),
            EvaluationLayerResult(
                level="拔高层",
                score=round(challenge_score, 1),
                status="good" if challenge_score >= 75 else "watch",
                comment="综合迁移与开放场景输出能力需要更多高阶训练支撑。",
            ),
        ]

    @staticmethod
    def _build_metrics(
        score: float,
        learning_duration: int,
        resource_usage_count: int,
        weak_points: list[str],
    ) -> list[EvaluationMetric]:
        return [
            EvaluationMetric(
                metric_name="知识掌握度",
                score=min(round(score + 2, 1), 96.0),
                comment="结合路径节点与阶段目标评估当前知识点掌握情况。",
            ),
            EvaluationMetric(
                metric_name="学习投入度",
                score=min(round(60 + learning_duration / 2.5, 1), 95.0),
                comment=f"依据预估学习投入时长 {learning_duration} 分钟进行量化。",
            ),
            EvaluationMetric(
                metric_name="资源使用效率",
                score=min(round(68 + resource_usage_count * 6, 1), 94.0),
                comment="根据资源调用数量与学习链路完整度评估资源利用效率。",
            ),
            EvaluationMetric(
                metric_name="薄弱点修复度",
                score=max(round(score - 5, 1), 58.0),
                comment=f"当前重点关注“{weak_points[0]}”的掌握改善情况。",
            ),
        ]
