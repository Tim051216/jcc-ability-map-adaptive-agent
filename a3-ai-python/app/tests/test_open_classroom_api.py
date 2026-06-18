from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.v1 import open_classroom


app = FastAPI()
app.include_router(open_classroom.router, prefix="/api/v1/open-classroom")
client = TestClient(app)


def test_build_open_classroom_returns_multi_agent_payload() -> None:
    response = client.post(
        "/api/v1/open-classroom/build",
        headers={"X-User-Id": "1001"},
        json={
            "courseCode": "SE-101",
            "courseName": "软件工程",
            "lessonTitle": "需求分析与概要设计",
            "studentQuestion": "为什么需求分析不能直接跳到写代码？",
            "focusPoints": ["需求分析", "概要设计", "实现边界"],
            "targetResourceTypes": ["课堂讲义", "互动测验", "PPT 草案"],
            "audienceLevel": "intermediate",
            "durationMinutes": 30,
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["completionStatus"] == "completed"
    assert len(payload["agentCards"]) == 3
    assert payload["agentCards"][0]["role"] == "teacher"
    assert len(payload["quizQuestions"]) == 3
    assert payload["quizQuestions"][0]["questionType"] == "single_choice"
    assert len(payload["pptOutline"]) >= 3
