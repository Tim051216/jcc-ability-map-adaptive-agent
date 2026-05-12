"""
学习路径相关的SQLAlchemy模型定义

包含以下模型：
- LearningPath: 学习路径主表
- PathNode: 路径节点表
- NodeResource: 节点资源关联表
- LearningProgress: 学习进度记录表
- PathAdjustment: 路径调整记录表
- ResourcePush: 资源推送记录表
- LearningCalendar: 学习日历任务表
- LearningStatistics: 学习统计表
"""

from datetime import date, datetime, time
from typing import Optional

from sqlalchemy import JSON, Boolean, Date, DateTime, Integer, Numeric, String, Text, Time
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class LearningPath(Base):
    """学习路径主表"""

    __tablename__ = "learning_path"

    # 主键
    id: Mapped[int] = mapped_column(Integer, primary_key=True, comment="路径ID")

    # 关联信息
    user_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True, comment="学生用户ID")
    profile_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, index=True, comment="关联的学生画像ID")

    # 路径基本信息
    path_name: Mapped[str] = mapped_column(String(256), nullable=False, comment="路径名称")
    path_desc: Mapped[Optional[str]] = mapped_column(Text, nullable=True, comment="路径描述")
    target_course_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, comment="目标课程ID")
    target_knowledge_points: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True, comment="目标知识点列表")

    # 路径状态
    status: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, index=True, comment="路径状态：0-草稿，1-已激活，2-进行中，3-已完成，4-已暂停，5-已废弃"
    )
    path_type: Mapped[int] = mapped_column(
        Integer, nullable=False, default=1, comment="路径类型：1-AI自动规划，2-教师指定，3-混合模式"
    )

    # 路径统计
    total_nodes: Mapped[int] = mapped_column(Integer, nullable=False, default=0, comment="总节点数")
    completed_nodes: Mapped[int] = mapped_column(Integer, nullable=False, default=0, comment="已完成节点数")
    current_node_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, index=True, comment="当前节点ID")

    # 路径进度
    progress_percentage: Mapped[int] = mapped_column(Integer, nullable=False, default=0, comment="完成百分比(0-100)")
    estimated_duration: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, comment="预估总时长（分钟）")
    actual_duration: Mapped[int] = mapped_column(Integer, nullable=False, default=0, comment="实际学习时长（分钟）")

    # 路径难度
    difficulty_level: Mapped[int] = mapped_column(
        Integer, nullable=False, default=3, comment="整体难度等级：1-入门，2-初级，3-中级，4-高级，5-专家"
    )
    adaptive_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, comment="是否启用自适应调整")

    # 时间戳
    create_time: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True, comment="创建时间")
    activate_time: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True, comment="激活时间")
    start_time: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True, comment="开始学习时间")
    complete_time: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True, comment="完成时间")
    update_time: Mapped[datetime] = mapped_column(DateTime, nullable=False, comment="更新时间")


class PathNode(Base):
    """路径节点表"""

    __tablename__ = "path_node"

    # 主键
    id: Mapped[int] = mapped_column(Integer, primary_key=True, comment="节点ID")

    # 关联信息
    path_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True, comment="所属路径ID")
    user_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True, comment="学生用户ID")

    # 节点基本信息
    node_name: Mapped[str] = mapped_column(String(256), nullable=False, comment="节点名称")
    node_desc: Mapped[Optional[str]] = mapped_column(Text, nullable=True, comment="节点描述")
    node_order: Mapped[int] = mapped_column(Integer, nullable=False, comment="节点顺序（从1开始）")

    # 节点类型
    node_type: Mapped[int] = mapped_column(
        Integer, nullable=False, index=True, comment="节点类型：1-学习节点，2-练习节点，3-测评节点，4-复习节点"
    )
    stage_type: Mapped[int] = mapped_column(
        Integer, nullable=False, default=1, comment="阶段类型：1-基础阶段，2-进阶阶段，3-高级阶段，4-综合阶段"
    )

    # 知识点关联
    knowledge_points: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True, comment="关联的知识点列表")
    prerequisite_nodes: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True, comment="前置节点ID列表")

    # 节点难度
    difficulty_level: Mapped[int] = mapped_column(
        Integer, nullable=False, default=3, comment="难度等级：1-入门，2-初级，3-中级，4-高级，5-专家"
    )

    # 完成条件
    completion_criteria: Mapped[dict] = mapped_column(JSON, nullable=False, comment="完成条件配置（如：学习时长、正确率、资源完成数）")
    estimated_duration: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, comment="预估学习时长（分钟）")

    # 节点状态
    status: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, index=True, comment="节点状态：0-未开始，1-进行中，2-已完成，3-已跳过，4-已暂缓"
    )
    is_locked: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, comment="是否锁定（需完成前置节点才能解锁）")

    # 节点进度
    progress_percentage: Mapped[int] = mapped_column(Integer, nullable=False, default=0, comment="完成百分比(0-100)")
    actual_duration: Mapped[int] = mapped_column(Integer, nullable=False, default=0, comment="实际学习时长（分钟）")

    # 时间戳
    create_time: Mapped[datetime] = mapped_column(DateTime, nullable=False, comment="创建时间")
    unlock_time: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True, comment="解锁时间")
    start_time: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True, comment="开始时间")
    complete_time: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True, comment="完成时间")
    update_time: Mapped[datetime] = mapped_column(DateTime, nullable=False, comment="更新时间")


