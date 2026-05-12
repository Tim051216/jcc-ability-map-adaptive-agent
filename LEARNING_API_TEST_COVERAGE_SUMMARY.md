# Learning API Test Coverage Summary

## Problem

学习路径、资源、测评相关后端接口虽然已存在，但缺少路由层回归测试，任务清单状态也和实际实现不同步。

## Root Cause

前期主要在补业务能力和管理端闭环，主链路 API 的测试覆盖与任务文档同步没有及时跟上。

## Changes

- 重写 `BACKEND_TASK_LIST.md`，同步 T1-T7 当前状态
- 新增 `a3-ai-python/app/tests/test_learning_api.py`
- 补充 `plan/resource/evaluation` 路由层成功、404 和参数透传场景

## Verification

- `cmd /c python -m pytest app\tests\test_learning_api.py app\tests\test_admin_api.py app\tests\test_admin_service.py app\tests\test_admin_export_service.py`
- `30 passed`
