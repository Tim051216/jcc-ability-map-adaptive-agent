# 异步辅导与 RAG 非阻塞修复摘要

## 问题
- 智能辅导异步任务虽然能提交，但轮询状态接口长时间卡住，前端无法稳定展示完成结果。

## 根因
- 综合辅导链路中的 RAG 检索会触发 Milvus 同步客户端初始化与检索，容易阻塞事件循环。
- 学习评估结果持久化依赖本地数据库，数据库抖动时会拖慢甚至影响主链路返回。

## 变更
- 将 `RagService` 中的 Milvus 初始化与检索整体下沉到 `asyncio.to_thread(...)`，并增加超时与空结果降级。
- 将 `EvaluationService` 的评估落库改为 best-effort，不再因为本地数据库异常阻塞辅导结果返回。
- 建议本地统一使用项目 `.venv` 启动 `uvicorn app.main:app --host 127.0.0.1 --port 18080`，避免与 Anaconda 进程混跑。

## 验证
- `python -m compileall a3-ai-python/app`
- 健康检查：`GET http://127.0.0.1:18080/health`
- 异步辅导任务验证：`POST /api/v1/chat/tasks` 后轮询 `GET /api/v1/chat/tasks/{id}`，状态可从 `pending/running` 走到 `completed`
- 资源生成验证：`POST /api/v1/resource/generate` 可返回资源列表与推荐顺序
