"""
智能辅导系统 Pydantic Schema
"""
from datetime import datetime
from decimal import Decimal
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.guardrails import HallucinationReview, SafetyReview


# ==================== OCR 预览 ====================


class OcrPreviewRequest(BaseModel):
    """图片 OCR 预览（辅导问题输入辅助）"""

    image_base64: str = Field(..., description="Base64 或 data:image/...;base64,...")

    @field_validator("image_base64")
    @classmethod
    def strip_and_limit(cls, v: str) -> str:
        s = (v or "").strip()
        if len(s) > 12_000_000:
            raise ValueError("图片编码过长")
        return s


class OcrPreviewResponse(BaseModel):
    """OCR 结果"""

    text: str = Field("", description="识别出的文字")
    engine: str = Field(..., description="tesseract 或 none（未启用引擎）")
    hint: str = Field("", description="说明或安装提示")


class TutoringImageUploadResponse(BaseModel):
    """辅导配图上传结果（写入 question_images）"""

    url: str = Field(..., description="图片访问 URL（对象存储或预签名）")
    extracted_text: Optional[str] = Field(None, description="从附件中提取出的文本内容")


# ==================== 会话相关 ====================


class TutoringSessionBase(BaseModel):
    """会话基础模型"""
    user_id: int = Field(..., description="学生ID")
    course_id: Optional[int] = Field(None, description="关联课程ID")
    section_id: Optional[int] = Field(None, description="关联章节ID")


class TutoringSessionCreate(TutoringSessionBase):
    """创建会话请求"""
    pass


class TutoringSessionResponse(TutoringSessionBase):
    """会话响应"""
    model_config = ConfigDict(from_attributes=True)

    id: int
    session_status: int = Field(..., description="会话状态：0-进行中，1-已结束，2-已升级")
    question_count: int = Field(0, description="问题数量")
    start_time: datetime
    end_time: Optional[datetime] = None
    create_time: datetime
    update_time: datetime


# ==================== 问题相关 ====================

class TutoringQuestionBase(BaseModel):
    """问题基础模型"""
    question_text: str = Field(..., description="问题文字内容")
    question_images: Optional[list[str]] = Field(None, description="问题图片URL列表")
    course_id: Optional[int] = Field(None, description="关联课程ID")
    section_id: Optional[int] = Field(None, description="关联章节ID")


class TutoringQuestionCreate(TutoringQuestionBase):
    """创建问题请求"""
    session_id: Optional[int] = Field(None, description="会话ID，如果为空则创建新会话")
    persona: Optional[str] = Field(None, description="导师人设标识，如 haibara / usagi")


class TutoringQuestionResponse(TutoringQuestionBase):
    """问题响应"""
    model_config = ConfigDict(from_attributes=True)

    id: int
    session_id: int
    user_id: int
    persona: Optional[str] = None
    question_type: Optional[str] = None
    knowledge_points: Optional[list[str]] = None
    difficulty_level: Optional[int] = None
    question_status: int = Field(..., description="问题状态：0-待处理，1-已解答，2-已升级，3-已关闭")
    has_answer: bool = False
    is_escalated: bool = False
    create_time: datetime
    update_time: datetime


# ==================== 解答相关 ====================

class VideoRecommendation(BaseModel):
    """视频推荐"""
    video_id: int = Field(..., description="视频ID")
    title: str = Field(..., description="视频标题")
    url: str = Field(..., description="视频URL")
    timestamp: Optional[str] = Field(None, description="相关片段时间戳")
    duration: Optional[int] = Field(None, description="视频时长（秒）")
    relevance_score: Optional[float] = Field(None, description="相关性分数")


class ReferenceSource(BaseModel):
    """参考资料来源"""
    source_type: str = Field(..., description="来源类型：course/document/web")
    title: str = Field(..., description="资料标题")
    url: Optional[str] = Field(None, description="资料链接")
    excerpt: Optional[str] = Field(None, description="摘录内容")


