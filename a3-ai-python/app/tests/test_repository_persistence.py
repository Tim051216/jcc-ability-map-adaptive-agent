import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.db.models import ChatSession
from app.db.repositories.admin_repository import (
    AdminUserControlRepository,
    AgentRuntimeRepository,
    AuditLogRepository,
    ReviewTaskRepository,
    SystemConfigRepository,
)
from app.db.repositories.chat_ticket_repository import ChatTicketRepository
from app.db.repositories.evaluation_repository import EvaluationRepository
from app.db.repositories.evaluation_paper_repository import EvaluationPaperRepository
from app.db.repositories.plan_progress_repository import PlanProgressRepository
from app.db.repositories.profile_repository import ProfileRepository
from app.db.repositories.resource_repository import ResourceRepository


@pytest.fixture
async def db_session():
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        poolclass=StaticPool,
    )
    async with engine.begin() as conn:
        # 直接基于 ORM 元数据建表，避免依赖外部数据库环境。
        await conn.run_sync(Base.metadata.create_all)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    async with session_factory() as session:
        yield session
    await engine.dispose()


@pytest.mark.asyncio
async def test_resource_repository_filters_archive_and_favorites(db_session) -> None:
    repository = ResourceRepository()
    now = "2026-05-09T12:00:00+00:00"

    active_resource = await repository.create_resource(
        db_session,
        user_id=1001,
        course_code="PYTHON-AI",
        resource_type="mindmap",
        title="Asyncio 思维导图",
        summary="梳理事件循环",
        content_markdown="# asyncio",
        source_titles=["教材 1"],
        study_suggestion="先看主流程",
        generation_context={"scene": "practice"},
        created_at=now,
        updated_at=now,
    )
    archived_resource = await repository.create_resource(
        db_session,
        user_id=1001,
        course_code="PYTHON-AI",
        resource_type="quiz",
        title="异步测验",
        summary="配套练习",
        content_markdown="# quiz",
        source_titles=["教材 2"],
        study_suggestion=None,
        generation_context=None,
        created_at=now,
        updated_at=now,
    )
    archived_resource.is_archived = True

    await repository.create_favorite(
        db_session,
        user_id=1001,
        resource_id=active_resource.id,
        created_at=now,
        updated_at=now,
    )
    await repository.create_favorite(
        db_session,
        user_id=1001,
        resource_id=archived_resource.id,
        created_at=now,
        updated_at=now,
    )
    await repository.create_favorite_history(
        db_session,
        user_id=1001,
        resource_id=active_resource.id,
        action="favorite",
        created_at=now,
        updated_at=now,
    )
    await db_session.commit()

    visible_resources, visible_total = await repository.list_resources(
        db_session,
        user_id=1001,
        course_code="PYTHON-AI",
    )
    archived_resources, archived_total = await repository.list_resources(
        db_session,
        user_id=1001,
        archived_only=True,
    )
    favorites = await repository.list_favorites(db_session, user_id=1001)
    favorite = await repository.get_favorite(
        db_session,
        user_id=1001,
        resource_id=active_resource.id,
    )
    history = await repository.list_favorite_history(db_session, user_id=1001)

    assert visible_total == 1
    assert [item.id for item in visible_resources] == [active_resource.id]
    assert archived_total == 1
    assert [item.id for item in archived_resources] == [archived_resource.id]
    assert [item.id for item in favorites] == [active_resource.id]
    assert favorite is not None
    assert history[0].action == "favorite"

    await repository.delete_favorite(db_session, favorite)
    await db_session.commit()

    assert await repository.get_favorite(
        db_session,
        user_id=1001,
        resource_id=active_resource.id,
    ) is None


