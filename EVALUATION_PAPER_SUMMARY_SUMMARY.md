# 测评试卷统计摘要总结

## problem
- 测评后端已有试卷生成与试卷详情接口，但缺少适合测评入口页或后台测评卡片使用的试卷统计摘要接口。

## root cause
- 试卷数据和题目结构虽然已持久化，但没有独立聚合层对试卷总数、题量、题型和知识点分布做统一输出。

## changes
- 在 `a3-ai-python/app/db/repositories/evaluation_paper_repository.py` 新增按用户查询试卷列表能力。
- 在 `a3-ai-python/app/services/evaluation_paper_summary_service.py` 新增测评试卷统计摘要服务。
- 在 `a3-ai-python/app/api/v1/evaluation.py` 新增 `/papers/summary` 接口。
- 在 `a3-ai-python/app/schemas/evaluation.py` 新增 `EvaluationPaperSummaryResponse`。
- 新增 `test_evaluation_paper_summary_api.py`、`test_evaluation_paper_summary_service.py`。

## verification
- `python -m pytest app\tests\test_evaluation_paper_summary_api.py app\tests\test_evaluation_paper_summary_service.py`
- `python -m pytest app\tests\test_evaluation_service.py app\tests\test_evaluation_export_service.py app\tests\test_evaluation_history_api.py app\tests\test_evaluation_history_service.py app\tests\test_evaluation_paper_summary_api.py app\tests\test_evaluation_paper_summary_service.py app\tests\test_wrong_question_summary_api.py app\tests\test_wrong_question_summary_service.py app\tests\test_learning_api.py app\tests\test_repository_persistence.py`
