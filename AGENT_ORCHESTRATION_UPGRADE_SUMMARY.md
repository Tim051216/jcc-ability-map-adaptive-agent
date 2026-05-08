# Agent Orchestration Upgrade Summary

## Problem

- 原有 `a3-ai-python` agent 流程是固定串行执行：
  - `profile -> retriever -> planner -> resource -> evaluator -> safety`
- 无论用户是普通问答、学习计划还是资源生成，都会走同一条直线链路，不像正式多智能体编排。

## Root Cause

- 早期实现主要为了先打通 LangGraph 骨架，没有把 `scene`、用户意图和按需执行节点真正接入编排逻辑。

## Changes

- 重写 `app/agents/graph.py`
  - 改为条件路由图，而不是固定直线流程
- 新增 `app/agents/nodes/router_agent.py`
  - 根据 `scene` 和问题内容识别意图
  - 决定是否需要检索、计划、资源生成
- 扩展 `app/agents/state.py`
  - 新增 `scene`
  - 新增 `intent`
  - 新增 `requested_outputs`
  - 新增 `execution_trace`
- 重写各节点：
  - `profile_agent`
  - `retriever_agent`
  - `planner_agent`
  - `resource_agent`
  - `evaluator_agent`
  - `safety_agent`
- 重写 `app/services/chat_service.py`
  - 把 `scene` 注入 graph
  - 初始化执行轨迹
- `evaluator_agent` 现在会根据意图输出不同结果：
  - `qa`
  - `study_plan`
  - `resource_generation`
  - `comprehensive`

## Verification

- `a3-ai-python/.venv/Scripts/python -m compileall a3-ai-python/app`
- `POST /api/v1/chat` with `scene=study_assistant`
- `POST /api/v1/chat` with `scene=study_plan`
- `POST /api/v1/chat` with `scene=resource_generation`
- `POST /api/v1/chat` with `scene=comprehensive`

## Result

- 普通问答场景：输出课程问答结果
- 学习计划场景：输出学习计划摘要
- 资源生成场景：输出资源推荐摘要
- 综合场景：可同时输出问答、学习计划和资源建议
