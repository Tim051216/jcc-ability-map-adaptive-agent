from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

from app.api.v1 import evaluation, plan, resource
from app.services.evaluation_service import EvaluationService
from app.services.plan_service import PlanService
from app.services.resource_service import ResourceService


app = FastAPI()
app.include_router(plan.router, prefix="/api/v1/plan")
app.include_router(resource.router, prefix="/api/v1/resource")
app.include_router(evaluation.router, prefix="/api/v1/evaluation")
client = TestClient(app)


def test_generate_plan_returns_payload(monkeypatch) -> None:
    async def fake_generate_plan(self, request):
        assert request.user_id == 1001
        assert request.course_code == "JAVA-CORE"
        return {
            "plan_id": 11,
            "user_id": 1001,
            "course_code": "JAVA-CORE",
            "course_name": "Java Core",
            "summary": "finish java basics",
            "progress_hint": "start from syntax",
            "next_action": "open day 1 task",
            "risk_alerts": ["watch time budget"],
            "path_mode": "laddered",
            "current_stage": "syntax warmup",
            "completion_rate": 0.0,
            "dynamic_adjustments": ["reduce pace if blocked"],
            "recommended_checkpoints": ["finish syntax"],
            "stages": [],
            "steps": [
                {
                    "step_id": "day-1",
                    "day": 1,
                    "title": "Warm up",
                    "objective": "read chapter 1",
                    "tasks": ["read chapter 1"],
                    "checkpoint": "explain variables",
                    "stage_no": 1,
                    "stage_name": "syntax warmup",
                    "node_type": "study_task",
                    "status": "pending",
                    "duration_minutes": 45,
                    "weak_point_focus": [],
                    "knowledge_points": ["variables"],
                    "recommended_resource_types": ["note"],
                    "resource_pushes": [],
                }
            ],
        }

    monkeypatch.setattr(PlanService, "generate_plan", fake_generate_plan)

    response = client.post(
        "/api/v1/plan/generate",
        json={"user_id": 1001, "course_code": "JAVA-CORE", "target": "finish java basics"},
    )

    assert response.status_code == 200
    assert response.json()["plan_id"] == 11


def test_get_latest_plan_returns_404_when_service_returns_none(monkeypatch) -> None:
    async def fake_get_latest_plan(self, *, user_id: int, course_code: str):
        assert user_id == 1001
        assert course_code == "JAVA-CORE"
        return None

    monkeypatch.setattr(PlanService, "get_latest_plan", fake_get_latest_plan)

    response = client.get("/api/v1/plan/latest", params={"user_id": 1001, "course_code": "JAVA-CORE"})

    assert response.status_code == 404
    assert response.json()["detail"] == "learning plan not found"


def test_get_plan_returns_404_when_service_returns_none(monkeypatch) -> None:
    async def fake_get_plan(self, plan_id: int):
        assert plan_id == 11
        return None

    monkeypatch.setattr(PlanService, "get_plan", fake_get_plan)

    response = client.get("/api/v1/plan/11")

    assert response.status_code == 404
    assert response.json()["detail"] == "learning plan not found"


def test_complete_plan_step_forwards_action(monkeypatch) -> None:
    async def fake_update_step_status(self, *, plan_id: int, user_id: int, step_id: str, action: str):
        assert plan_id == 11
        assert user_id == 1001
        assert step_id == "day-1"
        assert action == "complete"
        return {
            "plan_id": 11,
            "user_id": 1001,
            "completion_rate": 50.0,
            "completed_steps": 1,
            "total_steps": 2,
            "items": [
                {
                    "step_id": "day-1",
                    "status": "completed",
                    "progress_note": "done",
                    "last_action": "complete",
                    "updated_at": "2026-05-09T09:00:00+00:00",
                }
            ],
        }

    monkeypatch.setattr(PlanService, "update_step_status", fake_update_step_status)

    response = client.post("/api/v1/plan/11/steps/day-1/complete", json={"user_id": 1001})

    assert response.status_code == 200
    assert response.json()["items"][0]["last_action"] == "complete"


