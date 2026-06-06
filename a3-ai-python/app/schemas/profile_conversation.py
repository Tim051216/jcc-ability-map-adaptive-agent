"""
对话式画像相关 Schema
"""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field, field_validator


def _normalize_completeness_value(value: Any) -> int:
    try:
        numeric = float(value or 0)
    except (TypeError, ValueError):
        numeric = 0.0
    if 0 < numeric <= 1:
        numeric *= 100
    return max(0, min(100, int(round(numeric))))


class ConversationStartRequest(BaseModel):
    user_id: int = Field(..., description="用户 ID")
    session_type: int = Field(default=1, description="会话类型")


class ConversationMessageRequest(BaseModel):
    session_id: int = Field(..., description="会话 ID")
    content: str = Field(..., min_length=1, max_length=2000, description="消息内容")


class ConversationMessageResponse(BaseModel):
    message_id: int = Field(..., description="消息 ID")
    role: str = Field(..., description="角色")
    content: str = Field(..., description="消息内容")
    round_number: int = Field(..., description="轮次")
    message_type: int = Field(..., description="消息类型")
    related_dimension: str | None = Field(None, description="相关维度")
    created_at: datetime = Field(..., description="创建时间")


class ConversationSessionResponse(BaseModel):
    session_id: int = Field(..., description="会话 ID")
    user_id: int = Field(..., description="用户 ID")
    status: int = Field(..., description="会话状态")
    session_type: int = Field(..., description="会话类型")
    total_rounds: int = Field(..., description="总轮次")
    collected_dimensions: list[str] = Field(default_factory=list, description="已采集维度")
    completeness: int = Field(..., description="完整度")
    start_time: datetime = Field(..., description="开始时间")
    end_time: datetime | None = Field(None, description="结束时间")
    messages: list[ConversationMessageResponse] = Field(default_factory=list, description="消息列表")

    @field_validator("completeness", mode="before")
    @classmethod
    def normalize_completeness(cls, value: Any) -> int:
        return _normalize_completeness_value(value)


class ConversationCompleteRequest(BaseModel):
    session_id: int = Field(..., description="会话 ID")
    force_complete: bool = Field(default=False, description="是否强制完成")


class ExtractedInfoItem(BaseModel):
    dimension: str = Field(..., description="所属维度")
    info_key: str = Field(..., description="信息键")
    info_value: str = Field(..., description="信息值")
    confidence: float = Field(..., ge=0.0, le=1.0, description="置信度")


class ExtractionResult(BaseModel):
    extracted_info: list[ExtractedInfoItem] = Field(default_factory=list, description="提取信息")
    missing_dimensions: list[str] = Field(default_factory=list, description="缺失维度")
    completeness: int = Field(..., ge=0, le=100, description="完整度")

    @field_validator("completeness", mode="before")
    @classmethod
    def normalize_completeness(cls, value: Any) -> int:
        return _normalize_completeness_value(value)


class ProfileDimensionData(BaseModel):
    dimension_code: str = Field(..., description="维度编码")
    dimension_name: str = Field(..., description="维度名称")
    data: dict[str, Any] = Field(default_factory=dict, description="维度数据")
    completeness: int = Field(default=0, ge=0, le=100, description="维度完整度")
    sources: list[str] = Field(default_factory=list, description="维度来源")

    @field_validator("completeness", mode="before")
    @classmethod
    def normalize_completeness(cls, value: Any) -> int:
        return _normalize_completeness_value(value)


class StudentProfileDetail(BaseModel):
    profile_id: int | None = Field(None, description="画像 ID")
    user_id: int = Field(..., description="用户 ID")
    version: int = Field(default=1, description="版本号")
    dimensions: list[ProfileDimensionData] = Field(default_factory=list, description="维度数据")
    tags: list[str] = Field(default_factory=list, description="标签")
    completeness: int = Field(default=0, ge=0, le=100, description="画像完整度")
    summary: str | None = Field(None, description="画像摘要")
    created_at: datetime | None = Field(None, description="创建时间")
    updated_at: datetime | None = Field(None, description="更新时间")
    score_breakdown: dict[str, int] = Field(default_factory=dict, description="能力评分")
    latest_evaluation_diff: dict[str, dict[str, Any]] = Field(default_factory=dict, description="最近测评影响差异")

    @field_validator("completeness", mode="before")
    @classmethod
    def normalize_completeness(cls, value: Any) -> int:
        return _normalize_completeness_value(value)


