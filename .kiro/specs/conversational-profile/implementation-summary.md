# 对话式学习画像系统 - 实施总结

## 项目概述

本项目实现了一个基于AI的对话式学习画像构建系统，通过自然语言对话采集学生学习信息，构建六维度学习画像，并基于学习行为实时更新画像。

## 核心功能

### 1. 对话式信息采集
- 自然语言对话方式采集学习信息
- 智能引导问题生成
- 多轮对话管理
- 信息完整度实时跟踪

### 2. 六维度画像建模
- **知识基础**: 已掌握知识点、薄弱环节、学科背景
- **认知风格**: 学习偏好、思维方式、理解速度
- **学习进度**: 当前进度、完成率、学习节奏
- **易错点偏好**: 常见错误类型、易混淆概念
- **兴趣方向**: 感兴趣领域、学习动机、目标方向
- **学习习惯**: 学习时间偏好、学习频率、专注时长

### 3. 智能画像更新
- 基于答题行为更新知识掌握度
- 基于资源浏览更新兴趣方向
- 基于路径完成更新学习进度
- 基于互动问答更新认知风格

### 4. 画像可视化展示
- 六维度雷达图
- 学习标签云
- 画像历史追踪
- 个性化学习建议

## 技术架构

### 后端架构 (Java + Spring Boot)

```
a3-learning/
├── domain/
│   ├── po/              # 实体类
│   │   ├── StudentProfile.java
│   │   ├── ConversationSession.java
│   │   ├── ConversationMessage.java
│   │   ├── ExtractedInfo.java
│   │   ├── LearningBehavior.java
│   │   └── ProfileHistory.java
│   ├── dto/             # 数据传输对象
│   │   ├── ProfileDimensionDTO.java
│   │   ├── ConversationMessageDTO.java
│   │   ├── ProfileAdjustDTO.java
│   │   └── LearningBehaviorDTO.java
│   └── vo/              # 视图对象
│       ├── StudentProfileVO.java
│       ├── ProfileSummaryVO.java
│       ├── ConversationSessionVO.java
│       └── ProfileHistoryVO.java
├── mapper/              # MyBatis Mapper
│   ├── StudentProfileMapper.java
│   ├── ConversationSessionMapper.java
│   └── ...
├── enums/               # 枚举类
│   ├── ProfileStatus.java
│   ├── ConversationStatus.java
│   ├── SessionType.java
│   └── BehaviorType.java
└── constants/           # 常量类
    └── ProfileConstants.java
```

### AI服务架构 (Python + FastAPI + LangGraph)

```
a3-ai-python/
├── agents/
│   └── nodes/
│       └── profile_conversation/
│           ├── info_extractor_agent.py      # 信息提取智能体
│           ├── profile_builder_agent.py     # 画像建模智能体
│           ├── profile_updater_agent.py     # 画像更新智能体
│           ├── conversation_graph.py        # LangGraph编排
│           └── conversation_state.py        # 状态定义
├── db/
│   └── models/
│       └── profile_conversation.py          # SQLAlchemy模型
├── schemas/
│   └── profile_conversation.py              # Pydantic Schema
├── services/
│   └── profile_conversation_service.py      # 业务逻辑层
└── api/
    └── v1/
        └── profile_conversation.py          # REST API
```

## 数据库设计

### 核心表结构

1. **student_profile** - 学生画像主表
   - 六维度JSON字段
   - 画像标签
   - 完整度指标
   - 版本管理

2. **conversation_session** - 对话会话表
   - 会话状态管理
   - 采集进度跟踪
   - 维度完整度

3. **conversation_message** - 对话消息表
   - 消息内容
   - 角色标识
   - 轮次管理

4. **extracted_info** - 提取信息表
   - 维度归属
   - 置信度
   - 验证状态

5. **learning_behavior** - 学习行为表
   - 行为类型
   - 行为数据
   - 行为结果

6. **profile_history** - 画像历史表
   - 版本快照
   - 变更类型
   - 变更描述

7. **profile_dimension_config** - 维度配置表
   - 维度定义
   - 引导问题
   - 权重配置

## API接口

### 对话管理接口

```
POST   /api/v1/profile/conversation/start
       开始对话会话

POST   /api/v1/profile/conversation/message
       发送对话消息

POST   /api/v1/profile/conversation/complete
       完成对话会话

GET    /api/v1/profile/conversation/session/{session_id}
       获取会话详情
```

### 画像查询接口

