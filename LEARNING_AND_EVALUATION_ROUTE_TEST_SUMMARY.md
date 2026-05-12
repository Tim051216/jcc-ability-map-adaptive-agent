# 学习路径与测评路由回归补齐摘要

## 问题

`T5` 学习路径闭环和 `T6` 测评闭环的后端接口虽然已经存在，但缺少完整的路由层回归测试，状态还不能算真正收口。

## 根因

前期实现重点放在主链路功能和资源闭环，学习路径、测评这两块的接口缺少统一的 API 锁定用例。

## 变更

- 在 `a3-ai-python/app/tests/test_learning_api.py` 补充学习路径路由测试：
  - 生成计划
  - 计划详情不存在
  - 步骤暂停
  - 步骤继续
- 补充测评路由测试：
  - 在线测评
  - 试卷不存在
  - 测评结果不存在
- 同步更新 `BACKEND_TASK_LIST.md`，将 `T5/T6` 标记为后端已完成，并记录 `T7` 迁移已验证到 `20260509_0008`

## 验证

- `python -m pytest app\tests\test_learning_api.py`
- `python -m py_compile app\tests\test_learning_api.py`
