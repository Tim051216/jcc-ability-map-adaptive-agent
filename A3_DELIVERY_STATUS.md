# A3 交付状态总览

## 当前结论

当前版本已经具备答辩可演示条件，但建议将现场口径明确分成两段：

1. `稳定主链路`
   学生端基础页面、学习路径、测评、错题、报告，以及 `a3-learning` 的演示骨架接口。
2. `AI 增强链路`
   知识入库、RAG 检索、智能问答、学习画像、学习计划、资源生成、智能辅导，以及后台 AI 运营接口。

这样可以把“本地稳定业务链路”和“依赖模型与向量库的 AI 真链路”分开讲清楚，降低现场不确定性。

## 当前可稳定演示功能

### 学生端与 Java 学习链路

- 学生端首页、学习画像、学习路径、资源中心、学习报告等主页面
- Java 学习服务的学习路径、学习进度、测评、错题、报告链路
- `a3-learning` 的 `/a3/agent-demo/**` 演示骨架接口

### Python AI 能力

- Python AI 服务的知识入库、RAG 检索、智能问答
- Python AI 服务的学习画像、学习计划、资源生成
- Python AI 服务的智能辅导 OCR 预览、历史查询、人工升级接口

### 管理端与运营能力

- 后台摘要、审核、日志、配置、用户状态等运营接口

## 演示前必须确认

### 只演示稳定主链路时

- MySQL、Redis、RabbitMQ 已启动
- `a3-learning` 已启动在 `8090`
- `a3-student-react-web` 已启动在 `3002`

### 演示完整 AI 链路时

- PostgreSQL、MinIO、Etcd、Milvus 已启动
- `a3-ai-python` 已启动在 `18080`
- `a3-gateway` 已启动在 `10010`
- 真实 `LLM_PROVIDER`、`EMBEDDING_PROVIDER` 配置已补齐

### 建议现场先跑的自检

```powershell
Invoke-RestMethod -Method Get http://127.0.0.1:18080/api/v1/admin/llm/ping
Invoke-RestMethod -Method Get http://127.0.0.1:18080/api/v1/admin/embedding/ping
Invoke-RestMethod -Method Get http://127.0.0.1:10010/ai/v1/admin/ping
Invoke-RestMethod -Method Get http://127.0.0.1:8090/evaluation/test/course/1 -Headers @{ "user-info" = "1" }
```

## 当前推荐演示链路

1. 学生端首页
2. 学习画像
3. 学习路径
4. 资源中心
5. 学习报告
6. 测评与错题
7. AI 知识入库
8. RAG 检索
9. 智能问答
10. 资源生成

如果现场时间有限，优先保留：

1. 学习路径
2. 测评与错题
3. RAG 检索
4. 资源生成

## 当前高风险点

- Python AI 真链路依赖 PostgreSQL、Milvus、MinIO、模型配置，现场更容易受环境影响
- 真实 `LLM_PROVIDER`、`EMBEDDING_PROVIDER` 配置不完整时，AI 结果可能退化或失败
- 管理端和学生端并非所有页面都已完成“真实接口 + 真数据”的全量回归
- 智能辅导图片上传与 OCR 依赖对象存储和 OCR 运行条件
- 测评演示若依赖特定演示数据，需要提前补导 `sql\evaluation_demo_ascii.sql`

## 尚未在本轮重新实测的部分

- 真实大模型调用结果是否稳定
- Milvus 知识入库与检索在当前机器上的实际命中质量
- MinIO 资源上传/下载在全链路页面上的浏览器侧体验
- 管理端所有新增页面的逐页人工点击回归
- 所有 `*_SUMMARY.md` 中提到的功能是否都已在最新代码状态下重跑

## 当前交付建议

- 答辩时优先讲“稳定主链路 + AI 增强能力分层架构”，不要把所有能力混成一个单链路
- 演示前先按 [A3_DEMO_RUNBOOK.md](/F:/A3-cnsoftbei/a3-learning-agent-system/A3_DEMO_RUNBOOK.md) 完成环境检查
- 如需快速补测评演示数据，优先使用 `scripts\start-learning-evaluation-local.ps1`
- 如需核对本地启动顺序，参考 [LOCAL_SETUP.md](/F:/A3-cnsoftbei/a3-learning-agent-system/LOCAL_SETUP.md) 与 [sql/README.md](/F:/A3-cnsoftbei/a3-learning-agent-system/sql/README.md)
