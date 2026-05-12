# 审核任务统计摘要总结

## problem
- 后台已支持审核任务列表和审批操作，但缺少面向审核页头部或运营首页的审核统计摘要接口。

## root cause
- 审核任务数据虽然已经可查询，但没有独立聚合层对状态、优先级、来源场景和待审核数量做统一输出。

## changes
- 在 `a3-ai-python/app/services/review_task_summary_service.py` 新增审核任务统计摘要服务。
- 在 `a3-ai-python/app/api/v1/admin.py` 新增 `/reviews/summary` 接口。
- 在 `a3-ai-python/app/schemas/admin.py` 新增 `ReviewTaskSummaryResponse`。
- 新增 `test_review_task_summary_service.py`，并扩展 `test_admin_api.py`。

## verification
- `python -m pytest app\tests\test_admin_api.py app\tests\test_review_task_summary_service.py`
- `python -m pytest app\tests\test_admin_api.py app\tests\test_admin_service.py app\tests\test_admin_export_service.py app\tests\test_admin_dashboard_service.py app\tests\test_admin_user_status_history_service.py app\tests\test_review_task_summary_service.py`
