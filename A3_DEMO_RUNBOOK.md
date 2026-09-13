# AI 数据标注实训智能体答辩演示脚本

> 正式参赛作品是人工智能技术应用专业群（计算机视觉方向）/AI 数据标注工程师微任务。本文前半部分是 AI 作品演示；后半部分保留原 A3/岗课赛平台的历史兼容脚本。提交或答辩时不要把两套专业群、岗位和页面混讲。

## 0. 正式 AI 作品三分钟路径

1. 在仓库根目录执行 `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-ai-annotation.ps1`。
2. 打开 `http://127.0.0.1:3002/annotation-agent`（兼容入口 `/ai-annotation-agent`）。
3. 点击遮挡快捷问题，指出命中 `ANN-OCC-01`、步骤、质检项和“待教师核验”来源状态。
4. 输入“这个怎么弄？”，展示澄清问题；再输入“目标检测，目标出画面了”和同类实例问题。
5. 打开反馈窗口：没有真人时只能选“AI 模拟（内部演示）”；真实参与者本人完成试用并勾选匿名确认后，才可记录“真实用户试用”。
6. 在前端目录运行 `npm run smoke:ai-annotation-agent` 和 `npm run audit:ai-annotation-submission`，向评委说明外部证据尚待人工补齐。

## 1. 推荐演示策略（历史兼容平台）

建议把演示分成两段：

1. 稳定主链路
2. AI 增强链路

这样更容易把“业务闭环稳定性”和“AI 特色能力”分开讲清楚。

## 2. 演示前最少检查（历史兼容平台）

稳定主链路需要确认：

- MySQL、Redis、RabbitMQ 已启动
- `a3-learning` 已启动在 `8090`
- `a3-student-react-web` 已启动在 `3002`

AI 增强链路额外需要确认：

- PostgreSQL、MinIO、Etcd、Milvus 已启动
- `a3-ai-python` 已启动在 `18080`
- `a3-gateway` 已启动在 `10010`

推荐直接执行：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-ai-local.ps1
```

自检命令：

```powershell
Invoke-RestMethod -Method Get http://127.0.0.1:18080/api/v1/admin/llm/ping
Invoke-RestMethod -Method Get http://127.0.0.1:18080/api/v1/admin/embedding/ping
Invoke-RestMethod -Method Get http://127.0.0.1:10010/ai/v1/admin/ping
Invoke-RestMethod -Method Get http://127.0.0.1:8090/evaluation/test/course/1 -Headers @{ "user-info" = "1" }
```

## 3. 推荐演示链路（历史兼容平台）

### 3.1 第一段：学生端稳定主链路

推荐顺序：

1. 首页：`http://127.0.0.1:3002/`
2. 学习画像：`http://127.0.0.1:3002/profile?courseId=101`
3. 学习路径：`http://127.0.0.1:3002/path?courseId=101`
4. 资源中心：`http://127.0.0.1:3002/resources?courseId=101`
5. 学习报告：`http://127.0.0.1:3002/report?courseId=101`
6. 测评列表：`http://127.0.0.1:3002/evaluation?courseId=101`
7. AI 助教：`http://127.0.0.1:3002/tutor?courseId=101`

讲解重点：

- 系统具备完整学习闭环，不只是一个 AI 聊天框
- 路径、资源、报告、测评之间能形成连续动线

### 3.2 第二段：AI 增强链路

推荐课程编码：

- `ml_intro`

推荐知识点：

- `过拟合`

步骤 1：课程知识入库

```powershell
Invoke-RestMethod -Method Post http://127.0.0.1:10010/ai/v1/admin/knowledge/ml_intro/ingest
```

步骤 2：RAG 检索

```powershell
Invoke-RestMethod -Method Post http://127.0.0.1:10010/ai/v1/rag/search `
  -ContentType "application/json" `
  -Body '{"course_code":"ml_intro","query":"什么是过拟合","top_k":3}'
```

步骤 3：智能问答

```powershell
Invoke-RestMethod -Method Post http://127.0.0.1:10010/ai/v1/chat `
  -ContentType "application/json" `
  -Body '{"user_id":1,"course_code":"ml_intro","message":"请解释过拟合，并给出两条缓解建议"}'
```

步骤 4：学习画像

```powershell
Invoke-RestMethod -Method Post http://127.0.0.1:18080/api/v1/profile/build `
  -ContentType "application/json" `
  -Body '{"user_id":1,"course_code":"ml_intro","dialogue":["我做题时容易记不住模型评估指标，希望多给例子和练习。"]}'
```

步骤 5：学习计划

```powershell
Invoke-RestMethod -Method Post http://127.0.0.1:18080/api/v1/plan/generate `
  -ContentType "application/json" `
  -Body '{"user_id":1,"course_code":"ml_intro","target":"掌握过拟合的概念和缓解方法","available_days":3,"daily_study_minutes":45}'
```

步骤 6：资源生成

```powershell
Invoke-RestMethod -Method Post http://127.0.0.1:18080/api/v1/resource/generate `
  -ContentType "application/json" `
  -Body '{"user_id":1,"course_code":"ml_intro","knowledge_points":["过拟合","交叉验证"],"resource_types":["lecture_note","quiz_set","mind_map"]}'
```

步骤 7：智能辅导

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\verify-intelligent-tutoring-local.ps1
```

## 4. 备用演示链路

如果现场时间紧，推荐保留：

1. 学习路径页
2. 测评/错题页
3. RAG 检索
4. 资源生成

如需在历史兼容链路之后展示人工智能专业版微任务，可直接打开：

```text
http://127.0.0.1:3002/annotation-agent
```

演示顺序：遮挡快捷问题 → 查看命中规则 ID/来源追踪 → 多意图问题澄清 → 模糊问题追问 → 截断/`bbox` 检查 → 同类实例分别标框 → 打开反馈窗口。内部演示请选择“AI 模拟（内部演示）”并勾选模拟确认；只有真实参与者本人完成试用后才选择“真实用户试用”并由本人勾选匿名确认。页面中的候选规则和来源边界见 `deliverables/AI数据标注实训智能体-来源规则输出映射.md`。

如果网络或模型不稳定，优先保住：

1. Java 学习路径/测评页面
2. `knowledge ingest`
3. `rag search`

## 5. 现场高风险提醒

- Python AI 链路依赖较多，任何一个容器未就绪都会影响演示
- 本地请只保留一个 `18080` 的 AI 进程，避免系统 Python 或 Anaconda 抢占端口
- `LLM_PROVIDER`、`EMBEDDING_PROVIDER` 的真实密钥配置若缺失，问答与资源生成可能退化或失败
- 智能辅导上传图片、OCR、对象存储依赖 `MinIO` 配置

## 6. 结束话术

- 我们不是只做了一个问答机器人，而是把学习路径、资源生成、测评、错题、报告和运营接口一起串成了学习闭环
- 架构上采用 `Java 学习微服务 + Python AI 中台 + 双前端` 的模式，便于把稳定业务链路和 AI 能力演进解耦
