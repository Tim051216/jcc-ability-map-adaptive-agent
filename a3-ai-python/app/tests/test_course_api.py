from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.v1 import course
from app.services.course_service import CourseService


app = FastAPI()
app.include_router(course.router, prefix="/api/v1/course")
client = TestClient(app)


def test_list_categories_endpoint_returns_course_categories(monkeypatch) -> None:
    async def fake_list_categories(self):
        return [{"id": 1, "name": "人工智能", "children": [{"id": 11, "name": "机器学习", "children": []}]}]

    monkeypatch.setattr(CourseService, "list_categories", fake_list_categories)

    response = client.get("/api/v1/course/categories")

    assert response.status_code == 200
    assert response.json()[0]["name"] == "人工智能"


def test_search_courses_endpoint_passes_filters(monkeypatch) -> None:
    async def fake_search_courses(
        self,
        *,
        keyword=None,
        category_id_lv1=None,
        free=None,
        sort_by=None,
        page_no=1,
        page_size=12,
    ):
        assert keyword == "A3"
        assert category_id_lv1 == 1
        assert free is True
        assert sort_by == "sold"
        assert page_no == 2
        assert page_size == 6
        return {
            "list": [
                {
                    "id": 101,
                    "course_code": "ml_intro",
                    "name": "A3 智能学习助手实战",
                    "cover_url": "/cover.jpg",
                    "price": 0,
                    "sold": 1260,
                    "sections": 24,
                    "teacher": "A3 教学团队",
                    "teacher_name": "A3 教学团队",
                    "summary": "summary",
                    "category_path": "人工智能/大模型应用",
                    "valid_duration": 12,
                    "score": 49,
                }
            ],
            "total": 1,
        }

    monkeypatch.setattr(CourseService, "search_courses", fake_search_courses)

    response = client.get(
        "/api/v1/course/search",
        params={
            "keyword": "A3",
            "categoryIdLv1": 1,
            "free": True,
            "sortBy": "sold",
            "pageNo": 2,
            "pageSize": 6,
        },
    )

    assert response.status_code == 200
    assert response.json()["total"] == 1
    assert response.json()["list"][0]["course_code"] == "ml_intro"


def test_get_learning_course_detail_endpoint_returns_payload(monkeypatch) -> None:
    async def fake_get_learning_course_detail(self, course_id: int):
        assert course_id == 101
        return {
            "id": 101,
            "course_code": "ml_intro",
            "name": "A3 智能学习助手实战",
            "cover_url": "/cover.jpg",
            "teacher_name": "A3 教学团队",
            "lesson_id": 10100,
            "latest_section_id": 10111,
            "moment": 120,
            "chapters": [
                {
                    "id": 1001,
                    "index": "第一章",
                    "name": "学习画像与目标设定",
                    "media_duration": 1200,
                    "sections": [
                        {
                            "id": 10111,
                            "index": 1,
                            "name": "项目导览与业务目标",
                            "type": 2,
                            "media_duration": 540,
                            "trailer": True,
                            "subject_num": 0,
                            "moment": 0,
                        }
                    ],
                }
            ],
        }

    monkeypatch.setattr(CourseService, "get_learning_course_detail", fake_get_learning_course_detail)

    response = client.get("/api/v1/course/courses/101/learning")

    assert response.status_code == 200
    assert response.json()["latest_section_id"] == 10111
    assert response.json()["chapters"][0]["sections"][0]["name"] == "项目导览与业务目标"
