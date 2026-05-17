"""辅导历史查询辅助逻辑单测。"""

from datetime import datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.schemas.tutoring import TutoringHistoryQuery
from app.services.tutoring_service import TutoringService, _inclusive_end_calendar_day


def test_inclusive_end_expands_midnight_to_end_of_day() -> None:
    d = datetime(2026, 5, 10, 0, 0, 0)
    end = _inclusive_end_calendar_day(d)
    assert end.hour == 23 and end.minute == 59 and end.second == 59
    assert end.microsecond == 999999


def test_inclusive_end_preserves_explicit_time() -> None:
    d = datetime(2026, 5, 10, 15, 30, 0)
    assert _inclusive_end_calendar_day(d) == d


@pytest.mark.asyncio
async def test_query_history_batches_answers_and_favorites(monkeypatch: pytest.MonkeyPatch) -> None:
    now = datetime(2026, 5, 11, 10, 0, 0)
    question_1 = SimpleNamespace(
        id=101,
        session_id=501,
        user_id=1001,
        question_text="什么是栈",
        question_images=None,
        course_id=1,
        section_id=None,
        question_type="concept",
        knowledge_points=["stack"],
        difficulty_level=1,
        question_status=1,
        has_answer=True,
        is_escalated=False,
        create_time=now,
        update_time=now,
    )
    question_2 = SimpleNamespace(
        id=102,
        session_id=502,
        user_id=1001,
        question_text="什么是队列",
        question_images=None,
        course_id=1,
        section_id=None,
        question_type="concept",
        knowledge_points=["queue"],
        difficulty_level=1,
        question_status=1,
        has_answer=True,
        is_escalated=False,
        create_time=now,
        update_time=now,
    )
    answer_1_old = SimpleNamespace(
        id=201,
        question_id=101,
        session_id=501,
        answer_source=0,
        answerer_id=None,
        answer_text="旧答案",
        answer_diagrams=[],
        answer_videos=[],
        reference_sources=[],
        confidence_score=50,
        generation_time=99,
        is_helpful=None,
        user_rating=None,
        user_feedback=None,
        view_count=0,
        create_time=now,
        update_time=now,
    )
    answer_1_new = SimpleNamespace(
        id=202,
        question_id=101,
        session_id=501,
        answer_source=0,
        answerer_id=None,
        answer_text="新答案",
        answer_diagrams=[],
        answer_videos=[],
        reference_sources=[],
        confidence_score=88,
        generation_time=66,
        is_helpful=None,
        user_rating=None,
        user_feedback=None,
        view_count=0,
        create_time=now,
        update_time=now,
    )
    answer_2 = SimpleNamespace(
        id=203,
        question_id=102,
        session_id=502,
        answer_source=0,
        answerer_id=None,
        answer_text="队列答案",
        answer_diagrams=[],
        answer_videos=[],
        reference_sources=[],
        confidence_score=77,
        generation_time=55,
        is_helpful=None,
        user_rating=None,
        user_feedback=None,
        view_count=0,
        create_time=now,
        update_time=now,
    )

    count_result = MagicMock()
    count_result.scalar_one.return_value = 2

    questions_result = MagicMock()
    questions_result.scalars.return_value.all.return_value = [question_1, question_2]

    answers_result = MagicMock()
    answers_result.scalars.return_value.all.return_value = [answer_1_new, answer_1_old, answer_2]

    favorites_result = MagicMock()
    favorites_result.scalars.return_value.all.return_value = [102]

    db = MagicMock()
    db.execute = AsyncMock(
        side_effect=[count_result, questions_result, answers_result, favorites_result]
    )

    service = TutoringService(db)

    async def _should_not_fetch_single_answer(*args: object, **kwargs: object) -> None:
        raise AssertionError("query_history 不应逐条调用 _get_answer_by_question")

    async def _should_not_fetch_single_favorite(*args: object, **kwargs: object) -> None:
        raise AssertionError("query_history 不应逐条调用 _is_favorited")

    monkeypatch.setattr(service, "_get_answer_by_question", _should_not_fetch_single_answer)
    monkeypatch.setattr(service, "_is_favorited", _should_not_fetch_single_favorite)

    result = await service.query_history(
        1001,
        TutoringHistoryQuery(user_id=1001, page=1, page_size=10),
    )

    assert result["total"] == 2
    assert len(result["items"]) == 2
    assert result["items"][0].answer.answer_text == "新答案"
    assert result["items"][0].is_favorited is False
    assert result["items"][1].answer.answer_text == "队列答案"
    assert result["items"][1].is_favorited is True
    assert db.execute.await_count == 4


@pytest.mark.asyncio
async def test_persist_result_auto_creates_escalation_when_confidence_low() -> None:
    now = datetime(2026, 5, 11, 10, 0, 0)
    question = SimpleNamespace(
        id=101,
        session_id=501,
        user_id=1001,
        question_type=None,
        knowledge_points=None,
        difficulty_level=None,
        has_answer=False,
        question_status=0,
        is_escalated=False,
        update_time=now,
    )
    db = MagicMock()
    db.add = MagicMock()
    db.commit = AsyncMock()
    service = TutoringService(db)
    service._generate_id = staticmethod(lambda: 99901)  # type: ignore[method-assign]
    service._get_open_escalation = AsyncMock(return_value=None)  # type: ignore[method-assign]

    result = await service._persist_coordinator_result(
        question,
        {
            "answer_text": "AI 答案",
            "answer_diagrams": [],
            "answer_videos": [],
            "reference_sources": [],
            "confidence_score": 55.0,
            "generation_time_ms": 123,
            "should_escalate": True,
            "question_analysis": {
                "question_type": "概念理解",
                "knowledge_points": ["overfitting"],
                "difficulty_level": 2,
            },
        },
    )

    assert result["should_escalate"] is True
    assert question.is_escalated is True
    assert question.question_status == 2
    assert db.add.call_count == 2
    assert db.commit.await_count == 1
