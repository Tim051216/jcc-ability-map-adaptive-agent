"""
学习路径相关的Pydantic Schema定义
用于API请求和响应的数据验证
"""
from datetime import datetime, date, time
from decimal import Decimal
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


# ========================================
# 学习路径相关Schema
# ========================================

class LearningPathBase(BaseModel):
    """学习路径基础Schema"""
    path_name: str = Field(..., description="路径名称")
    path_desc: Optional[str] = Field(None, description="路径描述")
    target_course_id: Optional[int] = Field(None, description="目标课程ID")
    target_knowledge_points: Optional[List[str]] = Field(default_factory=list, description="目标知识点列表")
    difficulty_level: int = Field(3, ge=1, le=5, description="整体难度等级：1-入门，2-初级，3-中级，4-高级，5-专家")
    adaptive_enabled: bool = Field(True, description="是否启用自适应调整")


class LearningPathCreate(LearningPathBase):
    """创建学习路径请求"""
    user_id: int = Field(..., description="学生用户ID")
    profile_id: Optional[int] = Field(None, description="关联的学生画像ID")
    path_type: int = Field(1, description="路径类型：1-AI自动规划，2-教师指定，3-混合模式")


class LearningPathResponse(LearningPathBase):
    """学习路径响应"""
    id: int = Field(..., description="路径ID")
    user_id: int = Field(..., description="学生用户ID")
    profile_id: Optional[int] = Field(None, description="关联的学生画像ID")
    status: int = Field(..., description="路径状态：0-草稿，1-已激活，2-进行中，3-已完成，4-已暂停，5-已废弃")
    path_type: int = Field(..., description="路径类型")
    total_nodes: int = Field(0, description="总节点数")
    completed_nodes: int = Field(0, description="已完成节点数")
    current_node_id: Optional[int] = Field(None, description="当前节点ID")
    progress_percentage: int = Field(0, ge=0, le=100, description="完成百分比")
    estimated_duration: Optional[int] = Field(None, description="预估总时长（分钟）")
    actual_duration: int = Field(0, description="实际学习时长（分钟）")
    create_time: datetime = Field(..., description="创建时间")
    activate_time: Optional[datetime] = Field(None, description="激活时间")
    start_time: Optional[datetime] = Field(None, description="开始学习时间")
    complete_time: Optional[datetime] = Field(None, description="完成时间")
    update_time: datetime = Field(..., description="更新时间")

    class Config:
        from_attributes = True


# ========================================
# 路径节点相关Schema
# ========================================

class PathNodeBase(BaseModel):
    """路径节点基础Schema"""
    node_name: str = Field(..., description="节点名称")
    node_desc: Optional[str] = Field(None, description="节点描述")
    node_order: int = Field(..., ge=1, description="节点顺序（从1开始）")
    node_type: int = Field(..., description="节点类型：1-学习节点，2-练习节点，3-测评节点，4-复习节点")
    stage_type: int = Field(1, description="阶段类型：1-基础阶段，2-进阶阶段，3-高级阶段，4-综合阶段")
    knowledge_points: Optional[List[str]] = Field(default_factory=list, description="关联的知识点列表")
    prerequisite_nodes: Optional[List[int]] = Field(default_factory=list, description="前置节点ID列表")
    difficulty_level: int = Field(3, ge=1, le=5, description="难度等级")
    completion_criteria: Dict[str, Any] = Field(default_factory=dict, description="完成条件配置")
    estimated_duration: Optional[int] = Field(None, description="预估学习时长（分钟）")


class PathNodeCreate(PathNodeBase):
    """创建路径节点请求"""
    path_id: int = Field(..., description="所属路径ID")
    user_id: int = Field(..., description="学生用户ID")


