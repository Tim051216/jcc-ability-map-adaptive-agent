# 运行日志页交付摘要

## problem
- 管理端运行日志页之前还是占位式展示，缺少稳定的筛选、详情查看和导出链路。
- 审计日志接口虽然已经可用，但前端页面没有整理成适合验收演示的成品页。

## root_cause
- 前端页面能力和后端接口能力没有对齐，日志筛选与导出只停留在接口层。
- 页面缺少结构化摘要、详情抽屉和导出下载动作，导致演示链路不完整。

## changes
- 重写 `a3-portal-web/src/pages/adminLogs/index.vue`，补齐筛选、统计卡、详情抽屉和 CSV 导出。
- 在 `a3-portal-web/src/api/ai.js` 中补充 `exportAiAuditLogs` 接口封装。
- 浏览器验收 `http://localhost:18082/#/main/ai-admin-logs`，确认列表、详情和导出按钮工作正常。

## verification
- `npm run build`
- `GET http://127.0.0.1:18080/api/v1/admin/logs`
- 浏览器访问 `http://localhost:18082/#/main/ai-admin-logs`
