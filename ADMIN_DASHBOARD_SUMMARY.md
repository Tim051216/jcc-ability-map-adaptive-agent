# 后台运营总览摘要总结

## problem
- 后台已有用户、审核、日志、配置和智能体接口，但缺少一个适合首页卡片直接展示的运营总览摘要接口。

## root cause
- 各类后台数据分散在不同接口和仓储里，缺少统一聚合层对风险用户、待审核、未结工单和智能体状态做摘要输出。

## changes
- 在 `a3-ai-python/app/services/admin_dashboard_service.py` 新增后台运营总览摘要服务。
- 在 `a3-ai-python/app/api/v1/admin.py` 新增 `/dashboard/summary` 接口。
- 在 `a3-ai-python/app/schemas/admin.py` 新增 `AdminDashboardSummaryResponse`。
- 新增 `test_admin_dashboard_service.py`，并扩展 `test_admin_api.py`。

## verification
- `python -m pytest app\tests\test_admin_dashboard_service.py app\tests\test_admin_api.py`
- `python -m pytest app\tests\test_admin_api.py app\tests\test_admin_service.py app\tests\test_admin_export_service.py app\tests\test_admin_dashboard_service.py`
