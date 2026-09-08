import pytest

from app.services.guardrail_service import GuardrailContext, GuardrailService


@pytest.mark.asyncio
async def test_guardrail_blocks_sensitive_input() -> None:
    service = GuardrailService()
    review = await service.review_input("我想找代考和考试作弊的方法", context=GuardrailContext(scene="chat"))
    assert review.blocked is True
    assert any(item.label in {"exam_cheating", "sensitive_word"} for item in review.issues)


@pytest.mark.asyncio
async def test_guardrail_flags_unsupported_claims() -> None:
    service = GuardrailService()
    review = await service.review_output(
        "官方已经证明唯一正确答案是 3002 端口，而且必须永久这样配置。",
        context=GuardrailContext(scene="chat", course_code="software_engineering_4th"),
        citations=["BiliLearn 项目说明", "本地课程知识库"],
    )
    assert review.hallucination_review is not None
    assert review.hallucination_review.grounded is False
    assert review.hallucination_review.unsupported_claims


@pytest.mark.asyncio
async def test_guardrail_rejects_certain_claim_without_any_source() -> None:
    service = GuardrailService()
    review = await service.review_output(
        "系统必须永久使用 3002 端口，这是唯一正确配置。",
        context=GuardrailContext(scene="chat"),
        citations=[],
    )

    assert review.hallucination_review is not None
    assert review.hallucination_review.grounded is False
    assert review.hallucination_review.evidence_sources == []
    assert review.hallucination_review.unsupported_claims
