# 对话式学习画像系统

> 基于AI的个性化学习画像构建与管理系统

## 📋 项目简介

对话式学习画像系统是A3个性化学习多智能体系统的核心模块之一，通过自然语言对话方式采集学生学习信息，利用大语言模型和多智能体技术构建六维度学习画像，并基于学习行为实时更新画像，为个性化学习路径规划和资源推荐提供数据支持。

## ✨ 核心特性

### 🤖 智能对话采集
- 自然语言对话方式，用户体验友好
- 智能引导问题生成，提高信息采集效率
- 多轮对话管理，支持中断和恢复
- 实时完整度跟踪，动态调整采集策略

### 📊 六维度画像
- **知识基础**: 已掌握知识点、薄弱环节、学科背景
- **认知风格**: 学习偏好、思维方式、理解速度
- **学习进度**: 当前进度、完成率、学习节奏
- **易错点偏好**: 常见错误类型、易混淆概念
- **兴趣方向**: 感兴趣领域、学习动机、目标方向
- **学习习惯**: 学习时间偏好、学习频率、专注时长

### 🔄 实时更新
- 基于答题行为更新知识掌握度
- 基于资源浏览更新兴趣方向
- 基于路径完成更新学习进度
- 基于互动问答更新认知风格

### 📈 可视化展示
- 六维度雷达图
- 学习标签云
- 画像历史追踪
- 个性化学习建议

## 🏗️ 技术架构

### 技术栈

**后端 (Java)**
- Spring Boot 2.7.2
- MyBatis Plus 3.4.3
- MySQL 8.0.23
- Redis 6.0+

**AI服务 (Python)**
- FastAPI
- LangGraph (多智能体编排)
- LangChain
- OpenAI API
- PostgreSQL
- SQLAlchemy

**前端 (Vue)**
- Vue 3.2.25
- Element Plus 2.2.9
- Vite 2.9.9
- ECharts 5.4.0

### 系统架构

```
┌─────────────────────────────────────────────────────────┐
│                      前端界面                            │
│  ┌──────────────┐              ┌──────────────┐        │
│  │ 对话采集界面  │              │ 画像展示页面  │        │
│  └──────────────┘              └──────────────┘        │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                    API Gateway                           │
└─────────────────────────────────────────────────────────┘
           │                              │
           ▼                              ▼
┌──────────────────────┐      ┌──────────────────────────┐
│   Java后端服务        │      │   Python AI服务           │
│                      │      │                          │
│  ┌────────────────┐ │      │  ┌────────────────────┐  │
│  │ 数据访问层      │ │      │  │ 信息提取智能体      │  │
│  │ (MyBatis)      │ │      │  │ (LLM + Prompt)     │  │
│  └────────────────┘ │      │  └────────────────────┘  │
│                      │      │                          │
│  ┌────────────────┐ │      │  ┌────────────────────┐  │
│  │ 业务逻辑层      │ │◄────►│  │ 画像建模智能体      │  │
│  │ (Service)      │ │      │  │ (LLM + Reasoning)  │  │
│  └────────────────┘ │      │  └────────────────────┘  │
│                      │      │                          │
│  ┌────────────────┐ │      │  ┌────────────────────┐  │
│  │ REST API       │ │      │  │ 画像更新智能体      │  │
│  │ (Controller)   │ │      │  │ (Behavior Analysis)│  │
│  └────────────────┘ │      │  └────────────────────┘  │
│                      │      │                          │
└──────────────────────┘      │  ┌────────────────────┐  │
           │                  │  │ LangGraph编排       │  │
           ▼                  │  │ (Workflow)         │  │
┌──────────────────────┐      │  └────────────────────┘  │
│      MySQL           │      └──────────────────────────┘
│  (业务数据存储)       │                   │
└──────────────────────┘                   ▼
                              ┌──────────────────────────┐
                              │     PostgreSQL           │
                              │  (AI服务数据存储)         │
                              └──────────────────────────┘
```

## 📦 项目结构

```
conversational-profile/
├── README.md                    # 项目说明
├── QUICKSTART.md               # 快速启动指南
├── tasks.md                    # 任务列表
├── progress.md                 # 实施进度
├── implementation-summary.md   # 实施总结
│
├── sql/
│   └── tj_learning_profile.sql # 数据库设计
│
├── backend/ (Java)
│   ├── domain/
│   │   ├── po/                 # 实体类
│   │   ├── dto/                # 数据传输对象
│   │   └── vo/                 # 视图对象
│   ├── mapper/                 # MyBatis Mapper
│   ├── service/                # 业务逻辑层
│   ├── controller/             # REST API
│   ├── enums/                  # 枚举类
│   └── constants/              # 常量类
│
├── ai-service/ (Python)
│   ├── agents/
│   │   └── nodes/
│   │       └── profile_conversation/
│   │           ├── info_extractor_agent.py
│   │           ├── profile_builder_agent.py
│   │           ├── profile_updater_agent.py
│   │           ├── conversation_graph.py
│   │           └── conversation_state.py
│   ├── db/
│   │   └── models/
│   │       └── profile_conversation.py
│   ├── schemas/
│   │   └── profile_conversation.py
│   ├── services/
│   │   └── profile_conversation_service.py
│   └── api/
│       └── v1/
│           └── profile_conversation.py
│
└── frontend/ (Vue)
    ├── views/
    │   ├── ProfileConversation.vue
    │   └── ProfileDisplay.vue
    └── components/
        ├── ConversationChat.vue
        ├── ProfileRadar.vue
        └── ProfileTags.vue
```

