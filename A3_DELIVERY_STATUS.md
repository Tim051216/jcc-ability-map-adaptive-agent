# AI 数据标注实训智能体交付状态总览

> 本文件已切换为 AI 专业版交付视图。仓库中的 A3/岗课赛学习平台能力属于历史兼容工程；正式提交请以 `deliverables/AI数据标注实训智能体-*` 文件和本文件的“人工智能专业版竞赛 MVP”章节为准，不要把软件开发工程师或其他岗位页面混入 AI 作品证据。

## 当前结论

AI 数据标注 MVP 已具备本地答辩演示条件。正式外部证据仍需按门禁补齐。仓库原有平台可作为兼容回归链路，但不属于本次 AI 作品主链路。若需要演示原平台，必须明确标注“历史兼容”。

### 正式 AI 作品最短路径

1. 启动 `scripts\start-ai-annotation.ps1`。
2. 打开 `http://127.0.0.1:3002/annotation-agent`。
3. 依次演示遮挡、模糊澄清、截断、同类实例和反馈类型区分。
4. 运行 `npm run lint`、`npm run build`、`npm run smoke:ai-annotation-agent`、`npm run audit:ai-annotation-deliverables`。
5. 真人材料到位后再运行 `npm run audit:ai-annotation-submission -- --strict`。

### 历史兼容平台链路

如确有需要，原有平台现场口径仍可分成两段：

1. `稳定主链路`
   学生端基础页面、学习路径、测评、错题、报告，以及 `a3-learning` 的演示骨架接口。
2. `AI 增强链路`
   知识入库、RAG 检索、智能问答、学习画像、学习计划、资源生成、智能辅导，以及后台 AI 运营接口。

这样可以把“本地稳定业务链路”和“依赖模型与向量库的 AI 真链路”分开讲清楚，降低现场不确定性。

## 当前可稳定演示功能（历史兼容）

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

### 人工智能专业版竞赛 MVP（正式提交主链路）

- 页面：学生端 `/annotation-agent`（兼容 `/ai-annotation-agent`）
- 专业群/岗位：人工智能技术应用（计算机视觉方向）/ AI 数据标注工程师
- 核心方向：方向 3“岗位典型工作任务转化成学习型任务”
- 微任务：标注工单转学习任务卡，并完成遮挡、截断、同类实例边界判定与质检指导
- 当前已验收：文本输入、规则库按意图匹配、步骤/错误提示/依据、模糊追问、反馈类型区分和按类型 CSV 导出
- 本轮补强：命中规则 ID/来源追踪、多意图先澄清、反馈匿名确认、提交前外部证据预检（`npm run audit:ai-annotation-submission`）
- 当前证据：`deliverables/AI数据标注实训智能体-提交前总清单.md`、`AI数据标注实训智能体-自动化验收记录.md`
- 外部待补：真实场景来源核验、教师标准/平台 schema 复核、2 名学生 + 1 名教师真实试用证据

## 演示前必须确认

### 正式 AI 数据标注 MVP（无需完整基础设施）

- Node.js 20 和 `a3-student-react-web` 依赖已安装
- 3002 端口可用
- 页面启动后打开 `/annotation-agent`，确认顶部显示人工智能技术应用专业群和 AI 数据标注工程师
- 反馈演示按记录类型区分；AI 模拟记录不得导出为真实证据

### 历史兼容平台稳定主链路时

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

### 正式 AI 数据标注作品

1. 打开 `/annotation-agent`
2. 遮挡快捷问题：确认规则 ID、来源状态和步骤输出
3. 输入“这个怎么弄？”：确认澄清问题
4. 输入截断和同类实例问题：确认 `bbox` 边界、实例拆分和质检提示
5. 打开反馈窗口：内部演示选择“AI 模拟（内部演示）”；真人本人完成后才可选择“真实用户试用”
6. 运行提交前预检并查看 BLOCKED 项

以下是原平台的历史演示顺序，仅用于兼容回归：

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

历史平台现场时间有限时，优先保留：

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
