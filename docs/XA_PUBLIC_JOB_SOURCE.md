# XA-202603 公开岗位数据源接入

## 已采集公开样本（2026-09-09）

项目随附 `a3-ai-python/local_data/remotive_public_jobs.json`，并在运行配置中接入 Remotive、Jobicy、Remote OK、Arbeitnow 四个公开 JSON API。运行时会并发读取这些端点，再按专业群技能别名筛选岗位；对应 provenance 文件记录了来源、字段范围和隐私边界。

这属于公开网页/API 采集样本，不等同于 Remotive 或其他招聘平台的授权证明，也不等同于讯飞星辰 Agent、知识库、工作流部署记录或教师/学生实际试用反馈。只有在作品宣称“已获平台授权”“已在星辰正式部署”或“已有真实师生试用”时，才需要提供对应原始凭证；PDF 的赛题功能本身不要求伪造或补写这些凭证。

产业岗位分析接口：

```text
GET /api/v1/xa-competition/industry/jobs-analysis
```

## 配置来源

在 `a3-ai-python/.env` 中配置无需登录、允许公开访问的 JSON、CSV 或 HTML 地址。配置系统会在服务启动时读取 `XA_PUBLIC_JOB_SOURCES`，页面未填写来源时自动使用该值：

```env
XA_PUBLIC_JOB_SOURCES=https://example.org/public-jobs.json,https://example.org/jobs.html
```

多个地址使用英文逗号分隔。采集器最多读取 10 个来源，每个 JSON 来源最多读取 500 条记录，单个请求超时 12 秒，并发读取以避免多专业群监测页面超时。

采集器只接受无凭据的公网 `http/https` 地址；`localhost`、回环/私网/链路本地/组播/保留地址、`.local`/`.internal` 主机和包含用户名密码的 URL 会被拒绝，以避免把内网服务或账号信息带入对外插件。

演示时也可以直接在“产业岗位动态分析”页面填写公开岗位源地址。页面输入会同时用于当前专业群分析和“专业群横向监测”；留空时回退到服务器环境变量。地址必须是团队有权访问的公开 HTTP/HTTPS 资源，不得填写需要登录、绕过限制或包含个人简历敏感信息的地址。

看板默认启用“每 5 分钟自动监测”，页面保持打开时会重新采集当前岗位并刷新专业群横向比较；也可以关闭自动监测，或随时点击“重新采集公开岗位”。生产环境如需页面关闭后仍持续采集，应由部署方定时调用上述两个接口。

## JSON 格式

接口可以返回数组，也可以返回带 `items` 或 `jobs` 数组的对象。每条记录建议至少包含以下字段：

```json
[
  {
    "title": "工业视觉检测工程师",
    "description": "负责相机标定、缺陷识别和产线质量复核",
    "skills": "工业视觉检测, Python 数据处理, 质量控制"
  }
]
```

系统只提取岗位标题、描述、内容和技能字段做聚合分析，不保存个人姓名、电话、邮箱、简历等敏感数据。HTML 来源优先解析 `JobPosting` JSON-LD，其次解析独立的 `article` 岗位块；CSV 来源读取标题、描述、技能等同名字段。这样 `sample_count` 对应岗位记录数，而不是来源页面数。

## 分析输出

接口返回：

- `fetched_count`：所有来源成功读取并归一化的岗位记录数；
- `sample_count`：按当前专业群技能别名筛选后的匹配岗位样本数；同一条岗位不会因横向监测而重复计入无关专业群；
- `skills`：技能当前热度、前期热度、增长率和专业匹配度；
- `trend_months` / `trend_series`：技能热度序列；只有历史采集日期跨度至少 1 天时才标记为 `historical-snapshots`，同日刷新标记为 `single-public-snapshot`；没有真实快照时返回空序列并提示待采集，不把规范化样例绘制成历史趋势；
- `source_urls`：成功读取的来源地址；
- `collection_mode`：真实来源有匹配岗位时为 `public-job-http-adapter`，成功读取但无匹配岗位时为 `public-job-http-adapter-no-matching-postings`，未配置来源时为 `no-public-source-normalized-sample`；未配置来源时 `sample_count` 为 0，规范化技能行只用于界面结构演示，不代表岗位样本；
- `safety_notice`：提醒专业负责人复核样本、来源和统计口径。

横向监测接口：

```text
GET /api/v1/xa-competition/industry/professional-groups?source_urls=...
```

它按软件技术、智能制造、机电一体化、新能源汽车、现代物流管理、建筑信息模型技术六个专业群返回样本数、平均匹配度、增长领先技能和预警数量，使用与单专业看板相同的来源参数。

## 跨场景数据链

“岗位能力图谱”页面的“带入岗位技能”会调用上述岗位分析接口，并将技能聚合写入图谱生成请求；“岗位任务转学习卡”页面同时提供“从产业岗位分析带入”和“从岗位能力图谱带入”，把公开岗位技能、产业背景与典型任务带入学习任务卡。岗位学习页会把已有诊断维度标签传入自适应推荐接口，形成“岗位分析 → 能力图谱 → 学习任务 → 学情诊断 → 岗课赛路径”的可核验链路。任何规则模板结果仍需专业负责人或教师复核。

历史聚合快照只读接口：

```text
GET /api/v1/xa-competition/industry/snapshots
```

可按 `professional_group`、`core_job` 和 `limit` 筛选。接口只返回采集时间、来源地址和技能聚合值，便于评审核验连续采集；不返回岗位原文、姓名、电话、邮箱或简历。看板中的“历史采集记录”直接读取该接口。

配置真实来源并成功采集后，接口会将岗位技能聚合快照写入 AI 服务的 `local_data/xa_job_snapshots.db`，按专业群和核心岗位保留最近六次快照，用于形成真实历史趋势。未配置来源时使用的规范化样例不会写入该数据库。

## 本地验证

可运行 `scripts/verify-xa-runtime.ps1` 一键检查健康状态、公开岗位分析、六专业群监测、能力图谱、学习任务卡、自适应推荐，并将结构化结果写入 `docs/evidence/xa-runtime-smoke-current.json`。

```powershell
Set-Location a3-ai-python
$env:XA_PUBLIC_JOB_SOURCES = "https://example.org/public-jobs.json"
python -m pytest app/tests/test_xa_competition_api.py -q
```

正式参赛演示前，应替换为团队有权使用的真实公开来源，并保留采集时间、来源地址和脱敏说明作为作品材料证据。

## 自适应学习接口

岗位学习页会在目标保存且已有诊断分数后调用：

```text
POST /api/v1/xa-competition/adaptive-learning/recommend
```

请求包含 `goal`、`goal_scene`、`job_name` 和能力分数；返回薄弱能力、课→岗→赛三步任务、资源、解锁条件、进度和徽章。推荐结果是学习引导，不替代教师对真实设备操作和测评结果的复核。

任务卡接口返回的 `resources` 为结构化资源对象（`name`、`href`、`resource_type`），前端会将其链接到校内资源检索页；部署时可将检索路由替换为学校实际微课、仿真软件或实训平台地址。
