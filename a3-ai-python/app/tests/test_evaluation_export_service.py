from types import SimpleNamespace

import pytest

from app.services import evaluation_export_service as evaluation_export_service_module
from app.services.evaluation_export_service import EvaluationExportService


class _FakeSessionFactory:
    def __init__(self, session) -> None:
        self._session = session

    async def __aenter__(self):
        return self._session

    async def __aexit__(self, exc_type, exc, tb) -> bool:
        return False


def _patch_session_factory(monkeypatch, session) -> None:
    monkeypatch.setattr(evaluation_export_service_module, "async_session_factory", lambda: _FakeSessionFactory(session))


@pytest.mark.asyncio
async def test_export_result_returns_markdown_document(monkeypatch) -> None:
    session = SimpleNamespace()
    _patch_session_factory(monkeypatch, session)

    record = SimpleNamespace(
        id=801,
        course_code="PYTHON-AI",
        result_data={
            "paper_id": 501,
            "overall_score": 86.5,
            "evaluation_type": "paper_submission",
            "mastery_level": "good",
            "report_summary": "stable result",
            "strengths": ["basics"],
            "weak_points": ["asyncio"],
            "suggestions": ["practice more"],
            "layered_results": [],
            "metrics": [],
            "knowledge_points": ["python_intro"],
            "recommended_actions": ["continue"],
            "path_feedback": {},
            "profile_feedback": {},
        },
    )

    class FakeEvaluationRepository:
        async def get_by_id(self, session_obj, record_id: int):
            assert session_obj is session
            assert record_id == 801
            return record

    monkeypatch.setattr(evaluation_export_service_module, "EvaluationRepository", lambda: FakeEvaluationRepository())

    response = await EvaluationExportService().export_result(801)

    assert response is not None
    assert response.export_format == "markdown"
    assert response.file_name == "evaluation-report-801.md"
    assert "测评报告 - PYTHON-AI" in response.content


@pytest.mark.asyncio
async def test_export_result_returns_json_document(monkeypatch) -> None:
    session = SimpleNamespace()
    _patch_session_factory(monkeypatch, session)

    record = SimpleNamespace(
        id=802,
        course_code="PYTHON-AI",
        result_data={
            "paper_id": None,
            "overall_score": 90.0,
            "evaluation_type": "diagnostic",
            "mastery_level": "excellent",
            "report_summary": "great",
            "strengths": [],
            "weak_points": [],
            "suggestions": [],
            "layered_results": [],
            "metrics": [],
            "knowledge_points": [],
            "recommended_actions": [],
            "path_feedback": {},
            "profile_feedback": {},
        },
    )

    class FakeEvaluationRepository:
        async def get_by_id(self, session_obj, record_id: int):
            assert record_id == 802
            return record

    monkeypatch.setattr(evaluation_export_service_module, "EvaluationRepository", lambda: FakeEvaluationRepository())

    response = await EvaluationExportService().export_result(802, export_format="json")

    assert response is not None
    assert response.content_type == "application/json"
    assert '"record_id": 802' in response.content
