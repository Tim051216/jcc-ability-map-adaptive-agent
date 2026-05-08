# AI Async Task Polling Summary

## 问题

AI 演示页原来通过单次长连接直接等待 `/chat` 返回，综合场景耗时较长时，前端体验差且容易被本地开发代理影响。

## 根因

- `comprehensive` 场景会串行执行检索、计划生成、资源生成、评估等多个节点
- 前端直接等待单次长请求，无法展示任务执行中状态
- 缺少正式的任务提交与轮询接口

## 变更

- AI 服务新增异步任务接口：
  - `POST /api/v1/chat/tasks`
  - `GET /api/v1/chat/tasks/{task_id}`
- 使用 `ai_generation_task` 记录聊天任务状态与结果
- 前端演示页改为“提交任务 + 轮询状态 + 完成后展示结果”
- 页面会显示任务执行中状态，例如 `任务执行中 #5`

## 验证

- Python 代码编译通过：`compileall app`
- 前端源码编译检查通过：`compileall src`
- 直连 AI 服务验证：
  - `POST http://127.0.0.1:18080/api/v1/chat/tasks`
  - `GET http://127.0.0.1:18080/api/v1/chat/tasks/{id}`
- 网关验证：
  - `POST http://127.0.0.1:10010/ai/v1/chat/tasks`
- 浏览器验证：
  - 打开 `http://127.0.0.1:18082/#/main/ai-demo`
  - 点击“运行演示链路”
  - 页面先显示任务执行中，再自动展示实时结果
