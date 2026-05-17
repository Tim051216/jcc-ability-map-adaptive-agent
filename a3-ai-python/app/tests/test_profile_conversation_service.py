import pytest
from datetime import datetime

from app.db.models.profile_conversation import (
    ConversationMessageModel,
    ConversationSessionModel,
    ProfileHistoryModel,
    StudentProfileModel,
)
from app.services import profile_conversation_service as service_module
from app.services.profile_conversation_service import ProfileConversationService


class _FakeScalarResult:
    def __init__(self, value):
        self._value = value

    def scalar_one_or_none(self):
        return self._value

    def scalars(self):
        return self

    def all(self):
        return self._value


class _FakeAsyncSession:
    def __init__(self, session_record, messages, existing_profile=None):
        self._execute_results = [
            _FakeScalarResult(session_record),
            _FakeScalarResult(messages),
            _FakeScalarResult(existing_profile),
        ]
        self.added = []

    async def execute(self, _query):
        return self._execute_results.pop(0)

    def add(self, obj):
        self.added.append(obj)

    async def flush(self):
        for index, obj in enumerate(self.added, start=1):
            if isinstance(obj, StudentProfileModel) and getattr(obj, "id", None) is None:
                obj.id = 500 + index

    async def commit(self):
        return None

    async def refresh(self, _obj):
        return None


class _FakeHistoryAsyncSession:
    def __init__(self, profile, history_records=None):
        self._execute_results = [
            _FakeScalarResult(profile),
            _FakeScalarResult(history_records or []),
        ]
        self.added = []
        self.commits = 0

    async def execute(self, _query):
        return self._execute_results.pop(0)

    def add(self, obj):
        if getattr(obj, "id", None) is None:
            obj.id = 900 + len(self.added) + 1
        if getattr(obj, "created_at", None) is None:
            obj.created_at = datetime.now()
        self.added.append(obj)

    async def commit(self):
        self.commits += 1

    async def refresh(self, _obj):
        return None


class _FakeProfileAsyncSession:
    def __init__(self, profile):
        self._execute_results = [_FakeScalarResult(profile)]

    async def execute(self, _query):
        return self._execute_results.pop(0)


@pytest.mark.asyncio
async def test_complete_conversation_creates_history_for_first_profile(monkeypatch) -> None:
    session_record = ConversationSessionModel(
        id=101,
        user_id=1001,
        session_type=1,
        status=0,
        total_rounds=1,
        completeness=86,
    )
    messages = [
        ConversationMessageModel(
            session_id=101,
            user_id=1001,
            role="user",
            content="我学过 Python 基础，喜欢先看结构化讲解再练习。",
            round_number=1,
            message_type=1,
        )
    ]

    class _FakeGraph:
        async def ainvoke(self, state):
            assert state["session_status"] == "completed"
            return {
                **state,
                "extracted_info": {
                    "completeness": 86,
                    "missing_dimensions": [],
                    "extracted_info": [],
                },
                "built_profile": {
                    "knowledge_base": {
                        "level": "中级",
                        "background": "有一定 Python 基础",
                        "mastered_topics": ["Python基础"],
                    },
                    "cognitive_style": {
                        "preferred_format": ["文字", "实操"],
                        "learning_preference": "先讲解后练习",
                    },
                    "learning_progress": {
                        "learning_pace": "中等",
                        "completion_rate": 50,
                    },
                    "error_preference": {
                        "high_frequency_errors": ["调试卡住"],
                    },
                    "interest_direction": {
                        "interested_topics": ["数据分析"],
                        "learning_motivation": "想先打牢基础",
                    },
                    "learning_habit": {
                        "best_study_time": "晚上",
                        "weekly_hours": "4-6小时",
                    },
                    "tags": ["中级学习者", "Python基础"],
                    "summary": "测试画像摘要",
                },
            }

    monkeypatch.setattr(service_module, "profile_conversation_graph", _FakeGraph())

    fake_db = _FakeAsyncSession(session_record=session_record, messages=messages)
    service = ProfileConversationService(fake_db)

    profile = await service.complete_conversation(session_record.id)

    histories = [obj for obj in fake_db.added if isinstance(obj, ProfileHistoryModel)]

    assert profile.profile_id > 0
    assert session_record.status == 1
    assert session_record.profile_id == profile.profile_id
    assert len(histories) == 1
    assert histories[0].change_type == 1
    assert histories[0].change_description == "首次生成画像"
    assert histories[0].changed_dimensions == ",".join(service.PROFILE_DIMENSIONS)
    assert histories[0].snapshot_data["summary"] == "测试画像摘要"
    assert histories[0].profile_id == profile.profile_id


