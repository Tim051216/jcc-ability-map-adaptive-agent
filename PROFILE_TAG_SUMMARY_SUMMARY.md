# 学习画像标签统计摘要总结

## problem
- 学习画像后端已有最新画像、历史版本、人工微调和行为回流接口，但缺少适合画像页头部展示的标签统计摘要接口。

## root cause
- 画像快照虽然已持续存储，但没有独立聚合层对画像标签和推荐资源类型做统一统计输出。

## changes
- 在 `a3-ai-python/app/services/profile_tag_summary_service.py` 新增画像标签统计摘要服务。
- 在 `a3-ai-python/app/api/v1/profile.py` 新增 `/summary` 接口。
- 在 `a3-ai-python/app/schemas/profile.py` 新增 `ProfileTagSummaryResponse`。
- 新增 `test_profile_tag_summary_service.py`，并扩展 `test_profile_api.py`。

## verification
- `python -m pytest app\tests\test_profile_api.py app\tests\test_profile_tag_summary_service.py`
- `python -m pytest app\tests\test_profile_api.py app\tests\test_profile_evolution_service.py app\tests\test_profile_tag_summary_service.py app\tests\test_learning_api.py app\tests\test_repository_persistence.py`
