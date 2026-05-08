from app.schemas.evaluation import EvaluationRequest, EvaluationResponse


class EvaluationService:
    async def evaluate(self, request: EvaluationRequest) -> EvaluationResponse:
        answer_count = len(request.answers)
        overall_score = 78.0 + min(answer_count * 2, 12)
        return EvaluationResponse(
            overall_score=overall_score,
            strengths=["基础概念掌握较稳定", "能够完成常规知识点回忆"],
            weak_points=["综合应用题拆解偏慢", "对高频错因的复盘还不够系统"],
            suggestions=[
                f"建议围绕 {request.course_code} 增加 1 次项目化实战训练",
                "建议把错题按“概念不清、步骤遗漏、表达不完整”三类归档",
            ],
        )
