import pytest

from app.services.chat_service import ChatService


@pytest.mark.asyncio
async def test_chat_falls_back_when_live_chat_raises(monkeypatch) -> None:
    service = ChatService()

    async def fake_chat_live(request):
        raise RuntimeError("graph unavailable")

    async def fake_search(self, request):
        return type(
            "RagResponse",
            (),
            {
                "hits": [
                    type(
                        "Hit",
                        (),
                        {
                            "model_dump": lambda self: {
                                "chunk_id": 1,
                                "title": "Asyncio 基础",
                                "content": "事件循环负责调度协程执行。",
                                "score": 0.91,
                            }
                        },
                    )()
                ]
            },
        )()

    async def fake_answer_with_context(self, question: str, course_name: str, context_chunks: list[dict]):
        assert question == "asyncio"
        assert context_chunks[0]["title"] == "Asyncio 基础"
        return "基于知识库，事件循环负责调度协程执行。"

    monkeypatch.setattr("app.services.chat_service.RagService.search", fake_search)
    monkeypatch.setattr("app.services.chat_service.AnswerService.answer_with_context", fake_answer_with_context)
    monkeypatch.setattr(service, "_chat_live", fake_chat_live)

    response = await service.chat(type("Request", (), {"message": "asyncio", "course_code": "PYTHON-AI", "scene": "study_assistant"})())

    assert "事件循环" in response.answer
    assert response.intent == "study_assistant"
    assert len(response.agent_trace) >= 1
    assert response.citations[0].source == "Asyncio 基础"


@pytest.mark.asyncio
async def test_chat_uses_static_fallback_when_contextual_fallback_fails(monkeypatch) -> None:
    service = ChatService()

    async def fake_chat_live(request):
        raise RuntimeError("graph unavailable")

    async def fake_search(self, request):
        raise RuntimeError("rag unavailable")

    monkeypatch.setattr("app.services.chat_service.RagService.search", fake_search)
    monkeypatch.setattr(service, "_chat_live", fake_chat_live)

    response = await service.chat(type("Request", (), {"message": "asyncio", "course_code": "PYTHON-AI", "scene": "study_assistant"})())

    assert "asyncio" in response.answer
    assert response.generated_plan is not None
    assert len(response.generated_resources) == 2


def test_build_fallback_response_contains_plan_resources_and_evaluation() -> None:
    request = type(
        "Request",
        (),
        {"message": "machine learning basics", "course_code": "ML-101", "scene": "study_assistant"},
    )()

    response = ChatService()._build_fallback_response(request)

    assert response.intent == "study_assistant"
    assert response.generated_plan is not None
    assert len(response.generated_resources) == 2
    assert response.generated_evaluation is not None
    assert response.citations[0].source == "ML-101"