## 🚀 快速开始

### 1. 环境准备

```bash
# 安装依赖
- Java 11+
- Python 3.10+
- Node.js 16+
- MySQL 8.0+
- Redis 6.0+
```

### 2. 数据库初始化

```bash
mysql -u root -p tj_learning < sql/tj_learning_profile.sql
```

### 3. 启动服务

```bash
# Python AI服务
cd a3-ai-python
poetry install
poetry run uvicorn app.main:app --reload --port 8000

# Java后端服务
cd a3-learning
../mvnw.cmd spring-boot:run

# 前端服务
cd a3-admin-web
npm install
npm run dev
```

详细步骤请参考 [QUICKSTART.md](./QUICKSTART.md)

## 📖 API文档

### 对话管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/profile/conversation/start` | 开始对话会话 |
| POST | `/api/v1/profile/conversation/message` | 发送对话消息 |
| POST | `/api/v1/profile/conversation/complete` | 完成对话会话 |
| GET | `/api/v1/profile/conversation/session/{id}` | 获取会话详情 |

### 画像查询

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/profile/{user_id}` | 获取学生画像详情 |
| GET | `/api/v1/profile/{user_id}/summary` | 获取画像摘要 |
| GET | `/api/v1/profile/{user_id}/history` | 获取画像历史 |

### 画像更新

| 方法 | 路径 | 说明 |
|------|------|------|
| PUT | `/api/v1/profile/{user_id}/adjust` | 手动调整画像 |
| POST | `/api/v1/profile/behavior` | 上报学习行为 |

完整API文档: http://localhost:8000/docs

## 🧪 测试

### 单元测试

```bash
# Python测试
cd a3-ai-python
poetry run pytest

# Java测试
cd a3-learning
../mvnw.cmd test
```

### 集成测试

```bash
# 使用Postman导入测试集合
# 或使用curl进行API测试
curl -X POST http://localhost:8000/api/v1/profile/conversation/start \
  -H "Content-Type: application/json" \
  -d '{"user_id": 1, "session_type": 1}'
```

## 📊 性能指标

- 对话响应时间: < 2秒
- 画像构建时间: < 5秒
- 行为更新时间: < 1秒
- 信息提取准确率: > 85%
- 画像完整度阈值: 60%
- 并发支持: 100+ 用户

## 🔧 配置说明

### Python AI服务配置 (.env)

```env
# 数据库配置
DATABASE_URL=postgresql://user:password@localhost:5432/a3_ai

# OpenAI配置
OPENAI_API_KEY=your_api_key
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL_NAME=gpt-4

# Redis配置
REDIS_URL=redis://localhost:6379/0
```

### Java服务配置 (application.yml)

```yaml
spring:
  datasource:
    url: jdbc:mysql://localhost:3306/tj_learning
    username: root
    password: your_password
  redis:
    host: localhost
    port: 6379
```

## 📝 开发指南

### 添加新的画像维度

1. 更新数据库表结构
2. 修改实体类添加新字段
3. 更新智能体提示词
4. 添加维度配置数据
5. 更新前端展示组件

### 自定义引导问题

编辑 `profile_dimension_config` 表中的 `guide_questions` 字段：

```sql
UPDATE profile_dimension_config 
SET guide_questions = JSON_ARRAY('问题1', '问题2', '问题3')
WHERE dimension_code = 'knowledge_base';
```

### 调整智能体行为

修改智能体提示词文件：
- `info_extractor_agent.py` - 信息提取提示词
- `profile_builder_agent.py` - 画像建模提示词
- `profile_updater_agent.py` - 画像更新提示词

## 🤝 贡献指南

1. Fork 项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 详见 [LICENSE](LICENSE) 文件

## 👥 团队

A3 Team - 第15届中国软件杯参赛团队

## 📮 联系方式

- 项目主页: [GitHub Repository]
- 问题反馈: [Issues]
- 邮箱: team@a3learning.com

## 🙏 致谢

- LangChain & LangGraph 团队
- OpenAI API
- Spring Boot 社区
- Vue.js 社区

---

**让AI赋能个性化学习！** 🎓✨
