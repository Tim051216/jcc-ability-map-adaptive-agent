# A3 答辩演示脚本

## 1. 当前推荐演示策略

当前项目最稳妥的演示方式，不是强行走“所有功能一次性串满”，而是分成两段：

1. `稳定主链路`
   学生端页面、学习路径、测评、错题、报告
2. `AI 增强链路`
   知识入库、RAG 检索、智能问答、学习画像、学习计划、资源生成、智能辅导

这样可以在现场把“基础系统稳定性”和“AI 特色能力”分别讲清楚。

## 2. 演示前最少检查

### 稳定主链路演示

需要确保：

- MySQL、Redis、RabbitMQ 已启动
- `a3-learning` 已启动在 `8090`
- `a3-portal-web` 已启动在 `18082`

### AI 增强链路演示

额外需要确保：

- PostgreSQL、MinIO、Etcd、Milvus 已启动
- `a3-ai-python` 已启动在 `18080`
- `a3-gateway` 已启动在 `10010`

自检命令：

```powershell
Invoke-RestMethod -Method Get http://127.0.0.1:18080/api/v1/admin/llm/ping
Invoke-RestMethod -Method Get http://127.0.0.1:18080/api/v1/admin/embedding/ping
Invoke-RestMethod -Method Get http://127.0.0.1:10010/ai/v1/admin/ping
Invoke-RestMethod -Method Get http://127.0.0.1:8090/evaluation/test/course/1 -Headers @{ "user-info" = "1" }
```

## 3. 当前推荐演示链路

## 3.1 第一段：学生端稳定主链路

推荐顺序：

1. 首页：`http://127.0.0.1:18082/#/main/index`
2. 学习画像：`http://127.0.0.1:18082/#/main/ai-profile`
3. 学习路径：`http://127.0.0.1:18082/#/main/ai-path`
4. 资源中心：`http://127.0.0.1:18082/#/main/ai-resources`
5. 学习报告：`http://127.0.0.1:18082/#/main/ai-report`
6. 测评列表：`http://127.0.0.1:18082/#/main/ai-evaluation?courseId=1`
7. 错题页：`http://127.0.0.1:18082/#/main/ai-mistakes?testId=910001&courseId=1&reportId=920001`

讲解重点：

- 系统具备完整学生学习闭环，而不是只做一个 AI 聊天框
- 路径、资源、报告、测评之间可以形成连续动线
- 页面已经做过中文化、空态和演示口径清理

## 3.2 第二段：AI 增强链路

推荐课程编码：

- `ml_intro`

推荐知识点：

- `过拟合`

### 步骤 1：课程知识入库

```powershell
Invoke-RestMethod -Method Post http://127.0.0.1:10010/ai/v1/admin/knowledge/ml_intro/ingest
```

预期说明：

- 课程资料被切片、向量化并写入 Milvus
- 为后续问答、资源生成提供课程私有知识基础

### 步骤 2：RAG 检索

```powershell
Invoke-RestMethod -Method Post http://127.0.0.1:10010/ai/v1/rag/search `
  -ContentType "application/json" `
  -Body '{"course_code":"ml_intro","query":"什么是过拟合","top_k":3}'
```

预期说明：

- 返回命中文档与引用片段
- 能说明系统先检索课程知识，再进入生成

### 步骤 3：智能问答

```powershell
Invoke-RestMethod -Method Post http://127.0.0.1:10010/ai/v1/chat `
  -ContentType "application/json" `
  -Body '{"user_id":1,"course_code":"ml_intro","message":"请解释过拟合，并给出两条缓解建议"}'
```

预期说明：

- 回答带课程上下文
- 能展示“课程私有知识 + 大模型生成”

### 步骤 4：学习画像

```powershell
Invoke-RestMethod -Method Post http://127.0.0.1:18080/api/v1/profile/build `
  -ContentType "application/json" `
  -Body '{"user_id":1,"course_code":"ml_intro","dialogue":["我做题时容易记不住模型评估指标，希望多给例子和练习"]}'
```

### 步骤 5：学习计划

```powershell
Invoke-RestMethod -Method Post http://127.0.0.1:18080/api/v1/plan/generate `
  -ContentType "application/json" `
  -Body '{"user_id":1,"course_code":"ml_intro","target":"掌握过拟合的概念和缓解方法","available_days":3,"daily_study_minutes":45}'
```

### 步骤 6：资源生成

```powershell
Invoke-RestMethod -Method Post http://127.0.0.1:18080/api/v1/resource/generate `
  -ContentType "application/json" `
  -Body '{"user_id":1,"course_code":"ml_intro","knowledge_points":["过拟合","交叉验证"],"resource_types":["lecture_note","quiz_set","mind_map"]}'
```

### 步骤 7：智能辅导

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\verify-intelligent-tutoring-local.ps1
```

说明：

- 该脚本会检查 LLM/Embedding ping、网关转发、OCR 预览和答疑历史
- 如果要演示学生端提问，建议提前准备好一条已有历史记录或演示图片

## 4. 备用演示链路

如果现场时间紧，推荐只保留下面 4 步：

1. 学习路径页
2. 测评/错题页
3. RAG 检索
4. 资源生成

如果网络或模型不稳定，优先保住：

1. Java 学习路径/测评页面
2. `knowledge ingest`
3. `rag search`

## 5. 现场高风险提醒

- Python AI 链路依赖较多，任何一个容器未就绪都会影响演示
- `LLM_PROVIDER`、`EMBEDDING_PROVIDER` 的真实密钥配置若缺失，问答与资源生成可能退化或失败
- 智能辅导上传图片、OCR、对象存储依赖 MinIO 配置
- 前端部分页面虽有兜底，但不等于所有接口都已完成真链路验证

## 6. 推荐结束话术

- 我们不是只做了一个问答机器人，而是把学习路径、资源生成、测评、错题、报告和运营接口一起串成了学习闭环
- 在架构上采用 `Java 学习微服务 + Python AI 中台 + 双前端` 的模式，便于把稳定业务链路和 AI 能力演进解耦
- 当前版本已经具备本地可演示、可扩展、可继续接入真实模型与课程数据的基础
