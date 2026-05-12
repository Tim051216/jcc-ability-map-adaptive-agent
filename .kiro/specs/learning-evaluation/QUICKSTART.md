# 学习效果评估系统 - 快速开始指南

## 前置条件

- Java 11+
- Python 3.12+
- MySQL 8.0+
- PostgreSQL (可选,用于 AI 服务)
- Node.js 16+ (前端开发)
- Maven 3.x (已包含 Maven Wrapper)
- Poetry (Python 依赖管理)

## 快速启动

### 1. 数据库初始化

```bash
# 连接 MySQL
mysql -u root -p

# 执行数据库脚本
source sql/a3_evaluation.sql

# 验证表创建
USE a3_evaluation;
SHOW TABLES;
```

### 2. 启动 Java 后端服务

```bash
# 进入 a3-learning 目录
cd a3-learning-agent-system\a3-learning

# 使用 Maven Wrapper 启动
..\mvnw.cmd spring-boot:run

# 或者先编译再运行
..\mvnw.cmd clean package -DskipTests
java -jar target\a3-learning-1.0.0.jar
```

**验证启动:**
- 访问 Swagger UI: http://localhost:8080/doc.html
- 查看评估 API: `/evaluation/*`

### 3. 启动 Python AI 服务

```bash
# 进入 Python 服务目录
cd a3-learning-agent-system\a3-ai-python

# 安装依赖
poetry install

# 配置环境变量 (复制 .env.example 为 .env)
copy .env.example .env

# 编辑 .env 文件,配置 LLM API
# OPENAI_API_KEY=your_api_key
# OPENAI_API_BASE=https://api.openai.com/v1

# 启动服务
poetry run uvicorn app.main:app --reload --port 8000
```

**验证启动:**
- 访问 FastAPI Docs: http://localhost:8000/docs
- 查看评估 API: `/api/v1/evaluation/*`

### 4. 测试 API

#### 4.1 创建测评 (Java API)

```bash
curl -X POST http://localhost:8080/evaluation/test \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Java 基础测评",
    "description": "测试 Java 基础知识掌握情况",
    "testType": 1,
    "difficultyLevel": 1,
    "courseId": 1,
    "knowledgePoints": ["变量与数据类型", "运算符", "控制流程"],
    "totalScore": 100,
    "passScore": 60,
    "timeLimit": 60
  }'
```

**响应示例:**
```json
{
  "code": 200,
  "msg": "操作成功",
  "data": 1001
}
```

#### 4.2 AI 生成题目 (Python API)

```bash
curl -X POST http://localhost:8000/api/v1/evaluation/questions/generate \
  -H "Content-Type: application/json" \
  -d '{
    "test_id": 1001,
    "knowledge_points": ["变量与数据类型", "运算符"],
    "difficulty_level": 1,
    "question_type": 1,
    "count": 5,
    "generate_layered": false,
    "course_context": "Java 编程基础课程"
  }'
```

**响应示例:**
```json
{
  "test_id": 1001,
  "questions": [
    {
      "question_content": "在 Java 中,以下哪个是基本数据类型?",
      "question_options": [
        {"key": "A", "value": "String"},
        {"key": "B", "value": "int"},
        {"key": "C", "value": "Array"},
        {"key": "D", "value": "Object"}
      ],
      "correct_answer": "B",
      "answer_analysis": "int 是 Java 的基本数据类型之一...",
      "knowledge_point": "变量与数据类型",
      "difficulty_level": 1,
      "question_type": 1,
      "quality_score": 0.95
    }
  ],
  "total_count": 5
}
```

#### 4.3 提交答案并批改 (Python API)

```bash
curl -X POST http://localhost:8000/api/v1/evaluation/answers/grade \
  -H "Content-Type: application/json" \
  -d '{
    "test_id": 1001,
    "user_id": 1,
    "answers": {
      "1": "B",
      "2": "A,C",
      "3": "正确",
      "4": "变量是存储数据的容器",
      "5": "int a = 10;"
    }
  }'
```

**响应示例:**
```json
{
  "test_id": 1001,
  "user_id": 1,
  "grading_results": [
    {
      "question_id": "1",
      "user_answer": "B",
      "is_correct": 1,
      "score": 10.0,
      "grading_type": 1,
      "grading_feedback": "正确"
    },
    {
      "question_id": "4",
      "user_answer": "变量是存储数据的容器",
      "is_correct": 1,
      "score": 8.5,
      "grading_type": 2,
      "grading_feedback": "答案基本正确,表达清晰..."
    }
  ],
  "summary": {
    "total": 5,
    "correct": 4,
    "wrong": 1,
    "pending": 0,
    "accuracy_rate": 80.0
  }
}
```

