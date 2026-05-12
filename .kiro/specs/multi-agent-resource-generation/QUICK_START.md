# 多智能体资源生成系统 - 快速启动指南

## 前置条件

### 环境要求
- **Java**: JDK 11+
- **Python**: Python 3.10+
- **Node.js**: Node.js 16+
- **MySQL**: MySQL 8.0+
- **Redis**: Redis 6.0+ (可选)

### 工具要求
- Maven Wrapper (项目自带)
- Poetry (Python 依赖管理)
- npm 或 yarn

## 启动步骤

### 1. 数据库初始化

#### 1.1 创建数据库
```sql
CREATE DATABASE IF NOT EXISTS tj_learning DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

#### 1.2 执行 SQL 脚本
```bash
# 进入项目根目录
cd a3-learning-agent-system

# 执行资源相关表结构
mysql -u root -p tj_learning < sql/tj_learning_resource.sql
```

### 2. 启动 Python AI 服务

#### 2.1 安装依赖
```bash
cd a3-ai-python

# 使用 Poetry 安装依赖
poetry install
```

#### 2.2 配置环境变量
复制 `.env.example` 为 `.env` 并配置:
```bash
cp .env.example .env
```

编辑 `.env` 文件:
```env
# 数据库配置
DATABASE_URL=postgresql://user:password@localhost:5432/a3_ai

# OpenAI API 配置
OPENAI_API_KEY=your_api_key_here
OPENAI_API_BASE=https://api.openai.com/v1

# Milvus 配置
MILVUS_HOST=localhost
MILVUS_PORT=19530

# MinIO 配置
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
```

#### 2.3 运行数据库迁移
```bash
poetry run alembic upgrade head
```

#### 2.4 启动服务
```bash
# 开发模式
poetry run uvicorn app.main:app --reload --port 8000

# 或者使用脚本
poetry run python -m app.main
```

服务将在 `http://localhost:8000` 启动

### 3. 启动 Java 后端服务

#### 3.1 配置数据库连接
编辑 `a3-learning/src/main/resources/application.yml`:
```yaml
spring:
  datasource:
    url: jdbc:mysql://localhost:3306/tj_learning?useUnicode=true&characterEncoding=utf8&serverTimezone=Asia/Shanghai
    username: root
    password: your_password
```

#### 3.2 编译项目
```bash
# 在项目根目录
.\mvnw.cmd clean compile -DskipTests
```

#### 3.3 启动 a3-learning 服务
```bash
cd a3-learning
..\mvnw.cmd spring-boot:run
```

服务将在 `http://localhost:8080` 启动(具体端口查看配置)

### 4. 启动前端服务

#### 4.1 安装依赖
```bash
cd a3-admin-web

# 安装依赖
npm install

# 安装新增的依赖
npm install marked mermaid prismjs
```

#### 4.2 配置 API 地址
编辑 `vite.config.js` 或相关配置文件,设置后端 API 地址:
```javascript
export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',  // Python AI 服务
        changeOrigin: true
      }
    }
  }
})
```

#### 4.3 启动开发服务器
```bash
npm run dev
```

前端将在 `http://localhost:5173` 启动(Vite 默认端口)

## 访问系统

### 1. 登录系统
访问 `http://localhost:5173` 并登录

### 2. 访问资源生成模块
在侧边栏找到 "AI资源生成" 菜单,包含:
- 资源生成
- 资源管理
- 我的收藏

### 3. 生成第一个资源
1. 点击 "资源生成"
2. 选择要生成的资源类型(如"课程讲解文档")
3. 填写任务名称
4. 选择学生、课程和知识点
5. 设置难度等级
6. 点击 "开始生成"
7. 等待生成完成
8. 查看生成的资源

## 验证服务状态

### Python AI 服务
访问 `http://localhost:8000/docs` 查看 API 文档

### Java 后端服务
访问 `http://localhost:8080/doc.html` 查看 Knife4j API 文档

### 前端服务
访问 `http://localhost:5173` 查看前端页面

## 常见问题

### 1. 数据库连接失败
**问题**: `Communications link failure`

**解决**:
- 检查 MySQL 是否启动
- 检查数据库连接配置(用户名、密码、端口)
- 检查防火墙设置

### 2. Python 服务启动失败
**问题**: `ModuleNotFoundError`

**解决**:
```bash
# 重新安装依赖
poetry install

# 或使用 pip
pip install -r requirements.txt
```

### 3. 前端无法连接后端
**问题**: `Network Error` 或 `CORS Error`

**解决**:
- 检查后端服务是否启动
- 检查 Vite 代理配置
- 检查后端 CORS 配置

### 4. 资源生成失败
**问题**: 任务状态显示 "全部失败"

**解决**:
- 检查 OpenAI API Key 是否配置正确
- 检查 API 额度是否充足
- 查看 Python 服务日志获取详细错误信息

### 5. 思维导图不显示
**问题**: Mermaid 图表无法渲染

**解决**:
```bash
# 确保安装了 mermaid
npm install mermaid

# 检查浏览器控制台是否有错误
```

## 开发模式 vs 生产模式

### 开发模式
- 前端: `npm run dev` (热重载)
- 后端: `mvnw spring-boot:run` (自动重启)
- Python: `uvicorn --reload` (自动重载)

### 生产模式
```bash
# 前端构建
cd a3-admin-web
npm run build:prod

# Java 打包
cd a3-learning
..\mvnw.cmd clean package -DskipTests

# Python 生产运行
cd a3-ai-python
poetry run gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker
```

## 日志查看

### Python 服务日志
```bash
# 查看实时日志
tail -f logs/app.log
```

### Java 服务日志
```bash
# 查看实时日志
tail -f logs/a3-learning.log
```

### 前端日志
打开浏览器开发者工具 (F12) 查看控制台

## 性能优化建议

### 1. 数据库优化
- 创建必要的索引
- 定期清理过期数据
- 使用连接池

### 2. 缓存优化
- 启用 Redis 缓存
- 缓存常用查询结果
- 使用 CDN 加速静态资源

### 3. 前端优化
- 启用代码分割
- 使用懒加载
- 压缩图片和资源

## 监控和调试

### API 调试
- Python: `http://localhost:8000/docs` (Swagger UI)
- Java: `http://localhost:8080/doc.html` (Knife4j)

### 数据库调试
```bash
# 连接数据库
mysql -u root -p tj_learning

# 查看资源表
SELECT * FROM learning_resource LIMIT 10;

# 查看任务表
SELECT * FROM resource_generation_task ORDER BY created_at DESC LIMIT 10;
```

### 日志级别调整
编辑 `application.yml`:
```yaml
logging:
  level:
    com.cnsoftbei.a3: DEBUG
```

## 下一步

完成启动后,可以:
1. 阅读 [API 文档](../../a3-ai-python/API_DOCUMENTATION.md)
2. 查看 [前端使用说明](../../a3-admin-web/src/pages/resource/README.md)
3. 执行 [集成测试](./tasks.md#任务-15-集成测试)

## 技术支持

如遇到问题,请:
1. 查看日志文件
2. 检查配置文件
3. 参考 [实施日志](./IMPLEMENTATION_LOG.md)
4. 查看 [设计文档](./design.md)