def test_pause_plan_step_forwards_action(monkeypatch) -> None:
    async def fake_update_step_status(self, *, plan_id: int, user_id: int, step_id: str, action: str):
        assert plan_id == 11
        assert user_id == 1001
        assert step_id == "day-1"
        assert action == "pause"
        return {
            "plan_id": 11,
            "user_id": 1001,
            "completion_rate": 50.0,
            "completed_steps": 1,
            "total_steps": 2,
            "items": [
                {
                    "step_id": "day-1",
                    "status": "paused",
                    "progress_note": "blocked by schedule",
                    "last_action": "pause",
                    "updated_at": "2026-05-09T09:10:00+00:00",
                }
            ],
        }

    monkeypatch.setattr(PlanService, "update_step_status", fake_update_step_status)

    response = client.post("/api/v1/plan/11/steps/day-1/pause", json={"user_id": 1001})

    assert response.status_code == 200
    assert response.json()["items"][0]["last_action"] == "pause"


def test_resume_plan_step_forwards_action(monkeypatch) -> None:
    async def fake_update_step_status(self, *, plan_id: int, user_id: int, step_id: str, action: str):
        assert plan_id == 11
        assert user_id == 1001
        assert step_id == "day-1"
        assert action == "resume"
        return {
            "plan_id": 11,
            "user_id": 1001,
            "completion_rate": 50.0,
            "completed_steps": 1,
            "total_steps": 2,
            "items": [
                {
                    "step_id": "day-1",
                    "status": "in_progress",
                    "progress_note": "continue now",
                    "last_action": "resume",
                    "updated_at": "2026-05-09T09:15:00+00:00",
                }
            ],
        }

    monkeypatch.setattr(PlanService, "update_step_status", fake_update_step_status)

    response = client.post("/api/v1/plan/11/steps/day-1/resume", json={"user_id": 1001})

    assert response.status_code == 200
    assert response.json()["items"][0]["last_action"] == "resume"


def test_get_plan_progress_returns_payload(monkeypatch) -> None:
    async def fake_get_plan_progress(self, *, plan_id: int, user_id: int):
        assert plan_id == 11
        assert user_id == 1001
        return {
            "plan_id": 11,
            "user_id": 1001,
            "completion_rate": 50.0,
            "completed_steps": 1,
            "total_steps": 2,
            "items": [
                {
                    "step_id": "day-1",
                    "status": "completed",
                    "progress_note": "stable",
                    "last_action": "complete",
                    "updated_at": "2026-05-09T09:00:00+00:00",
                }
            ],
        }

    monkeypatch.setattr(PlanService, "get_plan_progress", fake_get_plan_progress)

    response = client.get("/api/v1/plan/11/progress", params={"user_id": 1001})

    assert response.status_code == 200
    assert response.json()["completion_rate"] == 50.0


def test_list_resources_passes_filters(monkeypatch) -> None:
    async def fake_list_resources(self, *, user_id: int, course_code: str | None = None, resource_type: str | None = None):
        assert user_id == 1001
        assert course_code == "JAVA-CORE"
        assert resource_type == "quiz_set"
        return {
            "items": [
                {
                    "resource_id": 301,
                    "resource_type": "quiz_set",
                    "title": "Quiz A",
                    "summary": "practice set",
                    "content_markdown": "content",
                    "source_titles": ["doc1"],
                    "study_suggestion": "use after class",
                }
            ],
            "total": 1,
        }

    monkeypatch.setattr(ResourceService, "list_resources", fake_list_resources)

    response = client.get(
        "/api/v1/resource",
        params={"user_id": 1001, "course_code": "JAVA-CORE", "resource_type": "quiz_set"},
    )

    assert response.status_code == 200
    assert response.json()["items"][0]["resource_type"] == "quiz_set"


def test_list_favorites_returns_payload(monkeypatch) -> None:
    async def fake_list_favorites(self, *, user_id: int):
        assert user_id == 1001
        return {
            "items": [
                {
                    "resource_id": 302,
                    "resource_type": "mind_map",
                    "title": "Mind Map",
                    "summary": "summary",
                    "content_markdown": "content",
                    "source_titles": ["doc2"],
                    "study_suggestion": "review quickly",
                }
            ],
            "total": 1,
        }

    monkeypatch.setattr(ResourceService, "list_favorites", fake_list_favorites)

    response = client.get("/api/v1/resource/favorites", params={"user_id": 1001})

    assert response.status_code == 200
    assert response.json()["total"] == 1


def test_list_archived_resources_returns_payload(monkeypatch) -> None:
    async def fake_list_archived_resources(self, *, user_id: int, course_code: str | None = None, resource_type: str | None = None):
        assert user_id == 1001
        assert course_code == "JAVA-CORE"
        assert resource_type == "quiz_set"
        return {
            "items": [
                {
                    "resource_id": 399,
                    "resource_type": "quiz_set",
                    "title": "Archived Quiz",
                    "summary": "old practice",
                    "content_markdown": "content",
                    "source_titles": ["doc9"],
                    "study_suggestion": "review only",
                }
            ],
            "total": 1,
        }

    monkeypatch.setattr(ResourceService, "list_archived_resources", fake_list_archived_resources)

    response = client.get(
        "/api/v1/resource/history",
        params={"user_id": 1001, "course_code": "JAVA-CORE", "resource_type": "quiz_set"},
    )

    assert response.status_code == 200
    assert response.json()["items"][0]["title"] == "Archived Quiz"


