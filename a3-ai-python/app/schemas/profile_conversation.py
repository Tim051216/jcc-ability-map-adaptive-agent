"""
对话式画像构建相关的Pydantic Schema
"""

from datetime import datetime

from pydantic import BaseModel, Field


# ============================================
# 对话会话相关Schema
# ============================================


class ConversationStartRequest(BaseModel):
    """开始对话会话请求"""

    user_id: int = Field(..., description="用户ID")
    session_type: int = Field(default=1, description="会话类型：1-初始构建，2-补充，3-验证")


class ConversationMessageRequest(BaseModel):
    """发送对话消息请求"""

    session_id: int = Field(..., description="会话ID")
    content: str = Field(..., min_length=1, max_length=2000, description="消息内容")


class ConversationMessageResponse(BaseModel):
    """对话消息响应"""

    message_id: int = Field(..., description="消息ID")
    role: str = Field(..., description="角色")
    content: str = Field(..., description="消息内容")
    round_number: int = Field(..., description="对话轮次")
    message_type: int = Field(..., description="消息类型")
    related_dimension: str | None = Field(None, description="相关维度")
    created_at: datetime = Field(..., description="创建时间")


class ConversationSessionResponse(BaseModel):
    """对话会话响应"""

    session_id: int = Field(..., description="会话ID")
    user_id: int = Field(..., description="用户ID")
    status: int = Field(..., description="会话状态")
    session_type: int = Field(..., description="会话类型")
    total_rounds: int = Field(..., description="总对话轮次")
    collected_dimensions: list[str] = Field(default_factory=list, description="已采集维度")
    completeness: int = Field(..., description="完整度")
    start_time: datetime = Field(..., description="开始时间")
    end_time: datetime | None = Field(None, description="结束时间")
    messages: list[ConversationMessageResponse] = Field(
        default_factory=list, description="对话消息列表"
    )


class ConversationCompleteRequest(BaseModel):
    """完成对话会话请求"""

    session_id: int = Field(..., description="会话ID")
    force_complete: bool = Field(default=False, description="是否强制完成")


# ============================================
# 信息提取相关Schema
# ============================================


class ExtractedInfoItem(BaseModel):
    """提取的信息项"""

    dimension: str = Field(..., description="所属维度")
    info_key: str = Field(..., description="信息键")
    info_value: str = Field(..., description="信息值")
    confidence: float = Field(..., ge=0.0, le=1.0, description="置信度")


class ExtractionResult(BaseModel):
    """信息提取结果"""

    extracted_info: list[ExtractedInfoItem] = Field(
        default_factory=list, description="提取的信息列表"
    )
    missing_dimensions: list[str] = Field(default_factory=list, description="缺失的维度")
    completeness: int = Field(..., ge=0, le=100, description="完整度")


# ============================================
# 画像构建相关Schema
# ============================================


class ProfileDimensionData(BaseModel):
    """画像维度数据"""

    dimension_code: str = Field(..., description="维度代码")
    dimension_name: str = Field(..., description="维度名称")
    data: dict = Field(default_factory=dict, description="维度数据")
    completeness: int = Field(default=0, ge=0, le=100, description="维度完整度")


class StudentProfileDetail(BaseModel):
    """学生画像详情"""

    profile_id: int | None = Field(None, description="画像ID")
    user_id: int = Field(..., description="用户ID")
    version: int = Field(default=1, description="版本号")
    dimensions: list[ProfileDimensionData] = Field(
        default_factory=list, description="六维度数据"
    )
    tags: list[str] = Field(default_factory=list, description="学习标签")
    completeness: int = Field(default=0, ge=0, le=100, description="画像完整度")
    summary: str | None = Field(None, description="画像摘要")
    created_at: datetime | None = Field(None, description="创建时间")
    updated_at: datetime | None = Field(None, description="更新时间")


class ProfileSummary(BaseModel):
    """画像摘要"""

    profile_id: int | None = Field(None, description="画像ID")
    user_id: int = Field(..., description="用户ID")
    completeness: int = Field(..., description="完整度")
    tags: list[str] = Field(default_factory=list, description="学习标签")
    key_features: str | None = Field(None, description="关键特征")
    dimension_completeness: dict[str, int] = Field(
        default_factory=dict, description="各维度完整度"
    )
    recommended_learning_style: str | None = Field(None, description="推荐学习方式")
    current_stage: str | None = Field(None, description="当前学习阶段")


# ============================================
# 画像更新相关Schema
# ============================================


class ProfileAdjustRequest(BaseModel):
    """画像手动调整请求"""

    user_id: int = Field(..., description="用户ID")
    dimension_code: str = Field(..., description="维度代码")
    adjust_data: dict = Field(..., description="调整的数据")
    reason: str | None = Field(None, description="调整原因")


class BehaviorDataRequest(BaseModel):
    """学习行为数据上报请求"""

    user_id: int = Field(..., description="用户ID")
    behavior_type: int = Field(..., description="行为类型")
    behavior_data: dict = Field(..., description="行为详细数据")
    resource_type: str | None = Field(None, description="资源类型")
    resource_id: int | None = Field(None, description="资源ID")
    result: str | None = Field(None, description="行为结果")
    duration: int | None = Field(None, description="行为时长（秒）")


class ProfileUpdateResult(BaseModel):
    """画像更新结果"""

    updated_dimensions: dict[str, dict] = Field(
        default_factory=dict, description="更新的维度"
    )
    new_tags: list[str] = Field(default_factory=list, description="新增标签")
    removed_tags: list[str] = Field(default_factory=list, description="移除标签")
    summary: str = Field(..., description="更新摘要")


# ============================================
# 画像历史相关Schema
# ============================================


class ProfileHistoryItem(BaseModel):
    """画像历史记录项"""

    history_id: int = Field(..., description="历史记录ID")
    profile_id: int = Field(..., description="画像ID")
    version: int = Field(..., description="版本号")
    change_type: int = Field(..., description="变更类型")
    change_description: str | None = Field(None, description="变更描述")
    changed_dimensions: list[str] = Field(default_factory=list, description="变更的维度")
    created_at: datetime = Field(..., description="创建时间")


class ProfileHistoryResponse(BaseModel):
    """画像历史响应"""

    user_id: int = Field(..., description="用户ID")
    profile_id: int = Field(..., description="画像ID")
    history: list[ProfileHistoryItem] = Field(default_factory=list, description="历史记录")
    total: int = Field(default=0, description="总记录数")


# ============================================
# 引导问题相关Schema
# ============================================


class GuideQuestionResponse(BaseModel):
    """引导问题响应"""

    question: str = Field(..., description="引导问题")
    related_dimension: str | None = Field(None, description="相关维度")
    question_type: int = Field(default=2, description="问题类型")
    suggestions: list[str] = Field(default_factory=list, description="回答建议")


# ============================================
# 对话流程响应Schema
# ============================================


class ConversationFlowResponse(BaseModel):
    """对话流程响应（包含助手回复和引导问题）"""

    session_id: int = Field(..., description="会话ID")
    assistant_message: ConversationMessageResponse = Field(..., description="助手消息")
    guide_question: GuideQuestionResponse | None = Field(None, description="引导问题")
    extraction_result: ExtractionResult | None = Field(None, description="信息提取结果")
    profile_summary: ProfileSummary | None = Field(None, description="画像摘要")
    should_continue: bool = Field(..., description="是否应该继续对话")
    completeness: int = Field(..., description="当前完整度")
