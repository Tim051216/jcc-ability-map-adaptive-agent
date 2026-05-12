# 人工兜底工单后端补齐摘要

## problem
- 原有智能辅导后端只有 AI 对话与异步任务，没有疑难问题升级、后台处理和人工回复闭环。

## root cause
- 缺少工单与工单回复的数据模型、接口和状态流转能力，导致“AI 无法解答时人工兜底”只能停留在需求层。

## changes
- 新增工单与工单回复模型、仓储和迁移：
  - `ai_chat_ticket`
  - `ai_chat_ticket_reply`
- 新增工单接口：
  - `POST /api/v1/chat/tickets`
  - `GET /api/v1/chat/tickets`
  - `GET /api/v1/chat/tickets/{ticket_id}`
  - `POST /api/v1/chat/tickets/{ticket_id}/reply`
  - `PUT /api/v1/chat/tickets/{ticket_id}/status`
- 扩展聊天 schema，支持工单创建、回复、状态更新和详情返回。
- 新增工单服务，接通“升级 -> 列表 -> 详情 -> 回复 -> 状态流转”链路。

## verification
- 运行 `python -m compileall app`
- 编译通过