@pytest.mark.asyncio
async def test_chat_ticket_repository_filters_and_orders_replies(db_session) -> None:
    repository = ChatTicketRepository()
    now = "2026-05-09T13:00:00+00:00"
    session = ChatSession(
        user_id=1001,
        title="asyncio 问答",
        scene="study_assistant",
        created_at=now,
        updated_at=now,
    )
    db_session.add(session)
    await db_session.flush()

    closed_ticket = await repository.create_ticket(
        db_session,
        user_id=1001,
        session_id=session.id,
        course_code="PYTHON-AI",
        title="旧问题",
        question_summary="旧问题摘要",
        latest_answer=None,
        priority="normal",
        status="closed",
        created_at=now,
        updated_at=now,
    )
    open_ticket = await repository.create_ticket(
        db_session,
        user_id=1001,
        session_id=session.id,
        course_code="PYTHON-AI",
        title="新问题",
        question_summary="新问题摘要",
        latest_answer="先看事件循环",
        priority="high",
        status="open",
        created_at=now,
        updated_at=now,
    )
    await repository.create_reply(
        db_session,
        ticket_id=open_ticket.id,
        replier_name="teacherA",
        replier_role="staff",
        content="第一条回复",
        created_at=now,
        updated_at=now,
    )
    await repository.create_reply(
        db_session,
        ticket_id=open_ticket.id,
        replier_name="teacherB",
        replier_role="staff",
        content="第二条回复",
        created_at=now,
        updated_at=now,
    )
    await db_session.commit()

    open_tickets, open_total = await repository.list_tickets(
        db_session,
        user_id=1001,
        status="open",
    )
    all_tickets, all_total = await repository.list_tickets(db_session, user_id=1001)
    replies = await repository.list_replies(db_session, ticket_id=open_ticket.id)

    assert open_total == 1
    assert open_tickets[0].id == open_ticket.id
    assert all_total == 2
    assert [item.id for item in all_tickets] == [open_ticket.id, closed_ticket.id]
    assert [item.content for item in replies] == ["第一条回复", "第二条回复"]


@pytest.mark.asyncio
async def test_admin_repositories_support_filtering_and_upsert(db_session) -> None:
    review_repository = ReviewTaskRepository()
    audit_repository = AuditLogRepository()
    config_repository = SystemConfigRepository()
    runtime_repository = AgentRuntimeRepository()
    control_repository = AdminUserControlRepository()
    now = "2026-05-09T14:00:00+00:00"

    await review_repository.create_task(
        db_session,
        entity_type="resource",
        entity_id=11,
        source_scene="resource_generate",
        priority="high",
        status="pending",
        submitted_content="微积分错题讲解",
        reviewer_name=None,
        decision_note=None,
        created_at=now,
        updated_at=now,
    )
    approved_task = await review_repository.create_task(
        db_session,
        entity_type="resource",
        entity_id=12,
        source_scene="resource_generate",
        priority="normal",
        status="approved",
        submitted_content="Python 协程总结",
        reviewer_name="adminA",
        decision_note="内容准确",
        created_at=now,
        updated_at=now,
    )
    await audit_repository.create_log(
        db_session,
        trace_id="trace-1",
        scene="system_config",
        action="system_config_updated",
        payload={"config_key": "llm.provider"},
        created_at=now,
        updated_at=now,
    )
    await audit_repository.create_log(
        db_session,
        trace_id="trace-2",
        scene="review_task",
        action="review_task_approved",
        payload={"review_id": approved_task.id},
        created_at=now,
        updated_at=now,
    )
    await config_repository.upsert_config(
        db_session,
        config_key="llm.provider",
        config_value="mock",
        description="provider",
        updated_by="adminA",
        created_at=now,
        updated_at=now,
    )
    updated_config = await config_repository.upsert_config(
        db_session,
        config_key="llm.provider",
        config_value="dashscope",
        description="provider",
        updated_by="adminB",
        created_at=now,
        updated_at="2026-05-09T14:05:00+00:00",
    )
    await runtime_repository.create_log(
        db_session,
        agent_name="planner",
        level="warning",
        status="degraded",
        message="fallback",
        payload={"source": "mock"},
        created_at=now,
        updated_at=now,
    )
    first_control = await control_repository.upsert_user_control(
        db_session,
        user_id=1001,
        status="active",
        reason=None,
        updated_by="adminA",
        created_at=now,
        updated_at=now,
    )
    updated_control = await control_repository.upsert_user_control(
        db_session,
        user_id=1001,
        status="suspended",
        reason="异常流量",
        updated_by="adminB",
        created_at=now,
        updated_at="2026-05-09T14:10:00+00:00",
    )
    await db_session.commit()

    approved_tasks, approved_total = await review_repository.list_tasks(
        db_session,
        status="approved",
        reviewer_name="adminA",
        keyword="协程",
    )
    by_ids = await review_repository.list_tasks_by_ids(db_session, [approved_task.id, 999])
    config = await config_repository.get_by_key(db_session, "llm.provider")
    configs = await config_repository.list_configs(db_session)
    review_logs, review_log_total = await audit_repository.list_logs(db_session, scene="review_task")
    runtime_logs, runtime_total = await runtime_repository.list_logs(
        db_session,
        agent_name="planner",
        level="warning",
    )
    control = await control_repository.get_by_user_id(db_session, 1001)

    assert approved_total == 1
    assert approved_tasks[0].id == approved_task.id
    assert [item.id for item in by_ids] == [approved_task.id]
    assert config is not None
    assert config.config_value == "dashscope"
    assert updated_config.id == configs[0].id
    assert review_log_total == 1
    assert review_logs[0].action == "review_task_approved"
    assert runtime_total == 1
    assert runtime_logs[0].status == "degraded"
    assert first_control.id == updated_control.id
    assert control is not None
    assert control.status == "suspended"
    assert control.reason == "异常流量"


