import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.db.models.evaluation_test import EvaluationKnowledgeMastery
from app.services.evaluation_agent_service import EvaluationAgentService


@pytest.fixture
async def db_session():
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        poolclass=StaticPool,
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    async with session_factory() as session:
        yield session
    await engine.dispose()


@pytest.mark.asyncio
async def test_persist_knowledge_mastery_upserts_existing_record(db_session) -> None:
    service = EvaluationAgentService()

    first = {
        "knowledge_mastery": {
            "knowledge_points": [
                {
                    "knowledge_point": "recursion",
                    "mastery_level": 2,
                    "mastery_score": 0.65,
                    "total_questions": 5,
                    "correct_count": 3,
                    "accuracy_rate": 0.6,
                }
            ]
        }
    }
    second = {
        "knowledge_mastery": {
            "knowledge_points": [
                {
                    "knowledge_point": "recursion",
                    "mastery_level": 3,
                    "mastery_score": 0.9,
                    "total_questions": 8,
                    "correct_count": 7,
                    "accuracy_rate": 0.875,
                }
            ]
        }
    }

    await service._persist_knowledge_mastery_to_db(
        db=db_session,
        user_id=1001,
        course_id=2001,
        assessment_result=first,
    )
    await service._persist_knowledge_mastery_to_db(
        db=db_session,
        user_id=1001,
        course_id=2001,
        assessment_result=second,
    )

    result = await db_session.execute(
        select(EvaluationKnowledgeMastery).where(
            EvaluationKnowledgeMastery.user_id == 1001,
            EvaluationKnowledgeMastery.course_id == 2001,
            EvaluationKnowledgeMastery.knowledge_point == "recursion",
        )
    )
    rows = list(result.scalars().all())

    assert len(rows) == 1
    assert rows[0].mastery_level == 3
    assert float(rows[0].mastery_score) == 0.9
    assert rows[0].practice_count == 8
    assert rows[0].correct_count == 7