class PathNodeResponse(PathNodeBase):
    """路径节点响应"""
    id: int = Field(..., description="节点ID")
    path_id: int = Field(..., description="所属路径ID")
    user_id: int = Field(..., description="学生用户ID")
    status: int = Field(0, description="节点状态：0-未开始，1-进行中，2-已完成，3-已跳过，4-已暂缓")
    is_locked: bool = Field(True, description="是否锁定")
    progress_percentage: int = Field(0, ge=0, le=100, description="完成百分比")
    actual_duration: int = Field(0, description="实际学习时长（分钟）")
    create_time: datetime = Field(..., description="创建时间")
    unlock_time: Optional[datetime] = Field(None, description="解锁时间")
    start_time: Optional[datetime] = Field(None, description="开始时间")
    complete_time: Optional[datetime] = Field(None, description="完成时间")
    update_time: datetime = Field(..., description="更新时间")

    class Config:
        from_attributes = True


# ========================================
# 节点资源相关Schema
# ========================================

class NodeResourceBase(BaseModel):
    """节点资源基础Schema"""
    resource_type: str = Field(..., description="资源类型：video-视频，document-文档，exercise-练习，test-测试，article-文章")
    resource_id: int = Field(..., description="资源ID")
    resource_name: Optional[str] = Field(None, description="资源名称")
    resource_url: Optional[str] = Field(None, description="资源URL")
    is_required: bool = Field(True, description="是否必需完成")
    resource_order: int = Field(0, description="资源顺序")
    estimated_duration: Optional[int] = Field(None, description="预估学习时长（分钟）")


class NodeResourceCreate(NodeResourceBase):
    """创建节点资源请求"""
    node_id: int = Field(..., description="节点ID")
    path_id: int = Field(..., description="路径ID")
    user_id: int = Field(..., description="用户ID")


class NodeResourceResponse(NodeResourceBase):
    """节点资源响应"""
    id: int = Field(..., description="关联ID")
    node_id: int = Field(..., description="节点ID")
    path_id: int = Field(..., description="路径ID")
    user_id: int = Field(..., description="用户ID")
    push_status: int = Field(0, description="推送状态：0-未推送，1-已推送，2-已查看，3-已完成")
    push_time: Optional[datetime] = Field(None, description="推送时间")
    view_time: Optional[datetime] = Field(None, description="查看时间")
    complete_time: Optional[datetime] = Field(None, description="完成时间")
    progress_percentage: int = Field(0, ge=0, le=100, description="完成百分比")
    actual_duration: int = Field(0, description="实际学习时长（分钟）")
    score: Optional[Decimal] = Field(None, description="得分")
    pass_status: Optional[int] = Field(None, description="通过状态：0-未通过，1-已通过")
    create_time: datetime = Field(..., description="创建时间")
    update_time: datetime = Field(..., description="更新时间")

    class Config:
        from_attributes = True


# ========================================
# 学习进度相关Schema
# ========================================

class LearningProgressCreate(BaseModel):
    """创建学习进度请求"""
    path_id: int = Field(..., description="路径ID")
    node_id: int = Field(..., description="节点ID")
    user_id: int = Field(..., description="用户ID")
    progress_type: int = Field(..., description="进度类型：1-节点开始，2-资源学习，3-节点完成，4-节点暂缓，5-节点跳过")
    progress_data: Optional[Dict[str, Any]] = Field(None, description="进度详细数据")
    progress_percentage: int = Field(0, ge=0, le=100, description="进度百分比")
    duration: Optional[int] = Field(None, description="本次学习时长（秒）")
    cumulative_duration: Optional[int] = Field(None, description="累计学习时长（秒）")
    result_data: Optional[Dict[str, Any]] = Field(None, description="学习结果数据")


class LearningProgressResponse(LearningProgressCreate):
    """学习进度响应"""
    id: int = Field(..., description="进度ID")
    create_time: datetime = Field(..., description="创建时间")

    class Config:
        from_attributes = True


# ========================================
# 路径调整相关Schema
# ========================================

class PathAdjustmentCreate(BaseModel):
    """创建路径调整请求"""
    path_id: int = Field(..., description="路径ID")
    user_id: int = Field(..., description="用户ID")
    adjustment_type: int = Field(..., description="调整类型：1-自动优化，2-手动调整，3-难度调整，4-节点增删")
    trigger_reason: Optional[str] = Field(None, description="触发原因")
    adjustment_data: Dict[str, Any] = Field(..., description="调整详细数据")
    affected_nodes: Optional[List[int]] = Field(default_factory=list, description="受影响的节点ID列表")
    before_snapshot: Optional[Dict[str, Any]] = Field(None, description="调整前快照")
    after_snapshot: Optional[Dict[str, Any]] = Field(None, description="调整后快照")


