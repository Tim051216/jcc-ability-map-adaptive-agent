# A3 答辩演示脚本

## 1. 演示目标

用一条完整链路展示 A3 题目的 4 个核心能力：

1. 课程知识入库
2. RAG 智能问答
3. 个性化学习计划生成
4. 个性化学习资源生成

本仓库当前推荐演示课程：

- `ml_intro`
- 主题：`过拟合`

## 2. 演示前准备

### 基础依赖

```powershell
docker compose -f docker-compose.local.yml up -d mysql redis rabbitmq postgres minio etcd milvus
```

### 启动 Python AI 服务

```powershell
cd a3-ai-python
.venv\Scripts\activate
uvicorn app.main:app --host 0.0.0.0 --port 18080
```

### 启动 Java 网关

在仓库根目录另开终端：

```powershell
.\scripts\start-gateway-local.ps1
```

### 演示前检查

```powershell
Invoke-RestMethod -Method Get http://127.0.0.1:18080/api/v1/admin/llm/ping
Invoke-RestMethod -Method Get http://127.0.0.1:18080/api/v1/admin/embedding/ping
Invoke-RestMethod -Method Get http://127.0.0.1:10010/ai/v1/admin/ping
```

预期：

- `llm/ping` 返回 `status=ok`
- `embedding/ping` 返回 `status=ok`
- 网关 `admin/ping` 返回 `admin ok`

## 3. 推荐演示顺序

### 第一步：展示课程知识入库

讲解话术：

- 我们先把课程资料切片、向量化并写入 Milvus，后续所有问答和资源生成都建立在课程私有知识库上。

演示命令：

```powershell
Invoke-RestMethod -Method Post http://127.0.0.1:10010/ai/v1/admin/knowledge/ml_intro/ingest
```

预期亮点：

- 返回 `status=success`
- 返回 `chunk_count`
- 返回 `milvus_rows`

### 第二步：展示 RAG 检索

讲解话术：

- 问答前先做语义检索，找到最相关的课程知识片段，保证回答有依据。

演示命令：

```powershell
Invoke-RestMethod -Method Post http://127.0.0.1:10010/ai/v1/rag/search `
  -ContentType 'application/json' `
  -Body '{"course_code":"ml_intro","query":"什么是过拟合","top_k":3}'
```

预期亮点：

- 第一命中应为 `模型评估与过拟合`
- 返回 `citations`
- 能说明不是裸大模型闲聊，而是课程知识增强问答

### 第三步：展示智能问答

讲解话术：

- 在检索结果基础上，由真实大模型生成结构化解释，回答会携带引用来源。

演示命令：

```powershell
Invoke-RestMethod -Method Post http://127.0.0.1:10010/ai/v1/chat `
  -ContentType 'application/json' `
  -Body '{"user_id":1,"course_code":"ml_intro","message":"请解释过拟合，并给出两条缓解建议"}'
```

预期亮点：

- 回答先给结论，再给解释
- `citations` 中应包含 `模型评估与过拟合`
- 体现“课程私有知识 + 大模型生成”

### 第四步：展示个性化学习计划

讲解话术：

- 系统会根据目标知识点，自动拆分阶段任务、学习目标和检查点。

演示命令：

```powershell
Invoke-RestMethod -Method Post http://127.0.0.1:18080/api/v1/plan/generate `
  -ContentType 'application/json' `
  -Body '{"user_id":1,"course_code":"ml_intro","target":"掌握过拟合的概念和缓解方法","available_days":3,"daily_study_minutes":45}'
```

预期亮点：

- 有 `progress_hint`
- 有 `next_action`
- 每天有 `objective`、`tasks`、`checkpoint`

### 第五步：展示个性化资源生成

讲解话术：

- 系统不只回答问题，还能围绕知识点自动生成讲义、练习题和导图说明。

演示命令：

```powershell
Invoke-RestMethod -Method Post http://127.0.0.1:18080/api/v1/resource/generate `
  -ContentType 'application/json' `
  -Body '{"user_id":1,"course_code":"ml_intro","knowledge_points":["过拟合","交叉验证"],"resource_types":["lecture_note","quiz_set","mind_map"]}'
```

预期亮点：

- 返回 `recommended_order`
- 每个资源卡有 `source_titles`
- 可解释“讲义、练习、导图”来自同一课程知识库

## 4. 推荐答辩话术

### 一句话定位

- 我们的系统不是单纯聊天机器人，而是“基于课程私有知识库的个性化学习多智能体系统”。

### 三个技术亮点

1. `Java 网关 + Python AI 服务` 分层架构，便于把 AI 能力独立演进。
2. `Milvus + DashScope Embedding` 实现课程知识的语义检索。
3. `RAG + LLM + Agent Orchestration` 支撑问答、学习计划和资源生成三类输出。

### 一个业务亮点

- 对同一知识点，系统既能答疑，也能继续生成学习计划和配套资源，形成完整学习闭环。

## 5. 演示兜底方案

如果现场网络不稳定，优先保住以下顺序：

1. `knowledge ingest`
2. `rag search`
3. `chat`

这三步最能说明系统核心价值。

如果大模型偶发超时：

- 可以先展示 `rag search` 命中结果
- 再说明系统具备降级能力，不会因为模型瞬时抖动导致整条链路不可用

## 6. 演示结束总结

建议收尾时强调：

- 已完成真实模型接入
- 已完成真实向量检索
- 已打通网关到 AI 服务链路
- 已具备继续扩展多课程、多用户、多模态资源的基础架构
