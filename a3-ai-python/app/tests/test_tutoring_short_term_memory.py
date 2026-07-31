from datetime import datetime, timedelta
from types import SimpleNamespace

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.core.config import settings
from app.db.models.tutoring import (
    TutoringAnswer,
    TutoringQuestion,
    TutoringSession,
    TutoringSessionMemory,
)
from app.services.tutoring_short_term_memory_service import TutoringShortTermMemoryService


class _SummaryLLM:
    def __init__(self) -> None:
        self.calls = 0

    async def chat_completion(self, **_kwargs):
        self.calls += 1
        message = SimpleNamespace(content="用户正在学习需求分析，偏好结构化说明。")
        return SimpleNamespace(choices=[SimpleNamespace(message=message)])


async def _seed_turns(session, count: int = 6) -> None:
    now = datetime.now()
    session.add(
        TutoringSession(
            id=100,
            user_id=1001,
            course_id=1,
            section_id=1,
            session_status=0,
            question_count=count,
            start_time=now,
            create_time=now,
            update_time=now,
        )
    )
    for index in range(1, count + 1):
        created = now + timedelta(seconds=index)
        session.add(
            TutoringQuestion(
                id=index,
                session_id=100,
                user_id=1001,
                course_id=1,
                section_id=1,
                question_text=f"第{index}轮问题：" + "需求分析" * 20,
                question_status=1,
                has_answer=True,
                is_escalated=False,
                create_time=created,
                update_time=created,
            )
        )
        session.add(
            TutoringAnswer(
                id=1000 + index,
                question_id=index,
                session_id=100,
                answer_text=f"第{index}轮回答：" + "结构化解释" * 20,
                create_time=created,
                update_time=created,
            )
        )
    await session.commit()


async def _create_database():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as connection:
        await connection.run_sync(TutoringSession.__table__.create)
        await connection.run_sync(TutoringQuestion.__table__.create)
        await connection.run_sync(TutoringAnswer.__table__.create)
        await connection.run_sync(TutoringSessionMemory.__table__.create)
    return engine, async_sessionmaker(engine, expire_on_commit=False)


@pytest.mark.asyncio
async def test_memory_summarizes_old_turns_and_persists_recent_window(monkeypatch) -> None:
    monkeypatch.setattr(settings, "tutoring_memory_max_tokens", 420)
    monkeypatch.setattr(settings, "tutoring_memory_trigger_ratio", 0.5)
    monkeypatch.setattr(settings, "tutoring_memory_recent_turns", 3)
    monkeypatch.setattr(settings, "tutoring_memory_summary_max_tokens", 80)
    engine, factory = await _create_database()
    llm = _SummaryLLM()

    async with factory() as session:
        await _seed_turns(session)
        context = await TutoringShortTermMemoryService(session, llm).build_context(
            session_id=100, user_id=1001
        )
        memory = (
            await session.execute(select(TutoringSessionMemory))
        ).scalar_one()

    assert llm.calls == 1
    assert memory.summarized_through_question_id == 3
    assert "用户正在学习需求分析" in context
    assert all(f"第{index}轮问题" in context for index in (4, 5, 6))
    assert "第1轮问题" not in context
    assert TutoringShortTermMemoryService.estimate_tokens(context) <= 420

    async with factory() as new_session:
        second_context = await TutoringShortTermMemoryService(new_session, llm).build_context(
            session_id=100, user_id=1001
        )
    assert llm.calls == 1
    assert "用户正在学习需求分析" in second_context
    assert "第6轮问题" in second_context
    await engine.dispose()


@pytest.mark.asyncio
async def test_memory_uses_deterministic_fallback_when_summary_llm_fails(monkeypatch) -> None:
    class _FailingLLM:
        async def chat_completion(self, **_kwargs):
            raise RuntimeError("model unavailable")

    monkeypatch.setattr(settings, "tutoring_memory_max_tokens", 360)
    monkeypatch.setattr(settings, "tutoring_memory_trigger_ratio", 0.5)
    monkeypatch.setattr(settings, "tutoring_memory_recent_turns", 3)
    monkeypatch.setattr(settings, "tutoring_memory_summary_max_tokens", 100)
    engine, factory = await _create_database()

    async with factory() as session:
        await _seed_turns(session)
        context = await TutoringShortTermMemoryService(session, _FailingLLM()).build_context(
            session_id=100, user_id=1001
        )

    assert "历史摘要" in context
    assert "第4轮问题" in context
    assert TutoringShortTermMemoryService.estimate_tokens(context) <= 360
    await engine.dispose()
