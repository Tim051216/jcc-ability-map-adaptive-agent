# 测评错题统计摘要总结

## problem
- 测评后端已有错题列表接口，但缺少适合错题本头部或测评详情页展示的错题统计摘要接口。

## root cause
- 错题明细虽然已经可查询，但没有独立聚合层对错题总数、知识点分布和题型分布做统一输出。

## changes
- 在 `a3-ai-python/app/services/wrong_question_summary_service.py` 新增错题统计摘要服务。
- 在 `a3-ai-python/app/api/v1/evaluation.py` 新增 `/results/{record_id}/wrong-questions/summary` 接口。
- 在 `a3-ai-python/app/schemas/evaluation.py` 新增 `WrongQuestionSummaryResponse`。
- 新增 `test_wrong_question_summary_api.py`、`test_wrong_question_summary_service.py`。

## verification
- `python -m pytest app\tests\test_wrong_question_summary_api.py app\tests\test_wrong_question_summary_service.py`
- `python -m pytest app\tests\test_evaluation_service.py app\tests\test_evaluation_export_service.py app\tests\test_evaluation_history_api.py app\tests\test_evaluation_history_service.py app\tests\test_wrong_question_summary_api.py app\tests\test_wrong_question_summary_service.py app\tests\test_learning_api.py app\tests\test_repository_persistence.py`
