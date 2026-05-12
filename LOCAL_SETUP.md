# 本地启动说明

## 1. 启动前结论

当前仓库建议按“依赖容器 -> MySQL 初始化 -> Java 服务 -> Python AI 服务 -> 前端”的顺序启动。

如果只演示学习路径/测评主链路，最低只需要：

- MySQL
- Redis
- RabbitMQ
- `a3-learning`
- `a3-portal-web`

如果要演示 RAG、画像、资源生成、智能辅导、后台 AI 摘要，则还需要：

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

默认账号：

- MySQL root：`root / a3mysql123`
- PostgreSQL：`a3_ai / a3_ai_123`
- RabbitMQ：`guest / guest`
- MinIO：`minioadmin / minioadmin`

## 3. 初始化 MySQL

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\init-mysql.ps1
```

如需连接自有 MySQL：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\init-mysql.ps1 -DbHost 127.0.0.1 -Port 3306 -User root -Password 你的密码
```

当前脚本会初始化这些库：

- `tj_auth`
- `tj_course`
- `tj_learning`
- `tj_media`
- `tj_message`
- `tj_pay`
- `tj_promotion`
- `tj_remark`
- `tj_search`
- `tj_trade`
- `tj_user`
- `a3_exam`

说明：

- `scripts\init-mysql.ps1` 依赖命令行 `mysql` 可执行文件
- `sql\tj_learning.sql` 已整理为可直接导入版本
- 仓库内额外提供 `sql\tj_learning_evaluation_demo_ascii.sql` 作为测评/错题演示数据补充
- 当前仓库内没有 `tj_data` 初始化脚本

## 4. 启动 Java 学习服务

```powershell
.\mvnw.cmd -f .\a3-learning\pom.xml -DskipTests spring-boot:run "-Dspring-boot.run.profiles=local"
```

本地访问：

- 学习服务：`http://127.0.0.1:8090`

当前 `local` 配置已默认关闭：

- Nacos 配置中心/服务发现
- MQ 监听自动消费
- XXL-Job
- Redisson

关键本地配置位置：

- [a3-learning/src/main/resources/application-local.yml](/F:/A3-cnsoftbei/a3-learning-agent-system/a3-learning/src/main/resources/application-local.yml)
- [a3-learning/src/main/resources/bootstrap-local.yml](/F:/A3-cnsoftbei/a3-learning-agent-system/a3-learning/src/main/resources/bootstrap-local.yml)

## 5. 启动 Java 网关

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-gateway-local.ps1
```

本地访问：

- 网关：`http://127.0.0.1:10010`

本地 AI 路由：

- `/ai/** -> http://127.0.0.1:18080/api/**`
- `/ai/api/** -> http://127.0.0.1:18080/**`

说明：

- 学生端和管理端的大部分 AI 能力默认通过网关 `10010` 访问
- 若只演示 `a3-learning`，可暂时不启动网关

## 6. 启动 Python AI 服务

推荐按 `a3-ai-python\README.md` 执行：

1. 复制 `.env.example` 为 `.env`
2. 执行数据库迁移
3. 使用项目虚拟环境启动

示例命令：

```powershell
cd .\a3-ai-python
alembic upgrade head
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 18080
```

说明：

- 不建议直接使用系统 `python` 或 Anaconda 环境启动
- AI 服务依赖 PostgreSQL、Redis、Milvus、MinIO
- 默认端口为 `18080`

可用自检接口：

```powershell
Invoke-RestMethod -Method Get http://127.0.0.1:18080/api/v1/admin/llm/ping
Invoke-RestMethod -Method Get http://127.0.0.1:18080/api/v1/admin/embedding/ping
```

## 7. 启动前端

### 管理端

```powershell
cd .\a3-admin-web
npm install
npm run dev
```

访问地址：`http://127.0.0.1:18081`

说明：

- 默认通过 Vite 代理访问本地网关 `http://127.0.0.1:10010`
- `npm run dev:upstream` 可切到外部联调地址

### 学生端

```powershell
cd .\a3-portal-web
npm install
npm run dev
```

访问地址：`http://127.0.0.1:18082`

说明：

- `/api` 默认代理到 `http://127.0.0.1:8090`
- `/aigw` 默认代理到 `http://127.0.0.1:18080`
- 学生端本地不强依赖网关即可演示学习路径/测评页面

## 8. 推荐启动顺序

### 只演示学习路径/测评链路

1. `docker compose -f .\docker-compose.local.yml up -d`
2. `powershell -ExecutionPolicy Bypass -File .\scripts\init-mysql.ps1`
3. `.\mvnw.cmd -f .\a3-learning\pom.xml -DskipTests spring-boot:run "-Dspring-boot.run.profiles=local"`
4. 启动 `a3-portal-web`

### 演示完整 AI 链路

1. `docker compose -f .\docker-compose.local.yml up -d`
2. `powershell -ExecutionPolicy Bypass -File .\scripts\init-mysql.ps1`
3. 启动 `a3-learning`
4. 启动 `a3-ai-python`
5. 启动 `a3-gateway`
6. 启动 `a3-portal-web`
7. 启动 `a3-admin-web`

## 9. 可用脚本

- [scripts/init-mysql.ps1](/F:/A3-cnsoftbei/a3-learning-agent-system/scripts/init-mysql.ps1)：初始化 MySQL 基础库
- [scripts/start-gateway-local.ps1](/F:/A3-cnsoftbei/a3-learning-agent-system/scripts/start-gateway-local.ps1)：启动本地网关
- [scripts/start-learning-evaluation-local.ps1](/F:/A3-cnsoftbei/a3-learning-agent-system/scripts/start-learning-evaluation-local.ps1)：导入测评演示数据并重启学习服务
- [scripts/verify-intelligent-tutoring-local.ps1](/F:/A3-cnsoftbei/a3-learning-agent-system/scripts/verify-intelligent-tutoring-local.ps1)：验证 AI 辅导链路
