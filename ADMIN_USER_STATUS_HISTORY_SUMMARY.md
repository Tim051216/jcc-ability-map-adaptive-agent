# 后台用户状态变更历史总结

## problem
- 后台已经支持用户状态更新，但缺少状态变更历史查询接口，运营侧无法直接回看谁在什么时候做过什么状态操作。

## root cause
- 用户状态更新虽然已经写入 `admin_user` 审计日志，但没有独立服务把这些日志按用户状态维度聚合输出。

## changes
- 在 `a3-ai-python/app/services/admin_user_status_history_service.py` 新增用户状态变更历史服务。
- 在 `a3-ai-python/app/api/v1/admin.py` 新增 `/users/status-history` 接口。
- 在 `a3-ai-python/app/schemas/admin.py` 新增状态历史响应模型。
- 新增 `test_admin_user_status_history_service.py`，并扩展 `test_admin_api.py`。

## verification
- `python -m pytest app\tests\test_admin_api.py app\tests\test_admin_user_status_history_service.py`
- `python -m pytest app\tests\test_admin_api.py app\tests\test_admin_service.py app\tests\test_admin_export_service.py app\tests\test_admin_dashboard_service.py app\tests\test_admin_user_status_history_service.py`
