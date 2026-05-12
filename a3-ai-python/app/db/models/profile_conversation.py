"""
对话式画像构建相关的数据模型
"""

from datetime import datetime

from sqlalchemy import JSON, BigInteger, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class ConversationSessionModel(Base, TimestampMixin):
    """对话会话模型"""

    __tablename__ = "ai_conversation_session"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(BigInteger, index=True, comment="学生用户ID")
    profile_id: Mapped[int | None] = mapped_column(
        BigInteger, nullable=True, comment="关联的画像ID"
    )

    # 会话状态
    status: Mapped[int] = mapped_column(
        Integer, default=0, comment="会话状态：0-进行中，1-已完成，2-已中断"
    )
    session_type: Mapped[int] = mapped_column(
        Integer, default=1, comment="会话类型：1-初始画像构建，2-画像补充，3-画像验证"
    )

    # 会话进度
    total_rounds: Mapped[int] = mapped_column(Integer, default=0, comment="总对话轮次")
    collected_dimensions: Mapped[str | None] = mapped_column(
        String(256), nullable=True, comment="已采集的维度，逗号分隔"
    )
    completeness: Mapped[int] = mapped_column(
        Integer, default=0, comment="信息采集完整度(0-100)"
    )

    # 时间戳
    start_time: Mapped[datetime] = mapped_column(default=datetime.now, comment="开始时间")
    end_time: Mapped[datetime | None] = mapped_column(nullable=True, comment="结束时间")


class ConversationMessageModel(Base, TimestampMixin):
    """对话消息模型"""

    __tablename__ = "ai_conversation_message"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    session_id: Mapped[int] = mapped_column(BigInteger, index=True, comment="会话ID")
    user_id: Mapped[int] = mapped_column(BigInteger, index=True, comment="用户ID")

    # 消息内容
    role: Mapped[str] = mapped_column(
        String(20), comment="角色：user-用户，assistant-助手，system-系统"
    )
    content: Mapped[str] = mapped_column(Text, comment="消息内容")
    round_number: Mapped[int] = mapped_column(Integer, comment="对话轮次")

    # 消息元数据
    message_type: Mapped[int] = mapped_column(
        Integer, default=1, comment="消息类型：1-普通对话，2-引导问题，3-确认信息"
    )
    related_dimension: Mapped[str | None] = mapped_column(
        String(64), nullable=True, comment="相关维度"
    )


class ExtractedInfoModel(Base, TimestampMixin):
    """提取信息模型"""

    __tablename__ = "ai_extracted_info"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    session_id: Mapped[int] = mapped_column(BigInteger, index=True, comment="会话ID")
    message_id: Mapped[int] = mapped_column(BigInteger, comment="消息ID")
    user_id: Mapped[int] = mapped_column(BigInteger, index=True, comment="用户ID")

    # 提取的信息
    dimension: Mapped[str] = mapped_column(String(64), index=True, comment="所属维度")
    info_key: Mapped[str] = mapped_column(String(128), comment="信息键")
    info_value: Mapped[str] = mapped_column(Text, comment="信息值")
    confidence: Mapped[float] = mapped_column(default=0.0, comment="置信度(0.00-1.00)")

    # 提取元数据
    extraction_method: Mapped[str | None] = mapped_column(
        String(64), nullable=True, comment="提取方法：llm-大模型提取，rule-规则提取"
    )
    verified: Mapped[bool] = mapped_column(default=False, comment="是否已验证")


class StudentProfileModel(Base, TimestampMixin):
    """学生画像模型（AI服务侧的缓存）"""

    __tablename__ = "ai_student_profile"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(BigInteger, unique=True, index=True, comment="学生用户ID")
    version: Mapped[int] = mapped_column(Integer, default=1, comment="画像版本号")

    # 六维度画像数据（JSON格式）
    knowledge_base: Mapped[dict | None] = mapped_column(
        JSON, nullable=True, comment="知识基础维度"
    )
    cognitive_style: Mapped[dict | None] = mapped_column(
        JSON, nullable=True, comment="认知风格维度"
    )
    learning_progress: Mapped[dict | None] = mapped_column(
        JSON, nullable=True, comment="学习进度维度"
    )
    error_preference: Mapped[dict | None] = mapped_column(
        JSON, nullable=True, comment="易错点偏好维度"
    )
    interest_direction: Mapped[dict | None] = mapped_column(
        JSON, nullable=True, comment="兴趣方向维度"
    )
    learning_habit: Mapped[dict | None] = mapped_column(
        JSON, nullable=True, comment="学习习惯维度"
    )

    # 画像标签和摘要
    tags: Mapped[list | None] = mapped_column(JSON, nullable=True, comment="学习标签列表")
    summary: Mapped[str | None] = mapped_column(Text, nullable=True, comment="画像摘要")

    # 画像完整度
    completeness: Mapped[int] = mapped_column(
        Integer, default=0, comment="画像完整度百分比(0-100)"
    )

    # 画像状态
    status: Mapped[int] = mapped_column(
        Integer, default=1, comment="画像状态：0-未激活，1-正常，2-已过期"
    )

    # 最后学习行为时间
    last_behavior_time: Mapped[datetime | None] = mapped_column(
        nullable=True, comment="最后学习行为时间"
    )


class ProfileHistoryModel(Base, TimestampMixin):
    """画像历史版本模型"""

    __tablename__ = "ai_profile_history"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    profile_id: Mapped[int] = mapped_column(BigInteger, index=True, comment="画像ID")
    user_id: Mapped[int] = mapped_column(BigInteger, index=True, comment="学生用户ID")
    version: Mapped[int] = mapped_column(Integer, comment="版本号")

    # 快照数据
    snapshot_data: Mapped[dict] = mapped_column(JSON, comment="画像快照数据（完整六维度）")

    # 变更信息
    change_type: Mapped[int] = mapped_column(
        Integer, comment="变更类型：1-初始创建，2-对话更新，3-行为更新，4-手动调整"
    )
    change_description: Mapped[str | None] = mapped_column(
        String(512), nullable=True, comment="变更描述"
    )
    changed_dimensions: Mapped[str | None] = mapped_column(
        String(256), nullable=True, comment="变更的维度，逗号分隔"
    )
