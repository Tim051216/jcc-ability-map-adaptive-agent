# XA-202603 星辰发布与接口核验记录

- 核验时间：2026-09-11（Asia/Shanghai）
- 工作流：`661895`（FlowID `7490593025040211968`）
- 插件：`9697`
- 契约：`a3-ai-python/xfyun_agent/job-learning-plugin.openapi.yaml`
- 契约版本：`1.1.0`
- 契约解析：成功，包含 6 条路由

## 本地真实接口调用

已对运行于 `127.0.0.1:18080` 的 XA 后端完成以下调用，完整响应保存于 `xa-api-results.json`：

1. `GET /api/v1/xa-competition/industry/jobs-analysis`
2. `POST /api/v1/xa-competition/job-ability/generate`
3. `POST /api/v1/xa-competition/learning-task/generate`
4. `POST /api/v1/xa-competition/adaptive-learning/recommend`

## 云端发布状态

未在本次核验中声称云端新版已发布。Chrome 自动化连接因当前 Codex 浏览器认证方式为 `apikey`，无法可靠读取当前页面 URL，安全策略终止了浏览器操作。现有仓库记录也明确指出：新版 XA-202603 契约仍缺少重新导入、绑定、工作流发布与最新 Trace 的云端证据。

需要在星辰控制台完成并截图留证：重新导入 1.1.0 契约、绑定插件 9697、将 XA 路由加入工作流 661895、发布新版、运行四类能力接口，并保存发布版本页与最新 Trace。