class NodeResource(Base):
    """节点资源关联表"""

    __tablename__ = "node_resource"

    # 主键
    id: Mapped[int] = mapped_column(Integer, primary_key=True, comment="关联ID")

    # 关联信息
    node_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True, comment="节点ID")
    path_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True, comment="路径ID")
    user_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True, comment="用户ID")

    # 资源信息
    resource_type: Mapped[str] = mapped_column(
        String(32), nullable=False, comment="资源类型：video-视频，document-文档，exercise-练习，test-测试，article-文章"
    )
    resource_id: Mapped[int] = mapped_column(Integer, nullable=False, comment="资源ID")
    resource_name: Mapped[Optional[str]] = mapped_column(String(256), nullable=True, comment="资源名称")
    resource_url: Mapped[Optional[str]] = mapped_column(String(512), nullable=True, comment="资源URL")

    # 资源配置
    is_required: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, comment="是否必需完成")
    resource_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0, comment="资源顺序")
    estimated_duration: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, comment="预估学习时长（分钟）")

    # 推送状态
    push_status: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, index=True, comment="推送状态：0-未推送，1-已推送，2-已查看，3-已完成"
    )
    push_time: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True, comment="推送时间")
    view_time: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True, comment="查看时间")
    complete_time: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True, comment="完成时间")

    # 学习进度
    progress_percentage: Mapped[int] = mapped_column(Integer, nullable=False, default=0, comment="完成百分比(0-100)")
    actual_duration: Mapped[int] = mapped_column(Integer, nullable=False, default=0, comment="实际学习时长（分钟）")

    # 学习结果
    score: Mapped[Optional[float]] = mapped_column(Numeric(5, 2), nullable=True, comment="得分（如练习、测试的分数）")
    pass_status: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, comment="通过状态：0-未通过，1-已通过")

    # 时间戳
    create_time: Mapped[datetime] = mapped_column(DateTime, nullable=False, comment="创建时间")
    update_time: Mapped[datetime] = mapped_column(DateTime, nullable=False, comment="更新时间")


class LearningProgress(Base):
    """学习进度记录表"""

    __tablename__ = "learning_progress"

    # 主键
    id: Mapped[int] = mapped_column(Integer, primary_key=True, comment="进度ID")

    # 关联信息
    path_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True, comment="路径ID")
    node_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True, comment="节点ID")
    user_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True, comment="用户ID")

    # 进度类型
    progress_type: Mapped[int] = mapped_column(
        Integer, nullable=False, index=True, comment="进度类型：1-节点开始，2-资源学习，3-节点完成，4-节点暂缓，5-节点跳过"
    )

    # 进度数据
    progress_data: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True, comment="进度详细数据")
    progress_percentage: Mapped[int] = mapped_column(Integer, nullable=False, default=0, comment="进度百分比(0-100)")

    # 学习时长
    duration: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, comment="本次学习时长（秒）")
    cumulative_duration: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, comment="累计学习时长（秒）")

    # 学习结果
    result_data: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True, comment="学习结果数据（如：答题结果、测评分数）")

    # 时间戳
    create_time: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True, comment="创建时间")


class PathAdjustment(Base):
    """路径调整记录表"""

    __tablename__ = "path_adjustment"

    # 主键
    id: Mapped[int] = mapped_column(Integer, primary_key=True, comment="调整记录ID")

    # 关联信息
    path_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True, comment="路径ID")
    user_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True, comment="用户ID")

    # 调整类型
    adjustment_type: Mapped[int] = mapped_column(
        Integer, nullable=False, index=True, comment="调整类型：1-自动优化，2-手动调整，3-难度调整，4-节点增删"
    )
    trigger_reason: Mapped[Optional[str]] = mapped_column(String(512), nullable=True, comment="触发原因")

    # 调整内容
    adjustment_data: Mapped[dict] = mapped_column(JSON, nullable=False, comment="调整详细数据")
    affected_nodes: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True, comment="受影响的节点ID列表")

    # 调整前后对比
    before_snapshot: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True, comment="调整前快照")
    after_snapshot: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True, comment="调整后快照")

    # 调整状态
    status: Mapped[int] = mapped_column(Integer, nullable=False, default=0, index=True, comment="调整状态：0-待确认，1-已应用，2-已拒绝")
    apply_time: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True, comment="应用时间")

    # 时间戳
    create_time: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True, comment="创建时间")


