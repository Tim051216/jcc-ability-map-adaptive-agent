# 学习画像历史与微调总结

## problem
- 学习画像后端只有构建与读取最新版本，缺少历史版本查询、人工微调和行为回流生成新版本能力。

## root cause
- 画像数据已按快照版本存储，但没有对外暴露历史读取与版本演进接口。

## changes
- 在 `a3-ai-python/app/services/profile_evolution_service.py` 新增画像历史查询、人工微调、行为回流更新服务。
- 在 `a3-ai-python/app/api/v1/profile.py` 新增 `/history`、`/tune`、`/feedback` 接口。
- 在 `a3-ai-python/app/schemas/profile.py`、`a3-ai-python/app/db/repositories/profile_repository.py` 补充对应 schema 与仓储查询能力。
- 新增 `test_profile_api.py`、`test_profile_evolution_service.py`，并扩展 `test_repository_persistence.py`。

## verification
- `python -m pytest app\tests\test_profile_api.py app\tests\test_profile_evolution_service.py`
- `python -m pytest app\tests\test_profile_api.py app\tests\test_profile_evolution_service.py app\tests\test_learning_api.py app\tests\test_repository_persistence.py`
