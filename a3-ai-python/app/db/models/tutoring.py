"""
智能辅导系统数据模型
"""
from datetime import datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import JSON, BigInteger, Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class TutoringSession(Base):
    """答疑会话表"""
    __tablename__ = "tutoring_session"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    user_id: Mapped[int] = mapped_column(BigInteger, index=True, comment="学生ID")
    course_id: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True, comment="关联课程ID")
    section_id: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True, comment="关联章节ID")
    session_status: Mapped[int] = mapped_column(Integer, default=0, index=True, comment="会话状态：0-进行中，1-已结束，2-已升级")
    question_count: Mapped[int] = mapped_column(Integer, default=0, comment="问题数量")
    start_time: Mapped[datetime] = mapped_column(comment="会话开始时间")
    end_time: Mapped[Optional[datetime]] = mapped_column(nullable=True, comment="会话结束时间")
    create_time: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, comment="创建时间")
    update_time: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.now, onupdate=datetime.now, comment="更新时间"
    )


class TutoringQuestion(Base):
    """问题表"""
    __tablename__ = "tutoring_question"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    session_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("tutoring_session.id"), index=True, comment="所属会话ID")
    user_id: Mapped[int] = mapped_column(BigInteger, index=True, comment="提问学生ID")
    course_id: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True, comment="关联课程ID")
    section_id: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True, comment="关联章节ID")
    question_text: Mapped[str] = mapped_column(Text, comment="问题文字内容")
    question_images: Mapped[Optional[list]] = mapped_column(JSON, nullable=True, comment="问题图片URL列表")
    question_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, comment="问题类型")
    knowledge_points: Mapped[Optional[list]] = mapped_column(JSON, nullable=True, comment="关联知识点列表")
    difficulty_level: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, comment="问题难度：1-简单，2-中等，3-困难")
    question_status: Mapped[int] = mapped_column(Integer, default=0, index=True, comment="问题状态：0-待处理，1-已解答，2-已升级，3-已关闭")
    has_answer: Mapped[bool] = mapped_column(Boolean, default=False, comment="是否已有解答")
    is_escalated: Mapped[bool] = mapped_column(Boolean, default=False, comment="是否已升级到人工")
    create_time: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, comment="创建时间")
    update_time: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.now, onupdate=datetime.now, comment="更新时间"
    )


class TutoringAnswer(Base):
    """解答表"""
    __tablename__ = "tutoring_answer"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    question_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("tutoring_question.id"), index=True, comment="关联问题ID")
    session_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("tutoring_session.id"), index=True, comment="所属会话ID")
    answer_source: Mapped[int] = mapped_column(Integer, default=0, index=True, comment="解答来源：0-AI生成，1-人工解答")
    answerer_id: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True, comment="解答者ID（人工解答时有效）")
    answer_text: Mapped[str] = mapped_column(Text, comment="解答文字内容（Markdown格式）")
    answer_diagrams: Mapped[Optional[list]] = mapped_column(JSON, nullable=True, comment="图解内容（Mermaid代码）")
    answer_videos: Mapped[Optional[list]] = mapped_column(JSON, nullable=True, comment="推荐视频列表")
    reference_sources: Mapped[Optional[list]] = mapped_column(JSON, nullable=True, comment="参考资料来源")
    confidence_score: Mapped[Optional[Decimal]] = mapped_column(Numeric(5, 2), nullable=True, index=True, comment="置信度分数（0-100）")
    generation_time: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, comment="生成耗时（毫秒）")
    is_helpful: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True, comment="是否有帮助（用户评价）")
    user_rating: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, comment="用户评分（1-5星）")
    user_feedback: Mapped[Optional[str]] = mapped_column(String(500), nullable=True, comment="用户反馈文字")
    view_count: Mapped[int] = mapped_column(Integer, default=0, comment="查看次数")
    create_time: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, comment="创建时间")
    update_time: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.now, onupdate=datetime.now, comment="更新时间"
    )


class EscalationRecord(Base):
    """升级记录表"""
    __tablename__ = "escalation_record"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    question_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("tutoring_question.id"), index=True, comment="关联问题ID")
    session_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("tutoring_session.id"), index=True, comment="所属会话ID")
    user_id: Mapped[int] = mapped_column(BigInteger, index=True, comment="学生ID")
    escalation_reason: Mapped[int] = mapped_column(Integer, comment="升级原因：1-置信度低，2-生成超时，3-用户主动请求，4-多次解答不满意")
    ai_confidence_score: Mapped[Optional[Decimal]] = mapped_column(Numeric(5, 2), nullable=True, comment="AI解答置信度")
    escalation_status: Mapped[int] = mapped_column(Integer, default=0, index=True, comment="处理状态：0-待分配，1-已分配，2-处理中，3-已完成，4-已取消")
    assigned_expert_id: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True, index=True, comment="分配的专家ID")
    assign_time: Mapped[Optional[datetime]] = mapped_column(nullable=True, comment="分配时间")
    expert_answer_id: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True, comment="专家解答ID")
    complete_time: Mapped[Optional[datetime]] = mapped_column(nullable=True, comment="完成时间")
    response_time: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, comment="响应时长（分钟）")
    expert_notes: Mapped[Optional[str]] = mapped_column(String(500), nullable=True, comment="专家备注")
    feedback_to_ai: Mapped[bool] = mapped_column(Boolean, default=False, comment="是否已反馈给AI系统")
    create_time: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, comment="创建时间")
    update_time: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.now, onupdate=datetime.now, comment="更新时间"
    )


class TutoringFavorite(Base):
    """收藏记录表"""
    __tablename__ = "tutoring_favorite"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    user_id: Mapped[int] = mapped_column(BigInteger, index=True, comment="学生ID")
    question_id: Mapped[int] = mapped_column(BigInteger, comment="问题ID")
    answer_id: Mapped[int] = mapped_column(BigInteger, comment="解答ID")
    favorite_note: Mapped[Optional[str]] = mapped_column(String(200), nullable=True, comment="收藏备注")
    create_time: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, comment="创建时间")
