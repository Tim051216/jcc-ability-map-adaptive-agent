"""
对话式画像构建的LangGraph编排
"""

from langgraph.graph import END, StateGraph

from .conversation_state import ProfileConversationState
from .info_extractor_agent import info_extractor_node
from .profile_builder_agent import profile_builder_node
from .profile_updater_agent import profile_updater_node


def _should_continue_conversation(state: ProfileConversationState) -> str:
    """
    判断是否继续对话
    
    Returns:
        "continue" - 继续对话
        "build" - 构建画像
        "end" - 结束
    """
    completeness = state.get("completeness", 0)
    current_round = state.get("current_round", 0)
    session_status = state.get("session_status", "in_progress")

    # 完成会话时需要生成最终画像，不能直接结束
    if session_status == "completed":
        return "build"
    if session_status == "interrupted":
        return "end"

    # 如果完整度达到80%以上，构建画像
    if completeness >= 80:
        return "build"

    # 如果对话轮次超过20轮，强制构建画像
    if current_round >= 20:
        return "build"

    # 否则继续对话
    return "continue"


def _route_after_extraction(state: ProfileConversationState) -> str:
    """
    信息提取后的路由
    
    Returns:
        "builder" - 构建画像
        "guide" - 生成引导问题
    """
    return _should_continue_conversation(state)


def _route_after_builder(state: ProfileConversationState) -> str:
    """
    画像构建后的路由
    
    Returns:
        "updater" - 更新画像（如果有行为数据）
        "end" - 结束
    """
    behavior_data = state.get("behavior_data", [])
    if behavior_data:
        return "updater"
    return "end"


def build_profile_conversation_graph():
    """
    构建对话式画像构建的LangGraph
    
    工作流程：
    1. info_extractor - 从对话中提取信息
    2. 判断是否继续对话或构建画像
    3. profile_builder - 构建结构化画像
    4. profile_updater - 基于行为数据更新画像（可选）
    """
    graph = StateGraph(ProfileConversationState)

    # 添加节点
    graph.add_node("info_extractor", info_extractor_node)
    graph.add_node("profile_builder", profile_builder_node)
    graph.add_node("profile_updater", profile_updater_node)

    # 设置入口点
    graph.set_entry_point("info_extractor")

    # 添加条件边
    graph.add_conditional_edges(
        "info_extractor",
        _route_after_extraction,
        {
            "continue": END,  # 返回引导问题，等待下一轮对话
            "build": "profile_builder",
            "end": END,
        },
    )

    graph.add_conditional_edges(
        "profile_builder",
        _route_after_builder,
        {
            "updater": "profile_updater",
            "end": END,
        },
    )

    graph.add_edge("profile_updater", END)

    return graph.compile()


# 创建全局图实例
profile_conversation_graph = build_profile_conversation_graph()
