# 学习路径统计摘要总结

## problem
- 学习路径后端已有生成、详情和进度接口，但缺少适合学习路径页头部或学生总览使用的统计摘要接口。

## root cause
- 学习计划数据虽然已持久化，但没有独立聚合层对计划总数、课程分布、状态分布和平均完成度做统一输出。

## changes
- 在 `a3-ai-python/app/db/repositories/plan_repository.py` 新增按用户查询计划列表能力。
- 在 `a3-ai-python/app/services/plan_summary_service.py` 新增学习路径统计摘要服务。
- 在 `a3-ai-python/app/api/v1/plan.py` 新增 `/summary` 接口。
- 在 `a3-ai-python/app/schemas/plan.py` 新增 `LearningPlanSummaryResponse`。
- 新增 `test_plan_summary_api.py`、`test_plan_summary_service.py`。

## verification
- `python -m pytest app\tests\test_plan_summary_api.py app\tests\test_plan_summary_service.py`
- `python -m pytest app\tests\test_plan_service.py app\tests\test_plan_summary_api.py app\tests\test_plan_summary_service.py app\tests\test_learning_api.py app\tests\test_repository_persistence.py`
