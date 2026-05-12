# 测评历史与趋势摘要总结

## problem
- 测评后端已有单次结果查询、错题查询和报告导出，但缺少历史记录查看与阶段趋势摘要能力。

## root cause
- 测评结果虽然已持久化到 `ai_evaluation_record`，但仓储层和接口层没有提供历史聚合与趋势统计输出。

## changes
- 在 `a3-ai-python/app/db/repositories/evaluation_repository.py` 新增按用户和课程查询测评历史能力。
- 在 `a3-ai-python/app/services/evaluation_history_service.py` 新增测评历史与趋势摘要服务。
- 在 `a3-ai-python/app/api/v1/evaluation.py` 新增 `/history` 和 `/trend` 接口。
- 在 `a3-ai-python/app/schemas/evaluation.py` 新增历史列表与趋势摘要响应模型。
- 新增 `test_evaluation_history_api.py`、`test_evaluation_history_service.py`，并扩展 `test_repository_persistence.py`。

## verification
- `python -m pytest app\tests\test_evaluation_history_api.py app\tests\test_evaluation_history_service.py app\tests\test_repository_persistence.py`
- `python -m pytest app\tests\test_evaluation_service.py app\tests\test_evaluation_export_service.py app\tests\test_evaluation_history_api.py app\tests\test_evaluation_history_service.py app\tests\test_learning_api.py app\tests\test_repository_persistence.py`
