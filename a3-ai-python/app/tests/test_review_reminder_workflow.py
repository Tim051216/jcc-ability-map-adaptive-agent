import pytest

from app.agents.review_reminder_workflow import build_review_reminder_workflow


@pytest.mark.asyncio
async def test_review_reminder_workflow_prioritizes_focus_and_spacing() -> None:
    workflow = build_review_reminder_workflow()

    result = await workflow.ainvoke(
        {
            "user_id": 1001,
            "course_id": 401,
            "section_index": 0,
            "total_watched_seconds": 600,
            "completed_sections": [0, 1],
            "latest_score": 78.0,
            "improvement": 6.0,
            "focus_knowledge_points": ["副作用依赖"],
            "favorite_resource_type": "lecture_note",
            "base_summary": "已根据当前学习内容生成复习计划。",
            "review_cards": [
                {
                    "id": "card-1",
                    "prompt": "什么时候需要回顾 useEffect 依赖？",
                    "answer": "当副作用触发频繁且依赖复杂时。",
                    "review_stage": "首次回顾",
                    "next_review_in_hours": 0,
                    "source_video": "Hooks 组合设计",
                },
                {
                    "id": "card-2",
                    "prompt": "Profiler 最适合用来做什么？",
                    "answer": "定位耗时渲染。",
                    "review_stage": "巩固回顾",
                    "next_review_in_hours": 0,
                    "source_video": "Profiler 入门",
                },
            ],
            "execution_trace": [],
        }
    )

    assert result["cards"][0]["next_review_in_hours"] == 12
    assert result["cards"][1]["next_review_in_hours"] == 24
    assert "重点：副作用依赖" in result["cards"][0]["prompt"]
    assert "最近一次测评分数为 78" in result["summary"]
    assert "lecture_note" in result["summary"]
    assert result["execution_trace"] == [
        "gather_review_context",
        "prioritize_review_cards",
        "compose_review_plan",
    ]
