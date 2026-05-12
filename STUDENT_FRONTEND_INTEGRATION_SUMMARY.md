# 前端集成修复总结

## problem
- 管理端缺少人工工单处理页面，学生侧升级到人工后的工单无法在后台形成完整处理闭环。
- 管理台、学生概览、内容审核和路由标题存在明显中文乱码，影响页面可用性和导航识别。
- 用户管理页仅能看概览，未接入后端已提供的用户详情与账号状态更新接口。

## root_cause
- 前端虽然已经接入了工单相关 API，但没有对应的管理端页面与路由入口。
- 部分管理页文件与路由配置长期存在编码污染，导致文案和标题失真。

## changes
- 新增 `a3-portal-web/src/pages/adminTickets/index.vue`，支持工单列表筛选、详情查看、人工回复和状态更新。
- 重写 `a3-portal-web/src/pages/adminDashboard/index.vue`，补充工单入口和关键指标展示。
- 重写 `a3-portal-web/src/pages/adminUsers/index.vue`，增加搜索、风险筛选和清晰中文文案。
- 重写 `a3-portal-web/src/pages/adminReview/index.vue`，恢复审核流程页面可读性。
- 重写 `a3-portal-web/src/pages/adminAgents/index.vue` 与 `a3-portal-web/src/pages/adminLogs/index.vue`，清理监控与审计页乱码。
- 扩展 `a3-portal-web/src/api/ai.js`，补充管理员用户详情与状态更新接口。
- 重写 `a3-portal-web/src/pages/adminUsers/index.vue`，增加账号状态筛选、详情抽屉、计划进度/工单展示和状态更新操作。
- 更新 `a3-portal-web/src/mock/a3DemoData.js`，将“人工工单”加入后台入口卡片。
- 重写 `a3-portal-web/src/router/modules/base.js`，新增 `ai-admin-tickets` 路由并修正主要页面标题。

## verification
- 在 `F:\A3-cnsoftbei\a3-learning-agent-system\a3-portal-web` 执行 `npm run build` 通过。
- 在浏览器中验证 `http://localhost:18082/#/main/ai-admin` 与 `http://localhost:18082/#/main/ai-admin-tickets` 可正常打开并渲染页面。
- 在浏览器中验证 `http://localhost:18082/#/main/ai-admin-users` 已切换到新版用户管理页结构。
