# AI Service Local Setup

## 1. 启动基础依赖

在仓库根目录执行：
```powershell
docker compose -f docker-compose.local.yml up -d postgres redis rabbitmq minio etcd milvus
```

如果 Java 微服务也要联调，可以同时启动：
```powershell
docker compose -f docker-compose.local.yml up -d mysql
```

## 2. 初始化 Python 环境

推荐 Python `3.11+`。
```powershell
cd a3-ai-python
python -m venv .venv
.venv\Scripts\activate
pip install -e .[dev]
Copy-Item .env.example .env
```

## 3. 启动 AI 服务

```powershell
uvicorn app.main:app --reload --host 0.0.0.0 --port 18080
```

访问：
- 健康检查：`http://127.0.0.1:18080/health`
- OpenAPI：`http://127.0.0.1:18080/docs`

通过网关访问时：
- `http://127.0.0.1:10010/ai/v1/chat`
- `http://127.0.0.1:10010/ai/v1/rag/search`

本地知识库示例：
- `a3-ai-python/knowledge_base/ml_intro`

入库示例：
```powershell
Invoke-RestMethod -Method Post http://127.0.0.1:18080/api/v1/admin/knowledge/ml_intro/ingest
```

检索示例：
```powershell
Invoke-RestMethod -Method Post http://127.0.0.1:18080/api/v1/rag/search -ContentType 'application/json' -Body '{"course_code":"ml_intro","query":"什么是过拟合","top_k":3}'
```

数据库迁移：
```powershell
alembic upgrade head
```

## 4. 当前环境端口

- PostgreSQL: `15432`
- Redis: `16379`
- RabbitMQ: `5672`
- MinIO API: `19000`
- MinIO Console: `19001`
- Milvus gRPC: `19530`
- Milvus metrics: `19091`
- AI Service: `18080`

## 5. 网关联调

本地联调 Java 网关到 Python AI 服务时，可以直接使用：

```powershell
.\scripts\start-gateway-local.ps1
```

或者手动执行：

```powershell
.\mvnw.cmd -f a3-gateway\pom.xml spring-boot:run -Dspring-boot.run.profiles=local -DskipTests
```

已验证可用的网关地址：

- `http://127.0.0.1:10010/ai/v1/admin/ping`
- `http://127.0.0.1:10010/ai/v1/rag/search`

## 6. 注意事项

- 当前已经具备企业化骨架，数据库迁移、Milvus collection 建表、课程知识入库和检索链路都可本地验证。
- 已新增 Java 网关到本地 Python AI 服务的 `/ai/**` 路由，并已完成本地验证。
- `a3-gateway` 的 `local` 模式已禁用 Nacos，并放行 `/ai/**` 方便本地联调。
- 如果要启用真实 embedding，请在 `.env` 中填写 `EMBEDDING_BASE_URL`、`EMBEDDING_API_KEY` 和 `EMBEDDING_MODEL`。
