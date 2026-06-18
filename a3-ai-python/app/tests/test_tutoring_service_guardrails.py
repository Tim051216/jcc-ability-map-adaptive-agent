from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.core.config import settings
from app.services.tutoring_service import TutoringService


@pytest.mark.asyncio
async def test_build_answer_payload_includes_guardrail_reviews(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "guardrails_enabled", True, raising=False)
    monkeypatch.setattr(settings, "guardrails_hallucination_enabled", True, raising=False)

    service = TutoringService(MagicMock())
    question = SimpleNamespace(
        id=101,
        session_id=202,
        user_id=1001,
        course_id=401,
        question_type="概念理解",
        knowledge_points=["回归分析"],
    )
    answer = SimpleNamespace(
        id=303,
        question_id=101,
        session_id=202,
        answer_text="过拟合通常表现为训练集效果好于验证集。",
        answer_diagrams=[],
        answer_videos=[],
        reference_sources=[{"title": "机器学习基础", "excerpt": "训练集与验证集差距扩大时需警惕过拟合。"}],
        confidence_score=88.0,
        generation_time=1200,
    )

    payload = await service.build_answer_payload(question=question, answer=answer)

    assert payload["answer_id"] == 303
    assert payload["safety_review"]["output_review"]["blocked"] is False
    assert payload["hallucination_review"] is not None


@pytest.mark.asyncio
async def test_persist_coordinator_result_rewrites_blocked_output(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "guardrails_enabled", True, raising=False)
    monkeypatch.setattr(settings, "guardrails_hallucination_enabled", False, raising=False)

    db = MagicMock()
    db.add = MagicMock()
    db.commit = AsyncMock()
    service = TutoringService(db)
    service._get_open_escalation = AsyncMock(return_value=None)

    question = SimpleNamespace(
        id=1001,
        session_id=2001,
        user_id=3001,
        course_id=401,
        question_type=None,
        knowledge_points=None,
        difficulty_level=None,
        has_answer=False,
        question_status=0,
        is_escalated=False,
        update_time=None,
    )

    result = await service._persist_coordinator_result(
        question,
        {
            "answer_text": "我可以告诉你怎么考试作弊。",
            "answer_diagrams": [],
            "answer_videos": [],
            "reference_sources": [],
            "confidence_score": 91.0,
            "generation_time_ms": 800,
            "should_escalate": False,
            "question_analysis": {
                "question_type": "学习方法",
                "knowledge_points": ["考试规范"],
                "difficulty_level": 2,
            },
        },
    )

    assert "安全保护" in result["answer_text"]
    assert result["safety_review"]["output_review"]["blocked"] is True
