from app.services.tutoring_service import TutoringService


def test_local_fallback_returns_course_review_order_for_study_plan_question() -> None:
    result = TutoringService._build_local_fallback_result(
        question_text="现在我应该先复习哪一章？不要报时间，只给学习顺序。",
        course_id=401,
        question_images=None,
        failure_reason="simulated failure",
    )

    answer_text = result["answer_text"]
    assert "第一章软件工程基础" in answer_text
    assert "第二章计划、需求与设计" in answer_text
    assert "第三章实现、测试与管理" in answer_text
    assert "当前 AI 深度生成链路暂时波动" not in answer_text
