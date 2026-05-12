"""
资源生成智能体模块。

这里使用惰性导入，避免单个可选依赖缺失时阻塞整个包的导入。
"""

from importlib import import_module

_EXPORTS = {
    "document_generation_node": ".document_agent",
    "mindmap_generation_node": ".mindmap_agent",
    "question_bank_generation_node": ".question_bank_agent",
    "video_recommendation_node": ".video_agent",
    "code_example_generation_node": ".code_example_agent",
    "resource_coordinator_node": ".coordinator_agent",
}


def __getattr__(name: str):
    module_name = _EXPORTS.get(name)
    if module_name is None:
        raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
    module = import_module(module_name, __name__)
    return getattr(module, name)


__all__ = list(_EXPORTS)
