# 仓储层回归补齐总结

## problem
- 后端新增的仓储层缺少独立持久化测试，筛选、排序、upsert 和归档收藏等行为没有被直接验证。

## root cause
- 现有测试主要集中在 API 和 service，数据库读写逻辑尚未建立独立回归用例。

## changes
- 在 `a3-ai-python/app/tests/test_repository_persistence.py` 新增基于 `sqlite+aiosqlite` 的异步仓储层测试。
- 覆盖 `admin_repository.py`、`chat_ticket_repository.py`、`resource_repository.py`、`plan_progress_repository.py`、`profile_repository.py`、`evaluation_paper_repository.py` 的关键读写行为。
- 在 `a3-ai-python/pyproject.toml` 的 `dev` 依赖中补充 `aiosqlite`。

## verification
- `python -m pytest app\tests\test_repository_persistence.py`
- `python -m pytest app\tests\test_admin_service.py app\tests\test_chat_ticket_service.py app\tests\test_resource_service.py app\tests\test_plan_service.py app\tests\test_evaluation_service.py app\tests\test_repository_persistence.py`