def test_list_favorite_history_returns_payload(monkeypatch) -> None:
    async def fake_list_favorite_history(self, user_id: int):
        assert user_id == 1001
        return {
            "items": [
                {
                    "resource_id": 302,
                    "user_id": 1001,
                    "action": "favorite",
                    "created_at": "2026-05-09T10:00:00+00:00",
                }
            ],
            "total": 1,
        }

    monkeypatch.setattr(ResourceService, "list_favorite_history", fake_list_favorite_history)

    response = client.get("/api/v1/resource/favorites/history", params={"user_id": 1001})

    assert response.status_code == 200
    assert response.json()["items"][0]["action"] == "favorite"


def test_favorite_resource_returns_status(monkeypatch) -> None:
    async def fake_favorite_resource(self, *, user_id: int, resource_id: int):
        assert user_id == 1001
        assert resource_id == 302
        return {"resource_id": 302, "user_id": 1001, "favorite": True}

    monkeypatch.setattr(ResourceService, "favorite_resource", fake_favorite_resource)

    response = client.post("/api/v1/resource/302/favorite", json={"user_id": 1001})

    assert response.status_code == 200
    assert response.json()["favorite"] is True


def test_archive_resource_returns_status(monkeypatch) -> None:
    async def fake_archive_resource(self, resource_id: int, request):
        assert resource_id == 302
        assert request.user_id == 1001
        assert request.archived_by == "adminA"
        return {
            "resource_id": 302,
            "archived": True,
            "archived_by": "adminA",
            "archive_reason": "merged into newer version",
            "archived_at": "2026-05-09T10:30:00+00:00",
        }

    monkeypatch.setattr(ResourceService, "archive_resource", fake_archive_resource)

    response = client.post(
        "/api/v1/resource/302/archive",
        json={"user_id": 1001, "archived_by": "adminA", "reason": "merged into newer version"},
    )

    assert response.status_code == 200
    assert response.json()["archived"] is True


def test_get_download_access_returns_payload(monkeypatch) -> None:
    async def fake_get_download_access(self, *, user_id: int, resource_id: int):
        assert user_id == 1001
        assert resource_id == 302
        return {
            "resource_id": 302,
            "user_id": 1001,
            "can_download": True,
            "download_scope": "owner",
            "reason": "download allowed",
        }

    monkeypatch.setattr(ResourceService, "get_download_access", fake_get_download_access)

    response = client.get("/api/v1/resource/302/download-access", params={"user_id": 1001})

    assert response.status_code == 200
    assert response.json()["can_download"] is True


def test_get_resource_propagates_not_found(monkeypatch) -> None:
    async def fake_get_resource(self, resource_id: int):
        raise HTTPException(status_code=404, detail=f"resource {resource_id} not found")

    monkeypatch.setattr(ResourceService, "get_resource", fake_get_resource)

    response = client.get("/api/v1/resource/999")

    assert response.status_code == 404
    assert response.json()["detail"] == "resource 999 not found"


def test_evaluate_returns_payload(monkeypatch) -> None:
    async def fake_evaluate(self, request):
        assert request.user_id == 1001
        assert request.course_code == "PYTHON-AI"
        return {
            "record_id": 701,
            "paper_id": None,
            "overall_score": 91.0,
            "evaluation_type": "diagnostic",
            "mastery_level": "excellent",
            "report_summary": "solid baseline",
            "strengths": ["syntax"],
            "weak_points": ["project practice"],
            "suggestions": ["build one app"],
            "layered_results": [],
            "metrics": [],
            "knowledge_points": ["python_intro"],
            "recommended_actions": ["continue"],
            "path_feedback": {},
            "profile_feedback": {},
        }

    monkeypatch.setattr(EvaluationService, "evaluate", fake_evaluate)

    response = client.post(
        "/api/v1/evaluation",
        json={"user_id": 1001, "course_code": "PYTHON-AI", "evaluation_type": "diagnostic"},
    )

    assert response.status_code == 200
    assert response.json()["record_id"] == 701


