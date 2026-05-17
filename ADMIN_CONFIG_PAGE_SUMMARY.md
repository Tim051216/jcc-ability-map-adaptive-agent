# 系统配置页交付摘要

## problem
- 后端已经提供系统配置与配置历史接口，但前端没有对应管理页面，只能在总览页看到配置数量。
- 管理总览缺少系统配置入口，配置治理能力无法形成完整演示链路。

## root_cause
- 前端只接入了 `list configs` 的统计用途，没有继续实现配置列表、配置更新和历史回溯页面。
- 路由层也没有独立的系统配置页面入口，导致这块能力处于“后端已完成、前端未落地”的状态。

## changes
- 在 `a3-portal-web/src/api/ai.js` 中补充 `listAiSystemConfigHistory`。
- 重写 `a3-portal-web/src/router/modules/base.js`，整理管理端路由并新增 `/main/ai-admin-configs`。
- 重写 `a3-portal-web/src/pages/adminDashboard/index.vue`，补入系统配置入口并统一总览结构。
- 新增 `a3-portal-web/src/pages/adminConfigs/index.vue`，实现配置列表、配置新增/更新、变更历史展示。
- 通过后端接口补了 2 条非敏感演示配置，保证页面首次打开就有可展示数据。
- 调整配置历史摘要展示，避免把早先错误编码的描述字段直接暴露到页面。

## verification
- `npm run build`
- `GET http://127.0.0.1:18080/api/v1/admin/configs`
- `GET http://127.0.0.1:18080/api/v1/admin/configs/history`
- 浏览器访问 `http://localhost:18082/#/main/ai-admin`
- 浏览器访问 `http://localhost:18082/#/main/ai-admin-configs`
> LEGACY NOTE
> 本文记录的是旧版 `a3-portal-web` 管理页联调历史。
> 当前默认学生端前端为 `a3-student-react-web`（`3002`），当前默认管理端前端为 `a3-admin-web`（`3004`）。
