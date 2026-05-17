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

推荐使用标准 Python，不要使用 Anaconda。当前本机建议解释器为 `D:\Python\python.exe`。

```powershell
cd a3-ai-python
D:\Python\python.exe -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip setuptools wheel
.\.venv\Scripts\python.exe -m pip install -e .[dev]
Copy-Item .env.example .env
```

## 3. 启动 AI 服务

推荐统一使用仓库脚本：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-ai-local.ps1
```

如果需要热更新：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-ai-local.ps1 -Reload
```

如果只想手动直接启动 `uvicorn`，也请固定使用项目 `.venv`：

```powershell
cd a3-ai-python
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 18080
```

请不要直接使用系统 `python`、`uvicorn` 或 Anaconda 环境启动，否则容易出现错误 Python 抢占 `18080` 端口的问题。

访问地址：

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
cd a3-ai-python
.\.venv\Scripts\python.exe -m alembic upgrade head
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

- AI 服务本地开发请统一保留一个 `18080` 实例，避免多套 `uvicorn` 并行抢端口。
- `scripts/start-ai-local.ps1` 默认会先执行数据库迁移，再启动 `uvicorn`。
- 如需跳过迁移，可执行：`powershell -ExecutionPolicy Bypass -File .\scripts\start-ai-local.ps1 -SkipMigrations`
- 如需启用真实模型，请先在 `a3-ai-python/.env` 中配置 LLM 与 Embedding 相关参数。
