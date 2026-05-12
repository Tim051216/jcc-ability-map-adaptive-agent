"""
对话式画像构建的状态定义
"""

from typing import Any, TypedDict


class ProfileConversationState(TypedDict, total=False):
    """对话式画像构建状态"""

    # 用户信息
    user_id: int
    session_id: int | None

    # 对话历史
    messages: list[str]
    current_round: int

    # 提取的信息
    extracted_info: dict[str, Any]
    missing_dimensions: list[str]
    completeness: int

    # 构建的画像
    built_profile: dict[str, Any]
    profile_tags: list[str]

    # 画像更新
    behavior_data: list[dict[str, Any]]
    profile_updates: dict[str, Any]

    # 引导问题
    guide_question: str | None

    # 会话状态
    session_status: str  # in_progress, completed, interrupted
    session_type: int  # 1-初始构建, 2-补充, 3-验证

    # 执行轨迹
    execution_trace: list[str]

    # 最终输出
    final_response: str
