# A3 AI 接口清单

## 1. 网关入口

本地联调统一入口：

- `http://127.0.0.1:10010/ai/**`

Python AI 服务直连入口：

- `http://127.0.0.1:18080/api/**`

## 2. 管理与探活

### `GET /ai/v1/admin/ping`

- 用途：确认网关到 AI 服务路由可用

### `GET /ai/v1/admin/llm/ping`

- 用途：确认真实大模型可用

### `GET /ai/v1/admin/embedding/ping`

- 用途：确认真实 embedding 可用、维度匹配

### `POST /ai/v1/admin/knowledge/{course_code}/ingest`

- 用途：课程知识切片、向量化并入库
- 当前示例：`ml_intro`

## 3. RAG 问答

### `POST /ai/v1/rag/search`

- 用途：语义检索课程知识片段
- 关键字段：
  - `course_code`
  - `query`
  - `top_k`

### `POST /ai/v1/chat`

- 用途：基于 RAG 的课程问答
- 关键字段：
  - `user_id`
  - `course_code`
  - `message`

## 4. 个性化能力

### `POST /api/v1/profile/build`

- 用途：学习画像构建
- 当前建议：直连 `18080` 使用

### `POST /api/v1/plan/generate`

- 用途：生成阶段化学习计划
- 关键字段：
  - `target`
  - `available_days`
  - `daily_study_minutes`

### `POST /api/v1/resource/generate`

- 用途：生成讲义、练习题、导图说明等资源
- 关键字段：
  - `knowledge_points`
  - `resource_types`

### `POST /api/v1/evaluation`

- 用途：生成学习效果评估结果

## 5. 当前最推荐的答辩接口

按展示价值排序：

1. `POST /ai/v1/admin/knowledge/ml_intro/ingest`
2. `POST /ai/v1/rag/search`
3. `POST /ai/v1/chat`
4. `POST /api/v1/plan/generate`
5. `POST /api/v1/resource/generate`

## 6. 当前演示数据集

当前默认课程知识库：

- `a3-ai-python/knowledge_base/ml_intro`

覆盖主题：

- 机器学习导论
- 监督学习基础
- 模型评估与过拟合
- 特征工程与实践建议

## 7. 当前真实模型配置

已接通：

- `LLM`: `qwen3.6-plus`
- `Embedding`: `text-embedding-v4`
- `Provider`: DashScope OpenAI Compatible API

## 8. 注意事项

- 若修改 embedding 模型维度，需要同步检查 `MILVUS_DIMENSION`
- 若重新切换 embedding 模型，建议重新执行课程知识入库
- 若只做答辩演示，优先走网关 `/ai/**` 展示整条业务链路
