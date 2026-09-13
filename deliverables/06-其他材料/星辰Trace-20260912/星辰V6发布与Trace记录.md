# 星辰 V6 发布与 Trace 记录

记录日期：2026-09-12（Asia/Shanghai）

## 1. 发布对象

| 项目 | 核验值 |
| --- | --- |
| 工作流名称 | 软件开发岗位能力自适应教练 |
| 工作流编号 | `661895` |
| FlowID | `7490593025040211968` |
| 智能体编号 | `5789665` |
| 原插件编号 | `9697` |
| 共享工具 ID | `tool@a455e0dd8821000` |
| V6 插件记录 ID | `10293` |
| V6 operationId | `软件开发岗位能力插件-kt09t7ds` |
| 工作流插件版本 | `V6.0` |
| 插件发布时间 | `2026-09-12 20:05:28` |
| 工作流更新时间 | `2026-09-12 20:06:20` |
| 工作流状态 | `1`（平台已发布状态） |

## 2. OpenAPI 检查与导入处理

`a3-ai-python/xfyun_agent/job-learning-plugin.openapi.yaml` 已检查并包含 5 个路径：岗位学习概览、产业分析、能力图谱、任务卡、自适应推荐。

在星辰平台直接导入这份多路径 OpenAPI 时，平台返回错误码 `30026`（插件导入失败）。由于当前插件编辑界面按单接口维护，本次没有虚构“导入成功”，而是保留原插件 `9697` 对应的共享工具 ID，手动同步 XA 兼容路由、输入输出结构和临时 HTTPS 端点，生成并发布 V6。

## 3. XA 接口实测

联调基址：`https://dxebr-112-2-249-27.run.pinggy-free.link`

| 接口 | HTTP | 耗时 | 返回路由 | 核验结果 |
| --- | ---: | ---: | --- | --- |
| `/api/v1/xa/industry-analysis` | 200 | 815 ms | `industry_analysis` | 返回 5 个岗位能力基准 |
| `/api/v1/xa/ability-map` | 200 | 1024 ms | `ability_map` | 返回 5 个能力维度；无测评时分数为 `null` |
| `/api/v1/xa/task-cards` | 200 | 1156 ms | `task_cards` | 无测评时不伪造任务卡，返回空列表与安全提示 |
| `/api/v1/xa/adaptive-recommendations` | 200 | 889 ms | `adaptive_recommendations` | 无测评时不伪造个性化路径，返回下一步诊断动作 |

Pinggy 对普通浏览器 GET 可能展示隧道提醒页。以上直连验证使用 `Bypass-Tunnel-Reminder: true` 请求头；星辰平台内的 V6 插件工具测试已独立成功，能够返回真实后端派生结果。

2026-09-12 20:16 再次从星辰“工具测试”页面调用 V6 成功：`fetched_count: 5`、`ai_generated: false`，返回 5 个岗位能力项、未测评提醒、提升建议及三项安全约束。

## 4. 最新工作流 Trace

- 调试问题：`请基于真实岗位数据分析我的软件开发岗位能力，指出薄弱项，给出三步提升路径，并保留来源与安全提示。`
- 最新调试记录 ID：`1546075`
- SID：`spf00aaa498@dx1a09582ec00a4f1782`
- 创建时间：`2026-09-12 20:06:39`
- 总耗时：`18.758s`
- Token：`1075`
- 可见节点耗时：`12.118s`、`6.565s`
- 结果：运行完成；回答明确说明没有真实测评，不伪造个人分数，给出三步提升路径、来源状态、生产隔离、数据脱敏和许可证核对提示。

工作流节点已核验绑定：

```text
pluginId: tool@a455e0dd8821000
operationId: 软件开发岗位能力插件-kt09t7ds
version: V6.0
```

发布动作的后端返回：`/xingchen-api/bot/take-off-bot` 与 `/xingchen-api/bot/send-approval` 均为 `code: 0`；发布后工作流接口状态为 `1`，页面按钮显示“更新发布”。

## 5. 截图目录

- `05-workflow-v6-trace.png`：V6 调试完成、总耗时与 Token、回答安全提示。
- `06-workflow-v6-result.png`：V6 完整回答结果。
- `07-plugin-v6-published.png`：插件列表中的 V6 发布时间。
- `08-workflow-v6-published.png`：工作流更新时间、V6 节点画布与“更新发布”状态。
- `09-plugin-v6-online-test.png`：发布后从星辰平台再次调用 V6 的实时返回结果。

关键截图 SHA-256：

| 文件 | SHA-256 |
| --- | --- |
| `05-workflow-v6-trace.png` | `1E26774843B743E45BAC0791523AE9AA36AEEC586926DC1E4BE28A12748A66F2` |
| `06-workflow-v6-result.png` | `F89BD6D11E09C909CDFE324584E73B2E9074F8A173E2BC5CE454E092F1282C7A` |
| `07-plugin-v6-published.png` | `8C0F319A7F977D4BAF2B0A625A9315ECC5366BBD480421C049AB9C88B3AE2A1D` |
| `08-workflow-v6-published.png` | `64DA7A593C7B454CD47CEABC81F2E59BF336633BF6DF57A7DD11D07A25FA1E45` |
| `09-plugin-v6-online-test.png` | `3265B2B65738E0F05A7F586CBCE9BF6B28ABD05BE3E3B34CEAB2F9B924C3C851` |

## 6. 演示限制

当前 Pinggy 为匿名临时隧道，约 60 分钟后可能失效，不能作为正式比赛部署。正式演示前应将插件网关部署到稳定 HTTPS 域名，更新 OpenAPI `servers.url` 和星辰插件端点，重新发布插件与工作流，并重新保存接口调用和 Trace 截图。
