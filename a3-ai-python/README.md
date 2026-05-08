# a3-ai-python

`a3-ai-python` 是 A3 赛题的 Python AI 中台，负责：

- 对话式学习助手
- RAG 知识入库与检索
- 多智能体协同编排
- 个性化学习路径规划
- 多类型学习资源生成
- 学习效果评估与治理

## 技术栈

- FastAPI
- LangGraph
- PostgreSQL
- Redis
- Celery
- Milvus
- MinIO

## 目录说明

- `app/api`：对外 HTTP API
- `app/core`：配置、日志、异常、常量
- `app/db`：数据库模型与会话
- `app/schemas`：请求与响应模型
- `app/services`：领域服务
- `app/agents`：多智能体状态流与节点
- `app/rag`：文档入库、检索、向量存储
- `app/integrations`：模型、Java 服务、对象存储、队列等集成

## 对外路由

通过 Java 网关访问时，建议统一走：

- `/ai/v1/chat`
- `/ai/v1/profile/build`
- `/ai/v1/plan/generate`
- `/ai/v1/resource/generate`
- `/ai/v1/rag/search`
- `/ai/v1/admin/knowledge/{course_code}/ingest`

## 本地启动

1. 复制 `.env.example` 为 `.env`
2. 在仓库根目录启动 `docker-compose.local.yml`
3. 初始化数据库迁移

```powershell
alembic upgrade head
```

4. 安装依赖后运行

```powershell
uvicorn app.main:app --reload --host 0.0.0.0 --port 18080
```

## 当前能力

当前版本已经具备可联调的企业化骨架，重点包括：

- Java 网关到 Python AI 服务的 `/ai/**` 路由设计
- Milvus 向量库接入
- 本地 Markdown 课程知识入库与检索
- 学习问答、学习计划、资源生成、学习画像和效果评估接口
- 可继续接入真实 LLM 与真实 Embedding 模型
