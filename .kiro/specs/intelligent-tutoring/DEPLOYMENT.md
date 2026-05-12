# 智能辅导系统 - 部署指南

## 系统架构

```
┌─────────────────┐
│   前端 (Vue 3)   │
│  a3-admin-web   │
└────────┬────────┘
         │ HTTP
         ↓
┌─────────────────┐
│  API Gateway    │
│   (Spring)      │
└────────┬────────┘
         │
    ┌────┴────┐
    ↓         ↓
┌─────────┐ ┌──────────────┐
│ Java    │ │ Python AI    │
│ 服务    │ │ 服务         │
│ (MySQL) │ │ (PostgreSQL) │
└─────────┘ └──────┬───────┘
                   │
              ┌────┴────┐
              ↓         ↓
         ┌────────┐ ┌────────┐
         │ Milvus │ │  LLM   │
         │ (RAG)  │ │  API   │
         └────────┘ └────────┘
```

## 前置要求

### 软件环境

- **Java**: JDK 11+
- **Python**: 3.10+
- **Node.js**: 16+
- **MySQL**: 8.0+
- **PostgreSQL**: 14+
- **Redis**: 6.0+
- **Milvus**: 2.3+ (可选，用于 RAG)

### 硬件要求

**最低配置**:
- CPU: 4 核
- 内存: 8GB
- 磁盘: 50GB

**推荐配置**:
- CPU: 8 核
- 内存: 16GB
- 磁盘: 100GB SSD

## 部署步骤

### 1. 数据库初始化

#### MySQL (Java 服务)

```bash
# 连接 MySQL
mysql -u root -p

# 创建数据库
source sql/tj_learning.sql
source sql/tj_tutoring.sql

# 验证表创建
USE tj_learning;
SHOW TABLES;
```

#### PostgreSQL (Python AI 服务)

```bash
# 连接 PostgreSQL
psql -U postgres

# 创建数据库
CREATE DATABASE a3_ai;

# 运行迁移
cd a3-ai-python
poetry run alembic upgrade head
```

### 2. 后端服务部署

#### Java 服务

```bash
# 1. 编译所有模块
.\mvnw.cmd clean package -DskipTests

# 2. 启动服务（按顺序）
# 注意：需要先启动 Nacos、Redis 等基础设施

# 启动网关
cd a3-gateway
java -jar target/a3-gateway.jar

# 启动学习服务
cd a3-learning
java -jar target/a3-learning.jar

# 其他服务...
```

#### Python AI 服务

```bash
cd a3-ai-python

# 1. 安装依赖
poetry install

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env 文件，配置数据库、LLM API 等

# 3. 启动服务
poetry run uvicorn app.main:app --host 0.0.0.0 --port 8000

# 或使用 Gunicorn (生产环境)
poetry run gunicorn app.main:app \
  --workers 4 \
  --worker-class uvicorn.workers.UvicornWorker \
  --bind 0.0.0.0:8000
```

### 3. 前端部署

```bash
cd a3-admin-web

# 1. 安装依赖
npm install

# 2. 安装辅导模块依赖
npm install marked mermaid date-fns katex highlight.js

# 3. 配置环境变量
# 编辑 .env.production
VUE_APP_API_BASE_URL=http://your-gateway-url
VUE_APP_AI_API_BASE_URL=http://your-ai-service-url

# 4. 构建生产版本
npm run build:prod

# 5. 部署到 Nginx
# 将 dist/ 目录内容复制到 Nginx 静态文件目录
```