class PathAdjustmentResponse(PathAdjustmentCreate):
    """路径调整响应"""
    id: int = Field(..., description="调整记录ID")
    status: int = Field(0, description="调整状态：0-待确认，1-已应用，2-已拒绝")
    apply_time: Optional[datetime] = Field(None, description="应用时间")
    create_time: datetime = Field(..., description="创建时间")

    class Config:
        from_attributes = True


# ========================================
# 资源推送相关Schema
# ========================================

class ResourcePushCreate(BaseModel):
    """创建资源推送请求"""
    path_id: int = Field(..., description="路径ID")
    node_id: int = Field(..., description="节点ID")
    user_id: int = Field(..., description="用户ID")
    push_type: int = Field(..., description="推送类型：1-节点激活推送，2-资源推送，3-提醒推送")
    push_title: str = Field(..., description="推送标题")
    push_content: Optional[str] = Field(None, description="推送内容")
    push_data: Optional[Dict[str, Any]] = Field(None, description="推送数据")
    push_channel: str = Field("system", description="推送渠道：system-系统消息，email-邮件，sms-短信")


class ResourcePushResponse(ResourcePushCreate):
    """资源推送响应"""
    id: int = Field(..., description="推送记录ID")
    push_status: int = Field(0, description="推送状态：0-待推送，1-已推送，2-已读，3-已处理")
    push_time: Optional[datetime] = Field(None, description="推送时间")
    read_time: Optional[datetime] = Field(None, description="阅读时间")
    create_time: datetime = Field(..., description="创建时间")

    class Config:
        from_attributes = True


# ========================================
# 学习日历相关Schema
# ========================================

class LearningCalendarCreate(BaseModel):
    """创建学习日历任务请求"""
    user_id: int = Field(..., description="用户ID")
    path_id: Optional[int] = Field(None, description="关联路径ID")
    node_id: Optional[int] = Field(None, description="关联节点ID")
    task_title: str = Field(..., description="任务标题")
    task_desc: Optional[str] = Field(None, description="任务描述")
    task_type: int = Field(..., description="任务类型：1-路径节点任务，2-测评任务，3-自定义任务")
    plan_date: date = Field(..., description="计划日期")
    plan_start_time: Optional[time] = Field(None, description="计划开始时间")
    plan_end_time: Optional[time] = Field(None, description="计划结束时间")
    estimated_duration: Optional[int] = Field(None, description="预估时长（分钟）")
    priority: int = Field(2, ge=1, le=3, description="优先级：1-低，2-中，3-高")
    reminder_enabled: bool = Field(False, description="是否启用提醒")
    reminder_time: Optional[datetime] = Field(None, description="提醒时间")


class LearningCalendarResponse(LearningCalendarCreate):
    """学习日历任务响应"""
    id: int = Field(..., description="任务ID")
    status: int = Field(0, description="任务状态：0-待开始，1-进行中，2-已完成，3-已逾期，4-已取消")
    reminder_sent: bool = Field(False, description="提醒是否已发送")
    actual_start_time: Optional[datetime] = Field(None, description="实际开始时间")
    actual_end_time: Optional[datetime] = Field(None, description="实际结束时间")
    actual_duration: Optional[int] = Field(None, description="实际时长（分钟）")
    create_time: datetime = Field(..., description="创建时间")
    update_time: datetime = Field(..., description="更新时间")

    class Config:
        from_attributes = True


# ========================================
# 学习统计相关Schema
# ========================================