@pytest.mark.asyncio
async def test_plan_progress_repository_upsert_and_query_steps(db_session) -> None:
    repository = PlanProgressRepository()
    now = "2026-05-09T15:00:00+00:00"

    first_step = await repository.upsert_step(
        db_session,
        plan_id=501,
        user_id=1001,
        step_id="step-1",
        status="pending",
        last_action="created",
        progress_note="待开始",
        created_at=now,
        updated_at=now,
    )
    updated_step = await repository.upsert_step(
        db_session,
        plan_id=501,
        user_id=1001,
        step_id="step-1",
        status="completed",
        last_action="finished",
        progress_note="已完成",
        created_at=now,
        updated_at="2026-05-09T15:05:00+00:00",
    )
    await repository.upsert_step(
        db_session,
        plan_id=501,
        user_id=1001,
        step_id="step-2",
        status="processing",
        last_action="resumed",
        progress_note="进行中",
        created_at=now,
        updated_at=now,
    )
    await db_session.commit()

    current = await repository.get_by_step(
        db_session,
        plan_id=501,
        user_id=1001,
        step_id="step-1",
    )
    items = await repository.list_by_plan_user(
        db_session,
        plan_id=501,
        user_id=1001,
    )

    assert first_step.id == updated_step.id
    assert current is not None
    assert current.status == "completed"
    assert [item.step_id for item in items] == ["step-1", "step-2"]


@pytest.mark.asyncio
async def test_profile_repository_returns_latest_snapshot(db_session) -> None:
    repository = ProfileRepository()
    now = "2026-05-09T16:00:00+00:00"

    await repository.create_snapshot(
        db_session,
        user_id=1001,
        version=1,
        profile_data={"style": "visual"},
        source_summary="首版画像",
        created_at=now,
        updated_at=now,
    )
    latest_snapshot = await repository.create_snapshot(
        db_session,
        user_id=1001,
        version=2,
        profile_data={"style": "project"},
        source_summary="行为回流后更新",
        created_at=now,
        updated_at="2026-05-09T16:05:00+00:00",
    )
    await db_session.commit()

    current = await repository.latest_by_user(db_session, 1001)

    assert current is not None
    assert current.id == latest_snapshot.id
    assert current.version == 2
    assert current.profile_data["style"] == "project"

    history = await repository.list_by_user(db_session, 1001, limit=5)
    assert [item.version for item in history] == [2, 1]


