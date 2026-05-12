# 后台审核与日志后端补齐摘要

## problem
- 原有后台只有健康检查、知识入库和模型连通性检测，没有内容审核任务和日志查询能力。

## root cause
- 缺少审核任务数据模型、审核接口以及审计日志查询服务，后台页面无法接入真实后端数据。

## changes
- 新增审核任务模型、仓储和迁移：
  - `ai_content_review_task`
- 新增后台审核接口：
  - `POST /api/v1/admin/reviews`
  - `GET /api/v1/admin/reviews`
  - `GET /api/v1/admin/reviews/{review_id}`
  - `POST /api/v1/admin/reviews/{review_id}/approve`
  - `POST /api/v1/admin/reviews/{review_id}/reject`
- 新增后台日志接口：
  - `GET /api/v1/admin/logs`
- 新增后台服务，审核动作会同步写入 `ai_audit_log`，支持日志查询。

## verification
- 运行 `python -m compileall app`
- 编译通过
