# 对话式学习画像系统 - 快速启动指南

## 前置要求

### 环境要求
- **Java**: JDK 11+
- **Python**: Python 3.10+
- **Node.js**: 16+
- **MySQL**: 8.0+
- **Redis**: 6.0+
- **Poetry**: Python包管理工具

### 开发工具
- IntelliJ IDEA / VS Code
- Postman / Apifox (API测试)
- MySQL Workbench / DBeaver (数据库管理)

## 快速启动步骤

### 1. 数据库初始化

```bash
# 连接MySQL
mysql -u root -p

# 创建数据库（如果不存在）
CREATE DATABASE IF NOT EXISTS tj_learning DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

# 执行画像系统SQL脚本
mysql -u root -p tj_learning < sql/tj_learning_profile.sql

# 验证表创建
USE tj_learning;
SHOW TABLES LIKE '%profile%';
SHOW TABLES LIKE '%conversation%';
```

预期输出：
```
+--------------------------------+
| Tables_in_tj_learning          |
+--------------------------------+
| student_profile                |
| profile_history                |
| conversation_session           |
| conversation_message           |
| extracted_info                 |
| learning_behavior              |
| profile_dimension_config       |
+--------------------------------+
```

### 2. 启动Python AI服务

```bash
# 进入AI服务目录
cd a3-ai-python

# 安装依赖（首次运行）
poetry install

# 配置环境变量
cp .env.example .env
# 编辑.env文件，配置数据库连接和OpenAI API密钥

# 运行数据库迁移（如果需要）
poetry run alembic upgrade head

# 启动服务
poetry run uvicorn app.main:app --reload --port 8000
```

服务启动后访问：
- API文档: http://localhost:8000/docs
- 健康检查: http://localhost:8000/health

### 3. 启动Java后端服务

```bash
# 进入learning服务目录
cd a3-learning

# 使用Maven Wrapper编译（首次运行）
..\mvnw.cmd clean compile -DskipTests

# 启动服务
..\mvnw.cmd spring-boot:run
```

服务启动后访问：
- Swagger文档: http://localhost:8080/doc.html
- 健康检查: http://localhost:8080/actuator/health

### 4. 启动前端服务（可选）

```bash
# 进入管理后台目录
cd a3-admin-web

# 安装依赖（首次运行）
npm install

# 启动开发服务器
npm run dev
```

前端访问地址: http://localhost:3000

## API测试

### 测试1: 开始对话会话

```bash
curl -X POST http://localhost:8000/api/v1/profile/conversation/start \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": 1,
    "session_type": 1
  }'
```

预期响应：
```json
{
  "session_id": 1,
  "user_id": 1,
  "status": 0,
  "session_type": 1,
  "total_rounds": 0,
  "collected_dimensions": [],
  "completeness": 0,
  "start_time": "2024-01-01T10:00:00",
  "end_time": null,
  "messages": [
    {
      "message_id": 1,
      "role": "assistant",
      "content": "你好！我是你的学习助手...",
      "round_number": 0,
      "message_type": 2,
      "related_dimension": null,
      "created_at": "2024-01-01T10:00:00"
    }
  ]
}
```

### 测试2: 发送对话消息

```bash
curl -X POST http://localhost:8000/api/v1/profile/conversation/message \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": 1,
    "content": "我之前学过Java基础，现在想学习Spring框架"
  }'
```

预期响应：
```json
{
  "session_id": 1,
  "assistant_message": {
    "message_id": 3,
    "role": "assistant",
    "content": "很好！你已经有Java基础了...",
    "round_number": 1,
    "message_type": 2,
    "related_dimension": "knowledge_base",
    "created_at": "2024-01-01T10:01:00"
  },
  "guide_question": {
    "question": "你更喜欢通过什么方式学习？",
    "related_dimension": "cognitive_style",
    "question_type": 2,
    "suggestions": []
  },
  "extraction_result": {
    "extracted_info": [
      {
        "dimension": "knowledge_base",
        "info_key": "mastered_topics",
        "info_value": "Java基础",
        "confidence": 0.9
      }
    ],
    "missing_dimensions": ["cognitive_style", "learning_progress", ...],
    "completeness": 15
  },
  "profile_summary": null,
  "should_continue": true,
  "completeness": 15
}
```

