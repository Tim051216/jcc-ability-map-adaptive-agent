import json

from app.db.repositories.evaluation_repository import EvaluationRepository
from app.db.session import async_session_factory
from app.schemas.evaluation import EvaluationExportResponse, EvaluationResponse


class EvaluationExportService:
    async def export_result(self, record_id: int, export_format: str = "markdown") -> EvaluationExportResponse | None:
        async with async_session_factory() as session:
            record = await EvaluationRepository().get_by_id(session, record_id)
            if record is None or not record.result_data:
                return None

        evaluation = EvaluationResponse.model_validate({**record.result_data, "record_id": record.id})
        normalized_format = export_format.lower()
        if normalized_format == "json":
            content = self._build_json_content(record.course_code, evaluation)
            content_type = "application/json"
            suffix = "json"
        else:
            content = self._build_markdown_content(record.course_code, evaluation)
            content_type = "text/markdown"
            suffix = "md"
            normalized_format = "markdown"

        return EvaluationExportResponse(
            record_id=record.id,
            course_code=record.course_code,
            export_format=normalized_format,
            file_name=f"evaluation-report-{record.id}.{suffix}",
            content_type=content_type,
            content=content,
        )

    @staticmethod
    def _build_json_content(course_code: str, evaluation: EvaluationResponse) -> str:
        payload = {
            "record_id": evaluation.record_id,
            "course_code": course_code,
            "overall_score": evaluation.overall_score,
            "evaluation_type": evaluation.evaluation_type,
            "mastery_level": evaluation.mastery_level,
            "report_summary": evaluation.report_summary,
            "strengths": evaluation.strengths,
            "weak_points": evaluation.weak_points,
            "suggestions": evaluation.suggestions,
            "knowledge_points": evaluation.knowledge_points,
            "recommended_actions": evaluation.recommended_actions,
        }
        return json.dumps(payload, ensure_ascii=False, indent=2)

    @staticmethod
    def _build_markdown_content(course_code: str, evaluation: EvaluationResponse) -> str:
        lines = [
            f"# 测评报告 - {course_code}",
            "",
            f"- 记录ID：{evaluation.record_id}",
            f"- 总分：{evaluation.overall_score}",
            f"- 测评类型：{evaluation.evaluation_type}",
            f"- 掌握等级：{evaluation.mastery_level}",
            "",
            "## 报告摘要",
            "",
            evaluation.report_summary or "暂无摘要",
            "",
            "## 优势",
            "",
        ]
        lines.extend([f"- {item}" for item in (evaluation.strengths or ["暂无"])] )
        lines.extend(["", "## 薄弱点", ""])
        lines.extend([f"- {item}" for item in (evaluation.weak_points or ["暂无"])])
        lines.extend(["", "## 学习建议", ""])
        lines.extend([f"- {item}" for item in (evaluation.suggestions or ["暂无"])])
        lines.extend(["", "## 推荐动作", ""])
        lines.extend([f"- {item}" for item in (evaluation.recommended_actions or ["暂无"])])
        return "\n".join(lines)
