from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_learning_question_and_reply_flow() -> None:
    create_response = client.post(
        "/api/v1/learning/questions",
        json={
            "courseId": 101,
            "chapterId": 1011,
            "sectionId": 10111,
            "title": "学习页目录为什么优先接真实接口？",
            "description": "想确认这条开发顺序背后的取舍。",
            "anonymity": False,
        },
    )
    assert create_response.status_code == 200
    question_id = create_response.json()["id"]

    list_response = client.get("/api/v1/learning/questions/page", params={"courseId": 101, "sectionId": 10111})
    assert list_response.status_code == 200
    assert any(item["id"] == question_id for item in list_response.json()["list"])

    reply_response = client.post(
        "/api/v1/learning/replies",
        json={
            "questionId": question_id,
            "content": "因为目录是学习页主入口，先接真实接口能更快缩掉 demo 数据。",
            "anonymity": False,
        },
    )
    assert reply_response.status_code == 200
    answer_id = reply_response.json()["id"]

    answer_list_response = client.get("/api/v1/learning/replies/page", params={"questionId": question_id})
    assert answer_list_response.status_code == 200
    assert answer_list_response.json()["list"][0]["id"] == answer_id

    nested_reply_response = client.post(
        "/api/v1/learning/replies",
        json={
            "questionId": question_id,
            "answerId": answer_id,
            "targetReplyId": answer_id,
            "targetUserId": 11,
            "content": "明白了，这样页面主链路会更稳。",
            "anonymity": False,
        },
    )
    assert nested_reply_response.status_code == 200

    nested_list_response = client.get("/api/v1/learning/replies/page", params={"answerId": answer_id})
    assert nested_list_response.status_code == 200
    assert nested_list_response.json()["total"] >= 1


def test_learning_notes_and_exam_flow() -> None:
    create_note_response = client.post(
        "/api/v1/learning/notes",
        json={
            "courseId": 101,
            "chapterId": 1012,
            "sectionId": 10121,
            "content": "资源推荐页要和画像输入放同屏演示。",
            "noteMoment": 185,
            "isPrivate": False,
        },
    )
    assert create_note_response.status_code == 200
    note_id = create_note_response.json()["id"]

    note_list_response = client.get("/api/v1/learning/notes/page", params={"courseId": 101, "onlyMine": False})
    assert note_list_response.status_code == 200
    assert any(item["id"] == note_id for item in note_list_response.json()["list"])

    gather_response = client.post(f"/api/v1/learning/notes/gathers/{note_id}")
    assert gather_response.status_code == 200
    assert gather_response.json()["isGathered"] is True

    exam_response = client.post("/api/v1/learning/exams", json={"courseId": 101, "sectionId": 10111, "questionCount": 2})
    assert exam_response.status_code == 200
    exam_id = exam_response.json()["id"]
    questions = exam_response.json()["questions"]
    assert len(questions) == 2

    submit_response = client.post(
        "/api/v1/learning/exams/details",
        json={
            "id": exam_id,
            "examDetails": [
                {"questionId": questions[0]["id"], "questionType": 1, "answer": "2"},
                {"questionId": questions[1]["id"], "questionType": 5, "answer": "因为画像和资源绑定更直观。"},
            ],
        },
    )
    assert submit_response.status_code == 200
    assert submit_response.json()[0]["answers"] == "2"