def test_generate_paper_returns_payload(monkeypatch) -> None:
    async def fake_generate_paper(self, request):
        assert request.user_id == 1001
        assert request.course_code == "PYTHON-AI"
        return {
            "paper_id": 501,
            "user_id": 1001,
            "course_code": "PYTHON-AI",
            "paper_type": "diagnostic",
            "status": "generated",
            "questions": [
                {
                    "question_id": "q1",
                    "question_type": "single_choice",
                    "prompt": "What is Python?",
                    "options": ["language", "database"],
                    "correct_answer": "language",
                    "explanation": "basic concept",
                    "knowledge_point": "python_intro",
                    "difficulty": "basic",
                }
            ],
        }

    monkeypatch.setattr(EvaluationService, "generate_paper", fake_generate_paper)

    response = client.post(
        "/api/v1/evaluation/papers/generate",
        json={"user_id": 1001, "course_code": "PYTHON-AI", "question_count": 5},
    )

    assert response.status_code == 200
    assert response.json()["paper_id"] == 501


def test_get_paper_returns_404_when_missing(monkeypatch) -> None:
    async def fake_get_paper(self, paper_id: int):
        assert paper_id == 501
        return None

    monkeypatch.setattr(EvaluationService, "get_paper", fake_get_paper)

    response = client.get("/api/v1/evaluation/papers/501")

    assert response.status_code == 404
    assert response.json()["detail"] == "evaluation paper not found"


def test_submit_paper_forwards_payload(monkeypatch) -> None:
    async def fake_submit_paper(self, *, paper_id: int, request):
        assert paper_id == 501
        assert request.user_id == 1001
        assert len(request.answers) == 1
        return {
            "record_id": 801,
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
        }

    monkeypatch.setattr(EvaluationService, "submit_paper", fake_submit_paper)

    response = client.post(
        "/api/v1/evaluation/papers/501/submit",
        json={"user_id": 1001, "answers": [{"question_id": "q1", "answer": "language"}]},
    )

    assert response.status_code == 200
    assert response.json()["evaluation_type"] == "paper_submission"


def test_get_latest_evaluation_returns_404_when_missing(monkeypatch) -> None:
    async def fake_get_latest_evaluation(self, *, user_id: int, course_code: str):
        assert user_id == 1001
        assert course_code == "PYTHON-AI"
        return None

    monkeypatch.setattr(EvaluationService, "get_latest_evaluation", fake_get_latest_evaluation)

    response = client.get("/api/v1/evaluation/latest", params={"user_id": 1001, "course_code": "PYTHON-AI"})

    assert response.status_code == 404
    assert response.json()["detail"] == "evaluation not found"


def test_get_result_returns_404_when_missing(monkeypatch) -> None:
    async def fake_get_result(self, record_id: int):
        assert record_id == 801
        return None

    monkeypatch.setattr(EvaluationService, "get_result", fake_get_result)

    response = client.get("/api/v1/evaluation/results/801")

    assert response.status_code == 404
    assert response.json()["detail"] == "evaluation result not found"


def test_get_wrong_questions_returns_payload(monkeypatch) -> None:
    async def fake_get_wrong_questions(self, record_id: int):
        assert record_id == 801
        return {
            "items": [
                {
                    "question_id": "q2",
                    "prompt": "Explain async",
                    "knowledge_point": "asyncio",
                    "user_answer": "thread",
                    "correct_answer": "event loop",
                    "explanation": "different model",
                }
            ],
            "total": 1,
        }

    monkeypatch.setattr(EvaluationService, "get_wrong_questions", fake_get_wrong_questions)

    response = client.get("/api/v1/evaluation/results/801/wrong-questions")

    assert response.status_code == 200
    assert response.json()["items"][0]["knowledge_point"] == "asyncio"


def test_export_evaluation_result_returns_markdown_payload(monkeypatch) -> None:
    from app.services.evaluation_export_service import EvaluationExportService

    async def fake_export_result(self, record_id: int, export_format: str = "markdown"):
        assert record_id == 801
        assert export_format == "markdown"
        return {
            "record_id": 801,
            "course_code": "PYTHON-AI",
            "export_format": "markdown",
            "file_name": "evaluation-report-801.md",
            "content_type": "text/markdown",
            "content": "# 测评报告 - PYTHON-AI",
        }

    monkeypatch.setattr(EvaluationExportService, "export_result", fake_export_result)

    response = client.get("/api/v1/evaluation/results/801/export")

    assert response.status_code == 200
    assert response.json()["file_name"] == "evaluation-report-801.md"