@pytest.mark.asyncio
async def test_evaluation_paper_repository_returns_only_wrong_answers(db_session) -> None:
    repository = EvaluationPaperRepository()
    now = "2026-05-09T17:00:00+00:00"

    paper = await repository.create_paper(
        db_session,
        user_id=1001,
        course_code="MATH-AI",
        paper_type="diagnostic",
        status="submitted",
        questions_data=[{"id": "q1"}, {"id": "q2"}],
        created_at=now,
        updated_at=now,
    )
    await repository.create_answer(
        db_session,
        paper_id=paper.id,
        user_id=1001,
        question_id="q1",
        question_type="single_choice",
        prompt="1+1=?",
        knowledge_point="加法",
        user_answer="3",
        correct_answer="2",
        is_correct=False,
        explanation="基础计算错误",
        created_at=now,
        updated_at=now,
    )
    await repository.create_answer(
        db_session,
        paper_id=paper.id,
        user_id=1001,
        question_id="q2",
        question_type="single_choice",
        prompt="2+2=?",
        knowledge_point="加法",
        user_answer="4",
        correct_answer="4",
        is_correct=True,
        explanation="回答正确",
        created_at=now,
        updated_at=now,
    )
    await db_session.commit()

    wrong_answers = await repository.list_wrong_answers_by_paper(
        db_session,
        paper_id=paper.id,
        user_id=1001,
    )

    assert len(wrong_answers) == 1
    assert wrong_answers[0].question_id == "q1"
    assert wrong_answers[0].is_correct is False


@pytest.mark.asyncio
async def test_evaluation_repository_lists_history_by_user_course(db_session) -> None:
    repository = EvaluationRepository()
    now = "2026-05-09T18:00:00+00:00"

    await repository.create_record(
        db_session,
        user_id=1001,
        course_code="PYTHON-AI",
        evaluation_type="diagnostic",
        result_data={"overall_score": 76, "evaluation_type": "diagnostic"},
        created_at=now,
        updated_at=now,
    )
    await repository.create_record(
        db_session,
        user_id=1001,
        course_code="PYTHON-AI",
        evaluation_type="paper_submission",
        result_data={"overall_score": 88, "evaluation_type": "paper_submission"},
        created_at=now,
        updated_at=now,
    )
    await repository.create_record(
        db_session,
        user_id=1001,
        course_code="JAVA-CORE",
        evaluation_type="diagnostic",
        result_data={"overall_score": 92, "evaluation_type": "diagnostic"},
        created_at=now,
        updated_at=now,
    )
    await db_session.commit()

    items = await repository.list_by_user_course(
        db_session,
        user_id=1001,
        course_code="PYTHON-AI",
        limit=5,
    )
    filtered = await repository.list_by_user_course(
        db_session,
        user_id=1001,
        course_code="PYTHON-AI",
        evaluation_type="diagnostic",
        limit=5,
    )

    assert [item.evaluation_type for item in items] == ["paper_submission", "diagnostic"]
    assert len(filtered) == 1
    assert filtered[0].evaluation_type == "diagnostic"


@pytest.mark.asyncio
async def test_resource_repository_increments_download_count(db_session) -> None:
    repository = ResourceRepository()
    now = "2026-05-09T19:00:00+00:00"

    resource = await repository.create_resource(
        db_session,
        user_id=1001,
        course_code="PYTHON-AI",
        resource_type="lecture_note",
        title="Asyncio 笔记",
        summary="事件循环概览",
        content_markdown="# Note\n\nline1\nline2",
        source_titles=["chapter-1"],
        study_suggestion="先看总览",
        generation_context=None,
        created_at=now,
        updated_at=now,
    )
    await repository.increment_download_count(db_session, resource=resource, updated_at="2026-05-09T19:05:00+00:00")
    await db_session.commit()

    reloaded = await repository.get_resource(db_session, resource.id)

    assert reloaded is not None
    assert reloaded.download_count == 1
