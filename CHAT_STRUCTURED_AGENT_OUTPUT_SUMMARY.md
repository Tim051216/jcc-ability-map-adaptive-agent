# Chat Structured Agent Output Summary

## Problem

- 虽然 `chat` 已经升级成路由式多智能体编排，但响应仍主要是一段文本，不利于前端可视化展示 agent 执行过程。

## Root Cause

- `ChatResponse` 还没有暴露意图识别结果、执行轨迹以及子 agent 的结构化产出。

## Changes

- 扩展 `a3-ai-python/app/schemas/chat.py`
  - 新增 `intent`
  - 新增 `agent_trace`
  - 新增 `generated_plan`
  - 新增 `generated_resources`
- 重写 `a3-ai-python/app/services/chat_service.py`
  - 将 graph 状态中的结构化字段映射到响应
- 清理并重写 `a3-ai-python/app/agents/nodes/evaluator_agent.py`
  - 修复残留乱码
  - 保持不同场景下的文本输出逻辑稳定

## Verification

- `POST /api/v1/chat` with `scene=study_assistant`
- `POST /api/v1/chat` with `scene=study_plan`
- `POST /api/v1/chat` with `scene=comprehensive`

## Result

- 问答场景可返回：
  - `intent=qa`
  - `agent_trace`
- 学习计划场景可额外返回：
  - `generated_plan`
- 综合场景可同时返回：
  - `intent`
  - `agent_trace`
  - `generated_plan`
  - `generated_resources`
