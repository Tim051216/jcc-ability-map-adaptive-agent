# 最小演示链路说明

本文档说明在以下前提下，当前仓库可运行的最小可行演示链路：

- ECS 仅部署：
  - `a3-gateway`
  - `a3-learning`
  - `a3-ai-python`
  - `a3-student-web`
  - `nginx`
- 托管服务放在阿里云：
  - MySQL
  - PostgreSQL
  - Redis
  - OSS
- 通过 `MILVUS_ENABLED=false` 禁用 `Milvus`

## 服务依赖概览

### 主演示链路必需

- `a3-student-web`
- `nginx`
- `a3-gateway`
- `a3-ai-python`
- `a3-learning`
- PostgreSQL
- Redis
- MySQL
- OSS
- LLM / Embedding API

### 按需可选

- `a3-user-service`
  - 用于部分画像和辅导增强链路
  - 当前 Python 代码在该服务不可用时已有降级兜底
- `a3-resource-service`
  - 仅当你希望 `/cs/**` 这类网关路由接入真实 Java 课程数据时需要
  - 当前 Python 课程页大多仍使用内置示例数据
- `a3-media-service`
  - 用于真实的小节播放签名
  - 缺失时课程播放信息会降级，但页面仍可打开
- `a3-auth-service`
  - 对当前演示令牌链路不是必需
  - Python 已支持 `student-demo` 等内置 Bearer Token

## 当前最稳的演示能力

- 首页 / 学习总览
- 学习路径生成
- 资源中心
- 收藏夹 / 收藏操作
- 测评与学习报告
- AI 辅导
- 大部分画像与聊天链路

这些链路主要依赖 `a3-ai-python`、`a3-learning`、本地课程示例数据和外部模型 API。

## 当前会降级的部分

### 未启用 Milvus

- `/ai/api/v1/rag/search` 返回空命中
- 管理端知识入库接口返回 `503`
- 辅导和聊天仍可运行，但没有向量检索增强

### 未部署媒体服务

- 小节播放签名请求可能失败
- 课程详情页仍可打开，但播放可能显示不可用

### 未部署用户服务

- 用户画像增强会回退到兜底数据
- 聊天与画像生成仍可运行，但真实用户上下文会更少

### 未部署资源服务

- 网关 `/cs/**` 路由不会接入真实 Java 课程中心
- 当前学生端演示通常仍可运行，因为 Python 课程示例数据已覆盖总览和学习页面

## 推荐演示页面

为了保证比赛演示稳定，建议优先展示：

1. `/`
2. `/path`
3. `/resources?courseId=401`
4. `/evaluation?courseId=401`
5. `/report?courseId=401`
6. `/tutor?courseId=401&courseCode=software_engineering_4th`

## 集成风险较高的页面

- `/learn`
  - 依赖学习进度和媒体播放集成
  - 虽然仍可渲染，但在缺少更多 Java 服务时，播放与签名相关行为更脆弱

## 建议部署决策

对于首轮 ECS 上线，建议：

- 保持 `MILVUS_ENABLED=false`
- 演示中不要承诺实时 RAG 检索
- 以 AI 辅导、学习路径、资源生成、测评和学习报告作为主线
- 除非同时部署媒体相关 Java 服务，否则将媒体播放视为可选能力
