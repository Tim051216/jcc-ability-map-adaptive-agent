from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.v1 import student_portal
from app.schemas.evaluation import EvaluationHistoryItem, EvaluationTrendResponse
from app.services.student_portal_service import StudentPortalService

app = FastAPI()
app.include_router(student_portal.router, prefix="/api/v1/student-portal")
client = TestClient(app)


def test_get_student_dashboard_returns_payload(monkeypatch) -> None:
    async def fake_get_dashboard(self, *, user_id: int, course_id: int | None = None):
        assert user_id == 1001
        assert course_id == 401
        return {
            "featured_courses": [],
            "current_course": None,
            "metrics": [{"key": "course", "label": "当前课程", "value": "软件工程"}],
            "activities": [{"id": "a1", "time": "实时", "title": "已接入课程", "gain": "课程链路"}],
            "profile_summary": None,
            "latest_plan": None,
            "evaluation_trend": None,
            "latest_evaluations": [],
        }

    monkeypatch.setattr(StudentPortalService, "get_dashboard", fake_get_dashboard)

    response = client.get("/api/v1/student-portal/dashboard", params={"user_id": 1001, "course_id": 401})

    assert response.status_code == 200
    assert response.json()["metrics"][0]["key"] == "course"


def test_get_capability_profile_returns_payload(monkeypatch) -> None:
    async def fake_get_capability_profile(self, *, user_id: int, course_id: int | None = None):
        assert user_id == 1001
        assert course_id == 401
        return {
            "overall_score": 88,
            "strongest_axis": "执行效率",
            "axes": [{"label": "执行效率", "score": 88, "benchmark": 70, "note": "真实测评"}],
            "recent_activities": [{"id": "a1", "time": "最近", "title": "完成测评", "gain": "88 分"}],
            "achievements": [{"id": "streak", "title": "阶段学习打卡", "status": "achieved"}],
            "diagnosis_summary": "画像、路径与测评数据已联动。",
            "recommendations": ["继续推进当前阶段学习路径。"],
        }

    monkeypatch.setattr(StudentPortalService, "get_capability_profile", fake_get_capability_profile)

    response = client.get("/api/v1/student-portal/capability-profile", params={"user_id": 1001, "course_id": 401})

    assert response.status_code == 200
    assert response.json()["overall_score"] == 88


def test_get_study_report_returns_payload(monkeypatch) -> None:
    async def fake_get_study_report(self, *, user_id: int, course_id: int | None = None):
        assert user_id == 1001
        assert course_id == 401
        return {
            "overall_score": 87,
            "total_hours": 30.5,
            "average_hours": 4.4,
            "best_day": "周六",
            "weekly_study": [{"day": "周一", "hours": 3.0, "focus": "复盘"}],
            "metrics": [{"key": "hours", "label": "学习时长", "value": "30.5 小时"}],
            "diagnosis_feed": [{"id": "a1", "time": "阶段", "title": "趋势刷新", "gain": "+6 分"}],
            "recommendations": ["优先复盘当前薄弱知识点。"],
        }

    monkeypatch.setattr(StudentPortalService, "get_study_report", fake_get_study_report)

    response = client.get("/api/v1/student-portal/study-report", params={"user_id": 1001, "course_id": 401})

    assert response.status_code == 200
    assert response.json()["best_day"] == "周六"


def test_get_job_learning_overview_returns_shared_contract(monkeypatch) -> None:
    async def fake_get_job_learning_overview(self, *, user_id: int, course_id: int):
        assert user_id == 1001
        assert course_id == 401
        return {
            "user_id": 1001,
            "course_id": 401,
            "course_code": "SE-401",
            "course_name": "软件工程与实践（第4版）",
            "student_goal": "完成软件开发岗位实习准备",
            "goal_scene": "internship",
            "assessment_id": "assessment-18",
            "ability_dimensions": [
                {
                    "code": "requirement_analysis",
                    "label": "需求理解与分析",
                    "score": 72,
                    "benchmark": 70,
                    "assessment_status": "derived",
                    "evidence": ["基于最近岗位诊断总分 78 按规则推导。"],
                }
            ],
            "weak_abilities": [],
            "recommended_path": [],
            "recommended_resources": [],
            "citations": [],
            "safety_notices": [],
            "ai_generated": True,
            "next_action": {
                "action_type": "continue_plan",
                "label": "继续岗位能力提升路径",
                "route": "/path?courseId=401",
                "reason": "已有诊断和学习路径。",
            },
        }

    monkeypatch.setattr(
        StudentPortalService,
        "get_job_learning_overview",
        fake_get_job_learning_overview,
    )

    response = client.get(
        "/api/v1/student-portal/job-learning",
        params={"user_id": 1001, "course_id": 401},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["job_name"] == "软件开发工程师"
    assert payload["ability_dimensions"][0]["code"] == "requirement_analysis"
    assert payload["ability_dimensions"][0]["assessment_status"] == "derived"


def test_update_job_learning_goal_returns_persisted_goal(monkeypatch) -> None:
    async def fake_update_job_learning_goal(self, request):
        assert request.user_id == 1001
        assert request.course_id == 401
        assert request.goal_scene == "competition"
        return {
            "user_id": request.user_id,
            "course_id": request.course_id,
            "job_name": "软件开发工程师",
            "student_goal": request.student_goal,
            "goal_scene": request.goal_scene,
            "updated_at": "2026-08-05T10:00:00+08:00",
        }

    monkeypatch.setattr(
        StudentPortalService,
        "update_job_learning_goal",
        fake_update_job_learning_goal,
    )

    response = client.put(
        "/api/v1/student-portal/job-learning/goal",
        json={
            "user_id": 1001,
            "course_id": 401,
            "student_goal": "备战软件开发技能竞赛",
            "goal_scene": "competition",
        },
    )

    assert response.status_code == 200
    assert response.json()["student_goal"] == "备战软件开发技能竞赛"


def test_job_ability_dimensions_do_not_invent_scores_without_assessment() -> None:
    dimensions = StudentPortalService._build_job_ability_dimensions(
        latest_evaluation=None,
        evaluation_trend=None,
    )

    assert len(dimensions) == 5
    assert all(item.score is None for item in dimensions)
    assert all(item.assessment_status == "not_assessed" for item in dimensions)


def test_job_ability_dimensions_derive_transparently_from_real_evaluation() -> None:
    latest = EvaluationHistoryItem(
        record_id=18,
        course_code="SE-401",
        overall_score=78,
        weak_points=["需求分析边界不清", "测试用例覆盖不足"],
        knowledge_points=["需求分析", "软件测试"],
    )
    trend = EvaluationTrendResponse(
        user_id=1001,
        course_code="SE-401",
        total=1,
        latest_score=78,
        focus_knowledge_points=["需求分析边界不清"],
    )

    dimensions = StudentPortalService._build_job_ability_dimensions(
        latest_evaluation=latest,
        evaluation_trend=trend,
    )
    by_code = {item.code: item for item in dimensions}

    assert by_code["requirement_analysis"].score < 78
    assert by_code["software_testing"].score < 78
    assert by_code["system_design"].score == 78
    assert all(item.assessment_status == "derived" for item in dimensions)
    assert any("薄弱点命中" in evidence for evidence in by_code["requirement_analysis"].evidence)