class TutoringAnswerBase(BaseModel):
    """解答基础模型"""
    answer_text: str = Field(..., description="解答文字内容（Markdown格式）")
    answer_diagrams: Optional[list[Any]] = Field(None, description="图解内容（Mermaid代码或结构化对象）")
    answer_videos: Optional[list[dict[str, Any]]] = Field(None, description="推荐视频列表")
    reference_sources: Optional[list[dict[str, Any]]] = Field(None, description="参考资料来源")


class TutoringAnswerCreate(TutoringAnswerBase):
    """创建解答请求（人工解答）"""
    question_id: int
    answerer_id: int


class TutoringAnswerResponse(TutoringAnswerBase):
    """解答响应"""
    model_config = ConfigDict(from_attributes=True)

    id: int
    question_id: int
    session_id: int
    answer_source: int = Field(..., description="解答来源：0-AI生成，1-人工解答")
    answerer_id: Optional[int] = None
    confidence_score: Optional[Decimal] = None
    generation_time: Optional[int] = None
    is_helpful: Optional[bool] = None
    user_rating: Optional[int] = None
    user_feedback: Optional[str] = None
    view_count: int = 0
    create_time: datetime
    update_time: datetime


class AnswerEvaluationRequest(BaseModel):
    """解答评价请求"""
    answer_id: int
    is_helpful: bool = Field(..., description="是否有帮助")
    user_rating: Optional[int] = Field(None, ge=1, le=5, description="用户评分（1-5星）")
    user_feedback: Optional[str] = Field(None, max_length=500, description="用户反馈文字")


# ==================== 升级相关 ====================

class EscalationRecordBase(BaseModel):
    """升级记录基础模型"""
    question_id: int
    escalation_reason: int = Field(..., description="升级原因：1-置信度低，2-生成超时，3-用户主动请求，4-多次解答不满意")


class EscalationRecordCreate(EscalationRecordBase):
    """创建升级记录请求"""
    ai_confidence_score: Optional[Decimal] = None


class EscalationRecordResponse(EscalationRecordBase):
    """升级记录响应"""
    model_config = ConfigDict(from_attributes=True)

    id: int
    session_id: int
    user_id: int
    ai_confidence_score: Optional[Decimal] = None
    escalation_status: int = Field(..., description="处理状态：0-待分配，1-已分配，2-处理中，3-已完成，4-已取消")
    assigned_expert_id: Optional[int] = None
    assign_time: Optional[datetime] = None
    expert_answer_id: Optional[int] = None
    complete_time: Optional[datetime] = None
    response_time: Optional[int] = None
    expert_notes: Optional[str] = None
    feedback_to_ai: bool = False
    create_time: datetime
    update_time: datetime


class EscalationDetailResponse(EscalationRecordResponse):
    """升级记录详情响应"""

    question_text: Optional[str] = None
    question_images: Optional[list[str]] = None
    question_type: Optional[str] = None
    knowledge_points: Optional[list[str]] = None
    latest_answer_id: Optional[int] = None
    latest_answer_text: Optional[str] = None
    latest_answer_source: Optional[int] = None


class EscalationListResponse(BaseModel):
    """升级记录列表响应"""

    total: int
    page: int
    page_size: int
    items: list[EscalationRecordResponse]


class ExpertAssignmentRequest(BaseModel):
    """专家分配请求"""
    escalation_id: int
    expert_id: int
    notes: Optional[str] = Field(None, max_length=500)


class ExpertAnswerSubmitRequest(BaseModel):
    """提交人工解答请求"""

    escalation_id: int
    expert_id: int
    answer_text: str = Field(..., min_length=1, description="人工解答正文")
    answer_diagrams: Optional[list[Any]] = Field(None, description="人工图解")
    answer_videos: Optional[list[dict[str, Any]]] = Field(None, description="人工补充视频")
    reference_sources: Optional[list[dict[str, Any]]] = Field(None, description="人工参考来源")
    expert_notes: Optional[str] = Field(None, max_length=500, description="专家备注")
    feedback_to_ai: bool = Field(True, description="是否反馈给 AI 服务")


