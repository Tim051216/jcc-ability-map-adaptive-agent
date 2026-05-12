# 智能体监控清理总结

## Problem

管理端智能体监控页存在两类问题：后端 `list_agent_status` 中保留了重复死分支，且 demo 智能体消息与资源主题在 fallback 场景下可能返回脏文案，影响页面展示和验收稳定性。

## Root Cause

- `list_agent_status` 早期兼容逻辑未清理，留下重复的 `if not logs` 分支。
- demo 运行日志常量中的历史文案未统一收口，导致 fallback 数据依赖原始消息内容。

## Changes

- 删除 `a3-ai-python/app/services/admin_service.py` 中重复且不可达的 `if not logs` 分支。
- 保留并收口智能体消息/载荷规范化逻辑，确保状态卡、运行日志和资源主题统一输出干净中文。
- 在 `a3-ai-python/app/tests/test_admin_service.py` 中新增智能体消息与 payload 规范化测试，补强回归覆盖。

## Verification

- `F:\\A3-cnsoftbei\\a3-learning-agent-system\\a3-ai-python\\.venv\\Scripts\\python.exe -m pytest app\\tests\\test_admin_service.py app\\tests\\test_admin_api.py app\\tests\\test_admin_export_service.py`
- `npm run build`
- 浏览器校验 `http://localhost:18082/#/main/ai-admin-agents`
  - 输入 `planner_agent` 后“智能体总数”变为 `1`
  - 智能体消息展示为正常中文
  - 资源日志 `topic` 展示为“模型评估与过拟合”