### 4. Nginx 配置

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 前端静态文件
    location / {
        root /var/www/a3-admin-web;
        try_files $uri $uri/ /index.html;
    }

    # API 网关代理
    location /api/ {
        proxy_pass http://localhost:8080/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # AI 服务代理
    location /ai/ {
        proxy_pass http://localhost:8000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # WebSocket 支持（可选）
    location /ws/ {
        proxy_pass http://localhost:8000/ws/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

## Docker 部署

### Docker Compose

```yaml
version: '3.8'

services:
  # MySQL
  mysql:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: root123
      MYSQL_DATABASE: tj_learning
    volumes:
      - ./sql:/docker-entrypoint-initdb.d
      - mysql-data:/var/lib/mysql
    ports:
      - "3306:3306"

  # PostgreSQL
  postgres:
    image: postgres:14
    environment:
      POSTGRES_PASSWORD: postgres123
      POSTGRES_DB: a3_ai
    volumes:
      - postgres-data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  # Redis
  redis:
    image: redis:6-alpine
    ports:
      - "6379:6379"

  # Python AI 服务
  ai-service:
    build: ./a3-ai-python
    environment:
      DATABASE_URL: postgresql://postgres:postgres123@postgres:5432/a3_ai
      REDIS_URL: redis://redis:6379
      LLM_API_KEY: ${LLM_API_KEY}
    depends_on:
      - postgres
      - redis
    ports:
      - "8000:8000"

  # Java 网关
  gateway:
    build: ./a3-gateway
    environment:
      SPRING_DATASOURCE_URL: jdbc:mysql://mysql:3306/tj_learning
      SPRING_REDIS_HOST: redis
    depends_on:
      - mysql
      - redis
    ports:
      - "8080:8080"

  # 前端
  frontend:
    build: ./a3-admin-web
    ports:
      - "80:80"
    depends_on:
      - gateway
      - ai-service

volumes:
  mysql-data:
  postgres-data:
```

启动：

```bash
docker-compose up -d
```

## 配置说明

### Python AI 服务配置 (.env)

```env
# 数据库
DATABASE_URL=postgresql://user:password@localhost:5432/a3_ai

# Redis
REDIS_URL=redis://localhost:6379

# LLM API
LLM_API_BASE_URL=https://api.openai.com/v1
LLM_API_KEY=your-api-key
LLM_MODEL=gpt-4

# Milvus (RAG)
MILVUS_HOST=localhost
MILVUS_PORT=19530

# 对象存储 (MinIO/OSS)
STORAGE_ENDPOINT=http://localhost:9000
STORAGE_ACCESS_KEY=minioadmin
STORAGE_SECRET_KEY=minioadmin

# 日志
LOG_LEVEL=INFO
```

### Java 服务配置 (application.yml)

```yaml
spring:
  datasource:
    url: jdbc:mysql://localhost:3306/tj_learning
    username: root
    password: root123
  
  redis:
    host: localhost
    port: 6379

# 其他配置...
```

## 验证部署

### 1. 健康检查

```bash
# Python AI 服务
curl http://localhost:8000/health

# Java 网关
curl http://localhost:8080/actuator/health
```

### 2. 功能测试

```bash
# 提交问题
curl -X POST http://localhost:8000/api/v1/tutoring/question \
  -H "Content-Type: application/json" \
  -d '{
    "question_text": "什么是递归？",
    "course_id": 1
  }'

# 获取解答
curl http://localhost:8000/api/v1/tutoring/answer/1
```

### 3. 前端访问

打开浏览器访问：`http://localhost` 或 `http://your-domain.com`

导航到"智能辅导"模块，测试：
1. 提交问题
2. 查看解答
3. 评价功能
4. 历史记录

## 监控和日志

### 日志位置

- **Python AI 服务**: `a3-ai-python/logs/app.log`
- **Java 服务**: `a3-learning/logs/learning.log`
- **Nginx**: `/var/log/nginx/access.log`, `/var/log/nginx/error.log`

### 监控指标

使用 Prometheus + Grafana 监控：

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'ai-service'
    static_configs:
      - targets: ['localhost:8000']
  
  - job_name: 'java-services'
    static_configs:
      - targets: ['localhost:8080']
```

## 故障排查

### 常见问题

#### 1. AI 服务启动失败

**症状**: `uvicorn` 启动报错

**解决方案**:
```bash
# 检查依赖
poetry install

# 检查数据库连接
poetry run python -c "from app.db.session import engine; print(engine)"

# 查看详细日志
poetry run uvicorn app.main:app --log-level debug
```

#### 2. 解答生成失败

**症状**: 提交问题后返回错误

**可能原因**:
- LLM API 配置错误
- API 密钥无效
- 网络连接问题

**解决方案**:
```bash
# 检查 LLM API 配置
echo $LLM_API_KEY

# 测试 API 连接
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $LLM_API_KEY"
```

#### 3. 图表不显示

**症状**: Mermaid 图表无法渲染

**解决方案**:
- 检查浏览器控制台错误
- 确认 Mermaid 库已加载
- 验证 Mermaid 代码语法

#### 4. 数据库连接失败

**症状**: 服务启动时报数据库连接错误

**解决方案**:
```bash
# 检查数据库是否运行
mysql -u root -p -e "SELECT 1"
psql -U postgres -c "SELECT 1"

# 检查连接配置
# 确认主机、端口、用户名、密码正确
```

## 性能优化

### 1. 数据库优化

```sql
-- 添加索引
CREATE INDEX idx_question_user_time ON tutoring_question(user_id, create_time);
CREATE INDEX idx_answer_question ON tutoring_answer(question_id);

-- 分析查询性能
EXPLAIN SELECT * FROM tutoring_question WHERE user_id = 1;
```

### 2. 缓存策略

```python
# Redis 缓存解答
from redis import Redis

redis_client = Redis(host='localhost', port=6379)

def get_cached_answer(question_id):
    cache_key = f"answer:{question_id}"
    cached = redis_client.get(cache_key)
    if cached:
        return json.loads(cached)
    return None

def cache_answer(question_id, answer, ttl=3600):
    cache_key = f"answer:{question_id}"
    redis_client.setex(cache_key, ttl, json.dumps(answer))
```

### 3. 并发处理

```python
# 使用 Celery 异步处理
from celery import Celery

celery_app = Celery('tutoring', broker='redis://localhost:6379')

@celery_app.task
def generate_answer_async(question_id):
    # 异步生成解答
    pass
```

## 安全建议

1. **API 认证**: 使用 JWT 或 OAuth2
2. **HTTPS**: 生产环境必须使用 HTTPS
3. **输入验证**: 严格验证用户输入
4. **敏感词过滤**: 过滤不当内容
5. **速率限制**: 防止 API 滥用
6. **数据加密**: 敏感数据加密存储

## 备份策略

### 数据库备份

```bash
# MySQL 备份
mysqldump -u root -p tj_learning > backup_$(date +%Y%m%d).sql

# PostgreSQL 备份
pg_dump -U postgres a3_ai > backup_$(date +%Y%m%d).sql
```

### 自动备份脚本

```bash
#!/bin/bash
# backup.sh

BACKUP_DIR=/var/backups/a3-system
DATE=$(date +%Y%m%d_%H%M%S)

# 创建备份目录
mkdir -p $BACKUP_DIR

# 备份 MySQL
mysqldump -u root -p$MYSQL_PASSWORD tj_learning > $BACKUP_DIR/mysql_$DATE.sql

# 备份 PostgreSQL
pg_dump -U postgres a3_ai > $BACKUP_DIR/postgres_$DATE.sql

# 压缩备份
tar -czf $BACKUP_DIR/backup_$DATE.tar.gz $BACKUP_DIR/*_$DATE.sql

# 删除旧备份（保留7天）
find $BACKUP_DIR -name "backup_*.tar.gz" -mtime +7 -delete
```

添加到 crontab：

```bash
# 每天凌晨2点备份
0 2 * * * /path/to/backup.sh
```

## 扩展性

### 水平扩展

1. **负载均衡**: 使用 Nginx 或 HAProxy
2. **数据库读写分离**: 主从复制
3. **缓存集群**: Redis Cluster
4. **服务实例**: 多实例部署

### 垂直扩展

1. **增加服务器资源**: CPU、内存、磁盘
2. **数据库优化**: 索引、查询优化
3. **代码优化**: 算法优化、异步处理

## 联系支持

如有问题，请联系：
- 技术支持: support@example.com
- 文档: https://docs.example.com
- GitHub: https://github.com/your-org/a3-system