class ProfileSummary(BaseModel):
    profile_id: int | None = Field(None, description="画像 ID")
    user_id: int = Field(..., description="用户 ID")
    completeness: int = Field(..., description="完整度")
    tags: list[str] = Field(default_factory=list, description="标签")
    key_features: str | None = Field(None, description="关键特征")
    dimension_completeness: dict[str, int] = Field(default_factory=dict, description="维度完整度")
    dimension_sources: dict[str, list[str]] = Field(default_factory=dict, description="维度来源")
    recommended_learning_style: str | None = Field(None, description="推荐学习方式")
    current_stage: str | None = Field(None, description="当前阶段")
    score_breakdown: dict[str, int] = Field(default_factory=dict, description="能力评分")
    latest_evaluation_diff: dict[str, dict[str, Any]] = Field(default_factory=dict, description="最近测评影响差异")

    @field_validator("completeness", mode="before")
    @classmethod
    def normalize_completeness(cls, value: Any) -> int:
        return _normalize_completeness_value(value)


class ProfileAdjustRequest(BaseModel):
    user_id: int = Field(..., description="用户 ID")
    dimension_code: str = Field(..., description="维度编码")
    adjust_data: dict[str, Any] = Field(..., description="调整数据")
    reason: str | None = Field(None, description="调整原因")


class BehaviorDataRequest(BaseModel):
    user_id: int = Field(..., description="用户 ID")
    behavior_type: int = Field(..., description="行为类型")
    behavior_data: dict[str, Any] = Field(..., description="行为数据")
    resource_type: str | None = Field(None, description="资源类型")
    resource_id: int | None = Field(None, description="资源 ID")
    result: str | None = Field(None, description="行为结果")
    duration: int | None = Field(None, description="行为时长")


class ProfileUpdateResult(BaseModel):
    updated_dimensions: dict[str, dict[str, Any]] = Field(default_factory=dict, description="更新维度")
    new_tags: list[str] = Field(default_factory=list, description="新增标签")
    removed_tags: list[str] = Field(default_factory=list, description="移除标签")
    summary: str = Field(..., description="更新摘要")
    before_summary: dict[str, Any] = Field(default_factory=dict, description="更新前摘要")
    after_summary: dict[str, Any] = Field(default_factory=dict, description="更新后摘要")
    latest_evaluation_diff: dict[str, dict[str, Any]] = Field(default_factory=dict, description="最近测评影响差异")


class ProfileHistoryItem(BaseModel):
    history_id: int = Field(..., description="历史记录 ID")
    profile_id: int = Field(..., description="画像 ID")
    version: int = Field(..., description="版本号")
    change_type: int = Field(..., description="变更类型")
    change_description: str | None = Field(None, description="变更描述")
    changed_dimensions: list[str] = Field(default_factory=list, description="变更维度")
    created_at: datetime = Field(..., description="创建时间")


class ProfileHistoryResponse(BaseModel):
    user_id: int = Field(..., description="用户 ID")
    profile_id: int = Field(..., description="画像 ID")
    history: list[ProfileHistoryItem] = Field(default_factory=list, description="历史记录")
    total: int = Field(default=0, description="总数")


class GuideQuestionResponse(BaseModel):
    question: str = Field(..., description="引导问题")
    related_dimension: str | None = Field(None, description="相关维度")
    question_type: int = Field(default=2, description="问题类型")
    suggestions: list[str] = Field(default_factory=list, description="建议答案")


class ConversationFlowResponse(BaseModel):
    session_id: int = Field(..., description="会话 ID")
    assistant_message: ConversationMessageResponse = Field(..., description="助手消息")
    guide_question: GuideQuestionResponse | None = Field(None, description="引导问题")
    extraction_result: ExtractionResult | None = Field(None, description="提取结果")
    profile_summary: ProfileSummary | None = Field(None, description="画像摘要")
    should_continue: bool = Field(..., description="是否继续")
    completeness: int = Field(..., description="当前完整度")

    @field_validator("completeness", mode="before")
    @classmethod
    def normalize_completeness(cls, value: Any) -> int:
        return _normalize_completeness_value(value)