class ResourcePush(Base):
    """资源推送记录表"""

    __tablename__ = "resource_push"

    # 主键
    id: Mapped[int] = mapped_column(Integer, primary_key=True, comment="推送记录ID")

    # 关联信息
    path_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True, comment="路径ID")
    node_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True, comment="节点ID")
    user_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True, comment="用户ID")

    # 推送内容
    push_type: Mapped[int] = mapped_column(Integer, nullable=False, comment="推送类型：1-节点激活推送，2-资源推送，3-提醒推送")
    push_title: Mapped[str] = mapped_column(String(256), nullable=False, comment="推送标题")
    push_content: Mapped[Optional[str]] = mapped_column(Text, nullable=True, comment="推送内容")
    push_data: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True, comment="推送数据（资源列表、学习指引等）")

    # 推送渠道
    push_channel: Mapped[str] = mapped_column(
        String(64), nullable=False, default="system", comment="推送渠道：system-系统消息，email-邮件，sms-短信"
    )

    # 推送状态
    push_status: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, index=True, comment="推送状态：0-待推送，1-已推送，2-已读，3-已处理"
    )
    push_time: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True, index=True, comment="推送时间")
    read_time: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True, comment="阅读时间")

    # 时间戳
    create_time: Mapped[datetime] = mapped_column(DateTime, nullable=False, comment="创建时间")


class LearningCalendar(Base):
    """学习日历任务表"""

    __tablename__ = "learning_calendar"

    # 主键
    id: Mapped[int] = mapped_column(Integer, primary_key=True, comment="任务ID")

    # 关联信息
    user_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True, comment="用户ID")
    path_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, index=True, comment="关联路径ID")
    node_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, index=True, comment="关联节点ID")

    # 任务信息
    task_title: Mapped[str] = mapped_column(String(256), nullable=False, comment="任务标题")
    task_desc: Mapped[Optional[str]] = mapped_column(Text, nullable=True, comment="任务描述")
    task_type: Mapped[int] = mapped_column(
        Integer, nullable=False, index=True, comment="任务类型：1-路径节点任务，2-测评任务，3-自定义任务"
    )

    # 任务时间
    plan_date: Mapped[date] = mapped_column(Date, nullable=False, index=True, comment="计划日期")
    plan_start_time: Mapped[Optional[time]] = mapped_column(Time, nullable=True, comment="计划开始时间")
    plan_end_time: Mapped[Optional[time]] = mapped_column(Time, nullable=True, comment="计划结束时间")
    estimated_duration: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, comment="预估时长（分钟）")

    # 任务状态
    status: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, index=True, comment="任务状态：0-待开始，1-进行中，2-已完成，3-已逾期，4-已取消"
    )
    priority: Mapped[int] = mapped_column(Integer, nullable=False, default=2, comment="优先级：1-低，2-中，3-高")

    # 提醒设置
    reminder_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, comment="是否启用提醒")
    reminder_time: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True, comment="提醒时间")
    reminder_sent: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, comment="提醒是否已发送")

    # 完成信息
    actual_start_time: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True, comment="实际开始时间")
    actual_end_time: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True, comment="实际结束时间")
    actual_duration: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, comment="实际时长（分钟）")

    # 时间戳
    create_time: Mapped[datetime] = mapped_column(DateTime, nullable=False, comment="创建时间")
    update_time: Mapped[datetime] = mapped_column(DateTime, nullable=False, comment="更新时间")


class LearningStatistics(Base):
    """学习统计表"""

    __tablename__ = "learning_statistics"

    # 主键
    id: Mapped[int] = mapped_column(Integer, primary_key=True, comment="统计ID")

    # 关联信息
    user_id: Mapped[int] = mapped_column(Integer, nullable=False, comment="用户ID")
    stat_date: Mapped[date] = mapped_column(Date, nullable=False, index=True, comment="统计日期")

    # 学习时长统计
    total_duration: Mapped[int] = mapped_column(Integer, nullable=False, default=0, comment="总学习时长（分钟）")
    video_duration: Mapped[int] = mapped_column(Integer, nullable=False, default=0, comment="视频学习时长（分钟）")
    exercise_duration: Mapped[int] = mapped_column(Integer, nullable=False, default=0, comment="练习时长（分钟）")
    test_duration: Mapped[int] = mapped_column(Integer, nullable=False, default=0, comment="测试时长（分钟）")

    # 任务完成统计
    completed_tasks: Mapped[int] = mapped_column(Integer, nullable=False, default=0, comment="完成任务数")
    completed_nodes: Mapped[int] = mapped_column(Integer, nullable=False, default=0, comment="完成节点数")
    completed_resources: Mapped[int] = mapped_column(Integer, nullable=False, default=0, comment="完成资源数")

    # 学习效果统计
    exercise_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0, comment="练习题数")
    correct_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0, comment="正确题数")
    accuracy_rate: Mapped[Optional[float]] = mapped_column(Numeric(5, 2), nullable=True, comment="正确率")

    # 知识点统计
    learned_knowledge_points: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True, comment="学习的知识点列表")
    mastered_knowledge_points: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True, comment="掌握的知识点列表")

    # 时间戳
    create_time: Mapped[datetime] = mapped_column(DateTime, nullable=False, comment="创建时间")
    update_time: Mapped[datetime] = mapped_column(DateTime, nullable=False, comment="更新时间")