@pytest.mark.asyncio
async def test_get_profile_history_backfills_initial_record_when_missing() -> None:
    profile = StudentProfileModel(
        id=12,
        user_id=1001,
        version=1,
        knowledge_base={"level": "中级"},
        cognitive_style={"preferred_format": ["文字"]},
        learning_progress={"completion_rate": 50},
        error_preference={"high_frequency_errors": ["调试卡住"]},
        interest_direction={"interested_topics": ["数据分析"]},
        learning_habit={"best_study_time": "晚上"},
        tags=["中级学习者"],
        summary="已有画像但缺少历史",
    )
    fake_db = _FakeHistoryAsyncSession(profile=profile, history_records=[])
    service = ProfileConversationService(fake_db)

    result = await service.get_profile_history(user_id=1001, limit=10)

    assert result.total == 1
    assert len(result.history) == 1
    assert result.history[0].profile_id == profile.id
    assert result.history[0].change_type == 1
    assert result.history[0].change_description == "首次生成画像"
    assert result.history[0].changed_dimensions == service.PROFILE_DIMENSIONS
    assert fake_db.commits == 1
    assert len(fake_db.added) == 1
    assert fake_db.added[0].snapshot_data["summary"] == "已有画像但缺少历史"


@pytest.mark.asyncio
async def test_get_profile_normalizes_legacy_long_sentence_fields() -> None:
    profile = StudentProfileModel(
        id=21,
        user_id=1001,
        version=4,
        knowledge_base={
            "mastered_topics": [
                "我之前学过 Python 基础，更喜欢先看结构化讲解，再做练习。",
                "目前在入门到基础阶段，平时晚上学习，每周能投入 4 到 6 小时，容易卡在调试和算法题分析上。",
            ],
            "weak_areas": [
                "目前在入门到基础阶段，平时晚上学习，每周能投入 4 到 6 小时，容易卡在调试和算法题分析上。"
            ],
            "background": "我之前学过 Python 基础，更喜欢先看结构化讲解，再做练习。",
            "level": "中级",
        },
        cognitive_style={
            "learning_preference": ["我之前学过 Python 基础，更喜欢先看结构化讲解，再做练习。"],
            "thinking_style": "我之前学过 Python 基础，更喜欢先看结构化讲解，再做练习。",
            "comprehension_speed": "中",
            "preferred_format": ["文字", "实操"],
        },
        learning_progress={
            "current_stage": "目前在入门到基础阶段，平时晚上学习，每周能投入 4 到 6 小时，容易卡在调试和算法题分析上。",
            "completion_rate": 20,
            "learning_pace": "中",
            "weekly_hours": 6,
        },
        error_preference={
            "common_errors": ["目前在入门到基础阶段，平时晚上学习，每周能投入 4 到 6 小时，容易卡在调试和算法题分析上。"],
            "confused_concepts": ["目前在入门到基础阶段，平时晚上学习，每周能投入 4 到 6 小时，容易卡在调试和算法题分析上。"],
            "attention_points": ["目前在入门到基础阶段，平时晚上学习，每周能投入 4 到 6 小时，容易卡在调试和算法题分析上。"],
        },
        interest_direction={
            "interested_areas": ["Python基础", "数据分析", "自动化脚本", "项目实践"],
            "learning_motivation": "我对数据分析和自动化脚本更感兴趣，希望先把基础打牢，再慢慢做项目。",
            "target_level": "希望持续提升",
        },
        learning_habit={
            "best_time": "目前在入门到基础阶段，平时晚上学习，每周能投入 4 到 6 小时，容易卡在调试和算法题分析上。",
            "focus_duration": 45,
            "study_frequency": "目前在入门到基础阶段，平时晚上学习，每周能投入 4 到 6 小时，容易卡在调试和算法题分析上。",
            "study_pattern": "分散",
        },
        tags=["中级学习者"],
        completeness=100,
        summary="旧画像摘要",
    )
    service = ProfileConversationService(_FakeProfileAsyncSession(profile))

    result = await service.get_profile(user_id=1001)
    data_by_code = {item.dimension_code: item.data for item in result.dimensions}

    assert data_by_code["knowledge_base"]["mastered_topics"] == ["Python基础", "算法题分析", "调试能力"]
    assert data_by_code["knowledge_base"]["background"] == "有一定基础，接触过Python基础、算法题分析、调试能力"
    assert data_by_code["cognitive_style"]["learning_preference"] == ["先看结构化讲解，再通过练习巩固"]
    assert data_by_code["learning_progress"]["current_stage"] == "入门阶段"
    assert data_by_code["error_preference"]["common_errors"] == ["调试", "算法题分析"]
    assert data_by_code["interest_direction"]["learning_motivation"] == "先打牢基础，再逐步提升"
    assert data_by_code["learning_habit"]["best_time"] == "晚上"
    assert data_by_code["learning_habit"]["study_frequency"] == "每周约 5 小时"
