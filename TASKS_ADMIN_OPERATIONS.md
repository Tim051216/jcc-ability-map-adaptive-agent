# 后台运营任务

## 负责人目标

把后台从“有页面骨架”推进到“可演示运营闭环”，重点打通总览、用户管理、审核、日志、智能体监控、系统配置几个模块。

## 建议负责目录

- `a3-portal-web/src/pages/adminDashboard`
- `a3-portal-web/src/pages/adminUsers`
- `a3-portal-web/src/pages/adminReview`
- `a3-portal-web/src/pages/adminLogs`
- `a3-portal-web/src/pages/adminAgents`
- `a3-portal-web/src/pages/adminConfigs`
- `a3-portal-web/src/pages/adminTickets`
- `a3-ai-python/app/api/v1/admin.py`
- `a3-ai-python/app/services/admin_*`

## 任务清单

1. 后台首页补齐关键指标卡片、快捷入口和页面跳转关系。
2. 用户管理页联调真实查询、详情、状态更新、风险筛选、历史记录。
3. 内容审核页联调审核列表、通过驳回、审核历史与摘要接口。
4. 日志页联调审计日志、运行日志、导出接口和筛选条件。
5. 智能体监控页联调运行状态、异常智能体、日志摘要和详情。
6. 系统配置页联调配置列表、更新、历史、摘要和敏感字段脱敏展示。
7. 人工工单页联调工单列表、详情、回复、状态流转，形成辅导升级闭环。

## 验收标准

- 后台首页到各模块可以顺畅跳转
- 每个模块至少有一条真实数据链路
- 列表、详情、操作、历史四类基础能力齐全
- 管理页中文正常，布局稳定，适合现场演示

## 适合的成员类型

- 熟悉管理后台页面开发
- 能看懂接口字段并快速完成联调
- 适合承担“页面闭环负责人”角色
