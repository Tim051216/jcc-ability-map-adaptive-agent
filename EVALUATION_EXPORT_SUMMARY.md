# 测评报告导出补齐摘要

## 问题

测评闭环已有生成、提交、错题查询和最新结果接口，但缺少“报告导出”后端能力。

## 根因

前期测评实现停留在结果查询层，尚未把评估结果整理成可下载、可展示的导出格式。

## 变更

- 新增 `a3-ai-python/app/services/evaluation_export_service.py`
- 新增 `GET /api/v1/evaluation/results/{record_id}/export`
- 支持两种导出格式：
  - `markdown`
  - `json`
- 新增 `EvaluationExportResponse` 导出响应模型
- 新增测试：
  - `a3-ai-python/app/tests/test_evaluation_export_service.py`
  - `a3-ai-python/app/tests/test_learning_api.py` 中的导出路由回归

## 验证

- `python -m pytest app\tests\test_evaluation_export_service.py app\tests\test_learning_api.py`
- `python -m py_compile app\services\evaluation_export_service.py app\tests\test_evaluation_export_service.py`
