# AI Service Plan Resource Upgrade Summary

## Problem

- `a3-ai-python` 的学习计划、资源生成、画像、评估和部分 agent 节点仍停留在占位实现，接口结果偏薄，不适合直接作为 A3 成品能力展示。
- README 与个别默认文案仍有乱码残留。

## Root Cause

- 前期先搭了企业化骨架，但领域输出结构和多智能体节点尚未补全。
- 部分文件来自早期编码异常内容，没有彻底清理。

## Changes

- 升级学习计划接口：
  - 新增 `daily_study_minutes`
  - 返回 `course_name`、`progress_hint`、`next_action`、`risk_alerts`
  - 每日步骤增加 `objective`、`checkpoint`
- 升级资源生成接口：
  - 返回 `recommended_order`
  - 资源卡增加 `source_titles`、`study_suggestion`
- 将 `planner_agent` 和 `resource_agent` 从占位逻辑改为真实调用领域服务。
- 清理 `chat_service`、`evaluator_agent`、`profile_service`、`evaluation_service` 中的乱码文案。
- 重写 `a3-ai-python/README.md`，恢复为可读中文说明。

## Verification

- `a3-ai-python/.venv/Scripts/python -m compileall a3-ai-python/app`
- `POST http://127.0.0.1:18080/api/v1/plan/generate`
- `POST http://127.0.0.1:18080/api/v1/resource/generate`
- `POST http://127.0.0.1:18080/api/v1/profile/build`
- `POST http://127.0.0.1:18080/api/v1/evaluation`
- `POST http://127.0.0.1:18080/api/v1/chat`

## Note

- 当前 `18080` 端口上存在不止一个本机 `uvicorn` 进程，说明你的环境里可能还有别的启动方式在并行运行，后续联调前建议统一保留一个 AI 服务实例。
