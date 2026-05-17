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
- [scripts/start-ai-local.ps1](/F:/A3-cnsoftbei/a3-learning-agent-system/scripts/start-ai-local.ps1)：使用项目 `.venv` 启动本地 AI 服务
- [scripts/start-gateway-local.ps1](/F:/A3-cnsoftbei/a3-learning-agent-system/scripts/start-gateway-local.ps1)：启动本地网关
- [scripts/start-learning-evaluation-local.ps1](/F:/A3-cnsoftbei/a3-learning-agent-system/scripts/start-learning-evaluation-local.ps1)：导入测评演示数据并重启学习服务
- [scripts/verify-intelligent-tutoring-local.ps1](/F:/A3-cnsoftbei/a3-learning-agent-system/scripts/verify-intelligent-tutoring-local.ps1)：验证 AI 辅导链路