class LearningStatisticsCreate(BaseModel):
    """创建学习统计请求"""
    user_id: int = Field(..., description="用户ID")
    stat_date: date = Field(..., description="统计日期")
    total_duration: int = Field(0, description="总学习时长（分钟）")
    video_duration: int = Field(0, description="视频学习时长（分钟）")
    exercise_duration: int = Field(0, description="练习时长（分钟）")
    test_duration: int = Field(0, description="测试时长（分钟）")
    completed_tasks: int = Field(0, description="完成任务数")
    completed_nodes: int = Field(0, description="完成节点数")
    completed_resources: int = Field(0, description="完成资源数")
    exercise_count: int = Field(0, description="练习题数")
    correct_count: int = Field(0, description="正确题数")
    accuracy_rate: Optional[Decimal] = Field(None, description="正确率")
    learned_knowledge_points: Optional[List[str]] = Field(default_factory=list, description="学习的知识点列表")
    mastered_knowledge_points: Optional[List[str]] = Field(default_factory=list, description="掌握的知识点列表")


class LearningStatisticsResponse(LearningStatisticsCreate):
    """学习统计响应"""
    id: int = Field(..., description="统计ID")
    create_time: datetime = Field(..., description="创建时间")
    update_time: datetime = Field(..., description="更新时间")

    class Config:
        from_attributes = True


# ========================================
# 路径规划相关请求Schema
# ========================================

class PathPlanningRequest(BaseModel):
    """路径规划请求"""
    user_id: int = Field(..., description="学生用户ID")
    profile_id: Optional[int] = Field(None, description="学生画像ID")
    target_course_id: Optional[int] = Field(None, description="目标课程ID")
    target_knowledge_points: Optional[List[str]] = Field(default_factory=list, description="目标知识点列表")
    difficulty_preference: Optional[int] = Field(None, ge=1, le=5, description="难度偏好")
    time_budget: Optional[int] = Field(None, description="时间预算（分钟）")
    learning_pace: Optional[str] = Field(None, description="学习节奏：slow-慢速，normal-正常，fast-快速")


class PathPlanningResponse(BaseModel):
    """路径规划响应"""
    path: LearningPathResponse = Field(..., description="生成的学习路径")
    nodes: List[PathNodeResponse] = Field(default_factory=list, description="路径节点列表")
    total_estimated_duration: int = Field(0, description="总预估时长（分钟）")
    difficulty_distribution: Dict[int, int] = Field(default_factory=dict, description="难度分布统计")
    stage_distribution: Dict[int, int] = Field(default_factory=dict, description="阶段分布统计")
    recommendations: List[str] = Field(default_factory=list, description="学习建议")


# ========================================
# 路径进度查询响应Schema
# ========================================

class PathProgressResponse(BaseModel):
    """路径进度响应"""
    path: LearningPathResponse = Field(..., description="学习路径")
    current_node: Optional[PathNodeResponse] = Field(None, description="当前节点")
    completed_nodes: List[PathNodeResponse] = Field(default_factory=list, description="已完成节点列表")
    upcoming_nodes: List[PathNodeResponse] = Field(default_factory=list, description="即将学习的节点列表")
    progress_summary: Dict[str, Any] = Field(default_factory=dict, description="进度摘要")
    weak_knowledge_points: List[str] = Field(default_factory=list, description="薄弱知识点")
    suggestions: List[str] = Field(default_factory=list, description="学习建议")


# ========================================
# 节点操作请求Schema
# ========================================

class NodeOperationRequest(BaseModel):
    """节点操作请求"""
    user_id: int = Field(..., description="用户ID")
    operation: str = Field(..., description="操作类型：start-开始，complete-完成，pause-暂缓，skip-跳过，redo-重做")
    reason: Optional[str] = Field(None, description="操作原因")
    result_data: Optional[Dict[str, Any]] = Field(None, description="结果数据")


class NodeOperationResponse(BaseModel):
    """节点操作响应"""
    success: bool = Field(..., description="操作是否成功")
    message: str = Field(..., description="操作消息")
    updated_node: Optional[PathNodeResponse] = Field(None, description="更新后的节点")
    next_node: Optional[PathNodeResponse] = Field(None, description="下一个节点")
    path_progress: Optional[int] = Field(None, description="路径整体进度")