#### 4.4 生成评估报告 (Python API)

```bash
curl -X POST http://localhost:8000/api/v1/evaluation/reports/generate \
  -H "Content-Type: application/json" \
  -d '{
    "test_id": 1001,
    "user_id": 1,
    "course_id": 1,
    "report_type": 1
  }'
```

**响应示例:**
```json
{
  "report_id": 2001,
  "user_id": 1,
  "course_id": 1,
  "report_type": 1,
  "overall_score": 85.0,
  "mastery_level": "熟练掌握",
  "report_summary": "本次测评综合得分 85 分,掌握等级为熟练掌握...",
  "strengths": [
    "在变量与数据类型等知识点上表现优秀",
    "基础题目掌握良好,正确率达到 90%"
  ],
  "weaknesses": [
    "运算符知识点需要加强",
    "进阶题目正确率较低 (60%),需要重点提升"
  ],
  "improvement_suggestions": [
    "建议系统复习运算符相关知识",
    "针对薄弱知识点进行专项练习",
    "可以尝试更多进阶练习"
  ],
  "recommended_resources": [
    {
      "type": "practice",
      "title": "运算符专项练习",
      "description": "针对运算符的强化练习题"
    }
  ]
}
```

## 常见问题

### Q1: 数据库连接失败

**问题:** `Could not connect to MySQL server`

**解决方案:**
1. 检查 MySQL 服务是否启动
2. 验证 `application.yml` 中的数据库配置
3. 确认数据库用户权限

### Q2: Python 服务启动失败

**问题:** `ModuleNotFoundError: No module named 'app'`

**解决方案:**
```bash
# 确保在正确的目录
cd a3-ai-python

# 重新安装依赖
poetry install

# 使用完整路径启动
poetry run python -m uvicorn app.main:app --reload
```

### Q3: LLM API 调用失败

**问题:** `OpenAI API key not found`

**解决方案:**
1. 检查 `.env` 文件是否存在
2. 验证 `OPENAI_API_KEY` 是否配置
3. 确认 API key 有效性

### Q4: 题目生成质量不佳

**问题:** 生成的题目质量评分低

**解决方案:**
1. 提供更详细的课程上下文
2. 调整生成提示词
3. 使用更强大的 LLM 模型
4. 增加题目质量阈值过滤

## 开发建议

### 1. 代码风格

**Java:**
- 遵循阿里巴巴 Java 开发手册
- 使用 Lombok 简化代码
- 添加详细的注释

**Python:**
- 遵循 PEP 8 规范
- 使用类型注解
- 编写 docstring

### 2. 测试

```bash
# Java 单元测试
cd a3-learning
..\mvnw.cmd test

# Python 单元测试
cd a3-ai-python
poetry run pytest
```

### 3. 日志

**Java:**
```java
@Slf4j
public class EvaluationService {
    public void method() {
        log.info("操作日志");
        log.error("错误日志", exception);
    }
}
```

**Python:**
```python
from app.core.logging import logger

logger.info("操作日志")
logger.error(f"错误日志: {e}")
```

### 4. 调试

**Java:**
- 使用 IDEA 的 Debug 功能
- 添加断点调试
- 查看 Spring Boot 日志

**Python:**
- 使用 VS Code 的 Debug 功能
- 使用 `breakpoint()` 设置断点
- 查看 FastAPI 日志

## 性能优化建议

### 1. 数据库优化
- 添加适当的索引
- 使用连接池
- 开启查询缓存

### 2. 缓存优化
- 使用 Redis 缓存热点数据
- 缓存题目和报告
- 设置合理的过期时间

### 3. 并发优化
- 使用异步处理
- 批量操作优化
- 限流和熔断

### 4. LLM 调用优化
- 批量生成题目
- 缓存生成结果
- 使用流式输出

## 下一步

1. 阅读 [README.md](./README.md) 了解系统架构
2. 阅读 [SUMMARY.md](./SUMMARY.md) 了解实施进度
3. 查看 [tasks.md](./tasks.md) 了解待完成任务
4. 开始前端开发或完善服务层

## 获取帮助

- 查看项目文档: `.kiro/specs/learning-evaluation/`
- 查看 API 文档: Swagger UI / FastAPI Docs
- 查看代码注释和 docstring
- 联系开发团队

---

**祝开发顺利!** 🚀
