# 聊天异步任务统计摘要总结

## problem
- 聊天后端已有异步任务提交与状态查询接口，但缺少适合后台或演示页展示的任务统计摘要接口。

## root cause
- 聊天异步任务同时存在数据库任务与内存 fallback 任务，但没有独立聚合层对两类任务统一做状态统计输出。

## changes
- 在 `a3-ai-python/app/services/chat_task_summary_service.py` 新增聊天异步任务统计摘要服务。
- 在 `a3-ai-python/app/api/v1/chat.py` 新增 `/tasks/summary` 接口。
- 在 `a3-ai-python/app/schemas/chat.py` 新增 `ChatTaskSummaryResponse`。
- 新增 `test_chat_task_summary_service.py`，并扩展 `test_chat_api.py`。

## verification
- `python -m pytest app\tests\test_chat_api.py app\tests\test_chat_task_summary_service.py`
- `python -m pytest app\tests\test_chat_api.py app\tests\test_chat_service.py app\tests\test_chat_task_service.py app\tests\test_chat_task_summary_service.py app\tests\test_chat_ticket_service.py app\tests\test_chat_ticket_summary_service.py`
