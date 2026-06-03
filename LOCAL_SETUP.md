# 本地启动说明

## 1. 启动顺序

建议按下面顺序启动：

1. 依赖容器
2. MySQL 初始化
3. `a3-learning`
4. `a3-ai-python`
5. `a3-gateway`
6. 前端

如果只演示学习路径、测评和错题主链路，最低只需要：

- MySQL
- Redis
- RabbitMQ
- `a3-learning`
- `a3-student-react-web`

如果要演示 RAG、画像、资源生成、智能辅导和管理端 AI 摘要，还需要：

- PostgreSQL
- MinIO
- Etcd
- Milvus
- `a3-ai-python`
- `a3-gateway`

## 2. 启动依赖容器

```powershell
docker compose -f .\docker-compose.local.yml up -d
```

默认端口：

- MySQL：`127.0.0.1:13306`
- Redis：`127.0.0.1:16379`
- RabbitMQ：`127.0.0.1:5672`
- RabbitMQ 管理台：`http://127.0.0.1:15672`
- PostgreSQL：`127.0.0.1:15432`
- MinIO API：`http://127.0.0.1:19000`
- MinIO Console：`http://127.0.0.1:19001`
- Etcd：`127.0.0.1:12379`
- Milvus：`127.0.0.1:19530`

## 3. 初始化 MySQL

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\init-mysql.ps1
```

如需补充学生端/AI 联调演示数据，可继续执行：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\init-local-demo-data.ps1
```

如果要连接自有 MySQL：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\init-mysql.ps1 -DbHost 127.0.0.1 -Port 3306 -User root -Password 你的密码
```

## 4. 启动 Java 学习服务

```powershell
.\mvnw.cmd -f .\a3-learning\pom.xml -DskipTests spring-boot:run "-Dspring-boot.run.profiles=local"
```

本地访问：

- 学习服务：`http://127.0.0.1:8090`

## 5. 启动 Java 网关

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-gateway-local.ps1
```

本地访问：

- 网关：`http://127.0.0.1:10010`

本地 AI 路由：

- `/ai/** -> http://127.0.0.1:18080/api/**`
- `/ai/api/** -> http://127.0.0.1:18080/**`

## 6. 启动 Python AI 服务

推荐统一使用标准 Python 和仓库脚本，不要使用系统 `python`、裸 `uvicorn` 或 Anaconda 环境。

首次初始化：

```powershell
cd .\a3-ai-python
D:\Python\python.exe -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip setuptools wheel
.\.venv\Scripts\python.exe -m pip install -e .[dev]
Copy-Item .env.example .env
```

推荐启动命令：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-ai-local.ps1
```

如需热更新：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-ai-local.ps1 -Reload
```

如需跳过迁移：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-ai-local.ps1 -SkipMigrations
```

手动启动时也必须固定使用项目 `.venv`：

```powershell
cd .\a3-ai-python
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 18080
```

说明：

- AI 服务依赖 PostgreSQL、Redis、Milvus、MinIO
- 默认端口为 `18080`
- 本地请只保留一个 `18080` 实例，避免错误 Python 抢占端口
- 如果本机 PostgreSQL `127.0.0.1:15432` 未启动，当前仓库中的 `a3-ai-python` 会自动切换到本地 SQLite 持久化文件：
  `a3-ai-python/local_data/a3_ai_local.db`
- 这能保证资源中心、AI 导师、运营后台等演示链路继续可用；当 PostgreSQL 恢复后，AI 服务会重新优先使用 `.env` 中的 `POSTGRES_DSN`

### PostgreSQL 恢复建议

如果你要切回企业版 PostgreSQL 持久化，请按下面顺序排查：

1. 启动 Docker Desktop，确认本机 Docker daemon 可用
2. 执行 `docker compose -f .\docker-compose.local.yml up -d postgres`
3. 确认 `127.0.0.1:15432` 已监听
4. 重启 `a3-ai-python`

如果当前机器没有 Docker / PostgreSQL 运行时，也可以先继续使用 SQLite fallback 进行本地联调和演示。

可用自检接口：

```powershell
Invoke-RestMethod -Method Get http://127.0.0.1:18080/api/v1/admin/llm/ping
Invoke-RestMethod -Method Get http://127.0.0.1:18080/api/v1/admin/embedding/ping
```

## 7. 启动前端

管理端：

```powershell
cd .\a3-admin-web
npm install
npm run dev
```

访问地址：`http://127.0.0.1:3004`

学生端：

```powershell
cd .\a3-student-react-web
npm install
npm run dev
```

访问地址：`http://127.0.0.1:3002`

## 8. 推荐启动组合

只演示学习路径和测评链路：

1. `docker compose -f .\docker-compose.local.yml up -d`
2. `powershell -ExecutionPolicy Bypass -File .\scripts\init-mysql.ps1`
3. 启动 `a3-learning`
4. 启动 `a3-student-react-web`

演示完整 AI 链路：

1. `docker compose -f .\docker-compose.local.yml up -d`
2. `powershell -ExecutionPolicy Bypass -File .\scripts\init-mysql.ps1`
3. 启动 `a3-learning`
4. 启动 `a3-ai-python`
5. 启动 `a3-gateway`
6. 启动 `a3-student-react-web`
7. 启动 `a3-admin-web`

## 9. 可用脚本

- [scripts/init-mysql.ps1](/F:/A3-cnsoftbei/a3-learning-agent-system/scripts/init-mysql.ps1)：初始化 MySQL
- [scripts/init-local-demo-data.ps1](/F:/A3-cnsoftbei/a3-learning-agent-system/scripts/init-local-demo-data.ps1)：补充本地联调演示数据
- [scripts/start-ai-local.ps1](/F:/A3-cnsoftbei/a3-learning-agent-system/scripts/start-ai-local.ps1)：使用项目 `.venv` 启动本地 AI 服务
- [scripts/start-gateway-local.ps1](/F:/A3-cnsoftbei/a3-learning-agent-system/scripts/start-gateway-local.ps1)：启动本地网关
- [scripts/start-learning-evaluation-local.ps1](/F:/A3-cnsoftbei/a3-learning-agent-system/scripts/start-learning-evaluation-local.ps1)：导入测评演示数据并重启学习服务
- [scripts/verify-intelligent-tutoring-local.ps1](/F:/A3-cnsoftbei/a3-learning-agent-system/scripts/verify-intelligent-tutoring-local.ps1)：验证 AI 辅导链路