```
GET    /api/v1/profile/{user_id}
       获取学生画像详情

GET    /api/v1/profile/{user_id}/summary
       获取画像摘要

GET    /api/v1/profile/{user_id}/history
       获取画像历史
```

### 画像更新接口

```
PUT    /api/v1/profile/{user_id}/adjust
       手动调整画像

POST   /api/v1/profile/behavior
       上报学习行为
```

## 智能体工作流程

### 信息提取智能体 (info_extractor_agent)

```
输入: 对话历史
  ↓
LLM分析对话内容
  ↓
提取六维度信息
  ↓
计算置信度
  ↓
输出: 提取结果 + 缺失维度
```

### 画像建模智能体 (profile_builder_agent)

```
输入: 提取的信息
  ↓
LLM构建结构化画像
  ↓
生成六维度数据
  ↓
生成学习标签
  ↓
输出: 完整画像
```

### 画像更新智能体 (profile_updater_agent)

```
输入: 当前画像 + 学习行为
  ↓
分析行为影响
  ↓
LLM生成更新建议
  ↓
应用画像更新
  ↓
输出: 更新结果
```

### LangGraph编排流程

```
开始
  ↓
info_extractor (信息提取)
  ↓
判断完整度
  ├─ < 80% → 返回引导问题 (继续对话)
  └─ ≥ 80% → profile_builder (构建画像)
                ↓
            判断是否有行为数据
              ├─ 有 → profile_updater (更新画像)
              └─ 无 → 结束
```

## 关键技术点

### 1. LangGraph多智能体编排
- 使用StateGraph定义智能体工作流
- 条件路由实现动态流程控制
- 状态管理实现数据传递

### 2. LLM信息提取
- 使用结构化提示词
- JSON格式输出
- 置信度评估

### 3. 画像版本管理
- 每次更新保存历史快照
- 支持版本对比
- 变更原因追溯

### 4. 实时更新机制
- 学习行为事件监听
- 异步画像更新
- 增量更新策略

## 部署说明

### 数据库初始化

```sql
-- 执行SQL脚本
mysql -u root -p tj_learning < sql/tj_learning_profile.sql
```

### Python AI服务启动

```bash
cd a3-ai-python
poetry install
poetry run uvicorn app.main:app --reload --port 8000
```

### Java服务启动

```bash
cd a3-learning
../mvnw.cmd spring-boot:run
```

## 测试用例

### 1. 对话式画像构建测试

```python
# 开始对话
POST /api/v1/profile/conversation/start
{
    "user_id": 1,
    "session_type": 1
}

# 发送消息
POST /api/v1/profile/conversation/message
{
    "session_id": 1,
    "content": "我之前学过Java基础，现在想学习Spring框架"
}

# 完成对话
POST /api/v1/profile/conversation/complete
{
    "session_id": 1,
    "force_complete": false
}
```

### 2. 学习行为更新测试

```python
# 上报答题行为
POST /api/v1/profile/behavior
{
    "user_id": 1,
    "behavior_type": 1,
    "behavior_data": {
        "question_type": "选择题",
        "knowledge_point": "Spring IoC",
        "difficulty": "中等"
    },
    "result": "correct",
    "duration": 120
}
```

### 3. 画像查询测试

```python
# 获取画像详情
GET /api/v1/profile/1

# 获取画像摘要
GET /api/v1/profile/1/summary

# 获取画像历史
GET /api/v1/profile/1/history?limit=10
```

## 性能指标

- 对话响应时间: < 2秒
- 画像构建时间: < 5秒
- 行为更新时间: < 1秒
- 信息提取准确率: > 85%
- 画像完整度阈值: 60%

## 未来优化方向

1. **智能体优化**
   - 提高信息提取准确率
   - 优化引导问题生成策略
   - 增加多模态信息采集

2. **画像增强**
   - 增加更多维度
   - 细化维度粒度
   - 引入画像预测功能

3. **性能优化**
   - 缓存策略优化
   - 异步处理优化
   - 批量更新优化

4. **用户体验**
   - 前端界面优化
   - 可视化增强
   - 交互流程优化

## 参考文档

- [LangGraph官方文档](https://langchain-ai.github.io/langgraph/)
- [FastAPI官方文档](https://fastapi.tiangolo.com/)
- [Spring Boot官方文档](https://spring.io/projects/spring-boot)
- [MyBatis Plus官方文档](https://baomidou.com/)

---

**项目状态**: 核心功能已完成，待前端界面开发和集成测试

**最后更新**: 2024-01-01