# ==================== 收藏相关 ====================

class TutoringFavoriteCreate(BaseModel):
    """创建收藏请求"""
    question_id: int
    answer_id: int
    favorite_note: Optional[str] = Field(None, max_length=200)


class TutoringFavoriteResponse(BaseModel):
    """收藏响应"""
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    question_id: int
    answer_id: int
    favorite_note: Optional[str] = None
    create_time: datetime


# ==================== 历史查询相关 ====================

class TutoringHistoryQuery(BaseModel):
    """答疑历史查询参数"""
    user_id: int
    course_id: Optional[int] = None
    section_id: Optional[int] = None
    question_type: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    keyword: Optional[str] = Field(
        None, description="关键词搜索（问题正文与解答正文，数据库 ILIKE）"
    )
    page: int = Field(1, ge=1)
    page_size: int = Field(20, ge=1, le=100)


class TutoringHistoryItem(BaseModel):
    """答疑历史项"""
    question: TutoringQuestionResponse
    answer: Optional[TutoringAnswerResponse] = None
    is_favorited: bool = False


class TutoringHistoryResponse(BaseModel):
    """答疑历史响应"""
    total: int
    page: int
    page_size: int
    items: list[TutoringHistoryItem]


# ==================== 实时生成相关 ====================

class TutoringGenerationStatus(BaseModel):
    """解答生成状态"""
    question_id: int
    status: str = Field(..., description="状态：pending/generating/completed/failed/escalated")
    progress: int = Field(0, ge=0, le=100, description="进度百分比")
    current_step: Optional[str] = Field(None, description="当前步骤描述")
    answer_id: Optional[int] = None
    error_message: Optional[str] = None


class TutoringTaskResult(BaseModel):
    """异步答疑任务结果"""

    question_id: int
    session_id: Optional[int] = None
    answer_id: Optional[int] = None
    answer_text: str = ""
    diagrams: list[Any] = Field(default_factory=list)
    videos: list[dict[str, Any]] = Field(default_factory=list)
    reference_sources: list[dict[str, Any]] = Field(default_factory=list)
    confidence_score: Optional[float] = None
    generation_time: Optional[int] = None
    should_escalate: bool = False
    question_type: Optional[str] = None
    knowledge_points: list[str] = Field(default_factory=list)
    safety_review: SafetyReview | dict[str, Any] | None = None
    hallucination_review: HallucinationReview | dict[str, Any] | None = None


class TutoringTaskSubmitResponse(BaseModel):
    """异步答疑任务提交响应"""

    task_id: int
    status: str
    question_id: int
    session_id: Optional[int] = None
    poll_interval_ms: int = Field(default=2000)


class TutoringTaskStatusResponse(BaseModel):
    """异步答疑任务状态响应"""

    task_id: int
    status: str
    question_id: Optional[int] = None
    session_id: Optional[int] = None
    result: Optional[TutoringTaskResult] = None
    error_message: Optional[str] = None


class TutoringTaskHistoryItem(BaseModel):
    """异步答疑任务历史"""

    task_id: int
    user_id: int
    question_id: Optional[int] = None
    session_id: Optional[int] = None
    course_id: Optional[int] = None
    question_text: Optional[str] = None
    status: str
    answer_text: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class TutoringTaskHistoryResponse(BaseModel):
    """异步答疑任务历史响应"""

    items: list[TutoringTaskHistoryItem] = Field(default_factory=list)
    total: int = 0


class TutoringStreamChunk(BaseModel):
    """流式输出数据块"""
    chunk_type: str = Field(..., description="数据块类型：text/diagram/video/reference/complete")
    content: Any = Field(..., description="数据块内容")
    metadata: Optional[dict[str, Any]] = None
