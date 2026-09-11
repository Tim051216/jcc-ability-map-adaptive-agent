# XA-202603 赛题完成度与证据矩阵

| 赛题要求 | 可运行实现 | 当前可核验证据 | 状态 |
| --- | --- | --- | --- |
| 岗位动态与产业分析 | `GET /v1/xa-competition/industry/jobs-analysis`；公开 JSON/CSV/HTML 采集、岗位相关性筛选、技能热度、专业匹配、预警、优化清单；`GET /industry/snapshots` 只读历史聚合记录 | 四个公开 JSON 源运行时实测 fetched 418 条；六专业群均有匹配岗位；一键运行验收：[verify-xa-runtime.ps1](../scripts/verify-xa-runtime.ps1) 与 [xa-runtime-smoke-current.json](./evidence/xa-runtime-smoke-current.json)；前端冒烟：[smoke-xa-competition.ts](../a3-student-react-web/scripts/smoke-xa-competition.ts)；看板“历史采集记录” | 已完成，可持续积累历史快照 |
| 岗位能力图谱 | `POST /v1/xa-competition/job-ability/generate`；产业链→岗位群→岗位→能力项→能力单元→技能/知识点；支持将产业岗位分析的技能聚合与典型任务带入图谱；思维导图/雷达图 | 前端 `/job-ability-graph` 与接口测试 | 已完成，规则模板需教师复核 |
| 典型工作任务转学习任务 | `POST /v1/xa-competition/learning-task/generate`；情境、步骤、安全、知识/技能点、实训资源；可从产业岗位分析或岗位能力图谱带入能力项 | 前端 `/learning-task-factory` 与接口测试 | 已完成，可替换校内资源链接 |
| 个性化自适应学习 | `POST /v1/xa-competition/adaptive-learning/recommend`；目标、诊断、弱项、课→岗→赛路径、进度、徽章；支持传入岗位能力维度标签 | 前端 `/job-learning`；未测评不自动补分 | 已完成，需真实测评数据驱动 |
| 星辰工作流部署 | 工作流 `661895`、Agent `5789665`、知识库 `144411`、插件 `9697`；本地窄网关契约覆盖产业分析、专业群监测、能力图谱、任务卡和自适应推荐 | Chrome 发布管理列表可见 `5789665` 与“下架”操作；详情页可见“发布版本 / Trace日志”入口，但当前发布版本表显示“暂无数据”；`xfyun_agent/job-learning-plugin.openapi.yaml` 已列出 XA-202603 路由；历史调试记录 | 历史 Agent 条目已核验；新版契约是否已绑定并发布仍待稳定 HTTPS 部署后复核 |
| 教师/学生试用反馈 | `/trial-feedback` 支持学生/教师角色、实际任务、评分和问题提交，后端持久化 | 页面和接口已具备；需要真实参与者提交的记录 | 待真实用户采集，不使用虚构数据 |

最后一项是证据采集工作，不是可以由代码自动生成的事实；提交比赛材料时应附真实用户记录或脱敏汇总。