### 测试3: 完成对话并生成画像

```bash
# 继续对话直到completeness >= 60%
# 然后调用完成接口

curl -X POST http://localhost:8000/api/v1/profile/conversation/complete \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": 1,
    "force_complete": false
  }'
```

### 测试4: 查询学生画像

```bash
curl -X GET http://localhost:8000/api/v1/profile/1
```

### 测试5: 上报学习行为

```bash
curl -X POST http://localhost:8000/api/v1/profile/behavior \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": 1,
    "behavior_type": 1,
    "behavior_data": {
      "question_type": "选择题",
      "knowledge_point": "Spring IoC",
      "difficulty": "中等"
    },
    "resource_type": "question",
    "resource_id": 101,
    "result": "correct",
    "duration": 120
  }'
```

## 常见问题

### Q1: 数据库连接失败

**问题**: `Can't connect to MySQL server`

**解决方案**:
1. 检查MySQL服务是否启动
2. 检查.env文件中的数据库配置
3. 确认数据库用户权限

### Q2: OpenAI API调用失败

**问题**: `OpenAI API key not found`

**解决方案**:
1. 在.env文件中配置OPENAI_API_KEY
2. 如果使用代理，配置OPENAI_BASE_URL
3. 检查API密钥是否有效

### Q3: 端口被占用

**问题**: `Port 8000 is already in use`

**解决方案**:
```bash
# Windows
netstat -ano | findstr :8000
taskkill /PID <PID> /F

# Linux/Mac
lsof -i :8000
kill -9 <PID>
```

### Q4: Maven编译失败

**问题**: `Could not resolve dependencies`

**解决方案**:
1. 检查网络连接
2. 配置Maven镜像源（阿里云）
3. 清理Maven缓存：`mvnw clean`

### Q5: Python依赖安装失败

**问题**: `Poetry install failed`

**解决方案**:
```bash
# 更新Poetry
poetry self update

# 清理缓存
poetry cache clear pypi --all

# 重新安装
poetry install
```

## 开发建议

### 1. 使用虚拟环境

```bash
# Python虚拟环境
cd a3-ai-python
poetry shell

# Node.js使用nvm管理版本
nvm use 16
```

### 2. 配置IDE

**IntelliJ IDEA**:
- 安装Lombok插件
- 启用注解处理器
- 配置Maven设置

**VS Code**:
- 安装Python扩展
- 安装Java扩展包
- 配置Python解释器

### 3. 日志查看

```bash
# Python服务日志
tail -f a3-ai-python/uvicorn.log

# Java服务日志
tail -f a3-learning/logs/spring.log
```

### 4. 数据库调试

```sql
-- 查看对话会话
SELECT * FROM conversation_session ORDER BY id DESC LIMIT 10;

-- 查看对话消息
SELECT * FROM conversation_message WHERE session_id = 1 ORDER BY round_number;

-- 查看学生画像
SELECT * FROM student_profile WHERE user_id = 1;

-- 查看提取的信息
SELECT * FROM extracted_info WHERE session_id = 1;
```

## 下一步

1. **阅读API文档**: 访问 http://localhost:8000/docs
2. **查看实施总结**: 阅读 `implementation-summary.md`
3. **开发前端界面**: 参考 `tasks.md` 中的任务10和11
4. **运行集成测试**: 参考 `tasks.md` 中的任务13

## 技术支持

- **项目文档**: `.kiro/specs/conversational-profile/`
- **API文档**: http://localhost:8000/docs
- **数据库设计**: `sql/tj_learning_profile.sql`
- **智能体代码**: `a3-ai-python/app/agents/nodes/profile_conversation/`

---

**祝开发顺利！** 🚀
