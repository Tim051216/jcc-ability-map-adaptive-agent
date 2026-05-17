# 后台运营任务

## 当前口径

- 当前默认管理端前端：`a3-admin-web`
- 默认本地端口：`3004`
- `a3-portal-web` 中的旧管理页已归入 legacy 范畴，不再作为当前管理端任务承接目录

## 建议负责目录

- `a3-admin-web/src/components/dashboard/Overview.tsx`
- `a3-admin-web/src/components/dashboard/UserGovernance.tsx`
- `a3-admin-web/src/components/dashboard/ContentCompliance.tsx`
- `a3-admin-web/src/components/dashboard/ServiceOperations.tsx`
- `a3-admin-web/src/components/dashboard/AIMonitoring.tsx`
- `a3-admin-web/src/components/dashboard/SystemManagement.tsx`
- `a3-admin-web/src/lib/adminApi.ts`
- `a3-ai-python/app/api/v1/admin.py`
- `a3-ai-python/app/services/admin_*`

## 任务清单

1. 后台总览补齐关键指标卡片、状态探活和入口跳转。
2. 用户治理补齐查询、详情、状态更新和风险维度展示。
3. 内容审核补齐列表、摘要、审核操作和历史查看。
4. AI 监控补齐状态、日志、摘要和异常暴露。
5. 系统管理补齐配置、历史、敏感字段展示和健康检查。

## 验收标准

- 管理首页到各模块可以顺畅跳转
- 每个模块至少有一条真实数据链路
- 列表、详情、操作、历史四类基础能力齐全
- 中文文案正常，适合现场演示
