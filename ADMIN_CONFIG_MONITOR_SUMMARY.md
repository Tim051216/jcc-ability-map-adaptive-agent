# 系统配置与智能体监控后端补齐摘要

## problem
- 原有后台缺少系统配置管理和智能体监控接口，后台管控端无法接入真实配置数据和智能体运行状态。

## root cause
- 缺少配置项与智能体运行日志的数据模型、仓储和接口，监控页与配置页只能停留在演示层。

## changes
- 新增系统配置模型、仓储和迁移：
  - `ai_system_config`
- 新增智能体运行日志模型和迁移：
  - `ai_agent_runtime_log`
- 新增后台配置接口：
  - `GET /api/v1/admin/configs`
  - `PUT /api/v1/admin/configs/{config_key}`
- 新增后台智能体监控接口：
  - `GET /api/v1/admin/agents/status`
  - `GET /api/v1/admin/agents/logs`
- 扩展后台服务，配置更新会写入 `ai_audit_log`，智能体状态支持无数据时的默认概览返回。

## verification
- 运行 `python -m compileall app`
- 编译通过
