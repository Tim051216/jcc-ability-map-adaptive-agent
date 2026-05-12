# 评测闭环后端补齐摘要

## problem
- 原有评估后端只有报告生成与最近结果查询，缺少试卷生成、作答提交、结果查询和错题回看闭环。

## root cause
- 评估模块只实现了 `EvaluationRecord` 聚合结果存储，没有试卷与答题明细的数据模型和接口。

## changes
- 新增评测试卷与答题模型、仓储和迁移：
  - `ai_evaluation_paper`
  - `ai_evaluation_answer`
- 新增评测接口：
  - `POST /api/v1/evaluation/papers/generate`
  - `GET /api/v1/evaluation/papers/{paper_id}`
  - `POST /api/v1/evaluation/papers/{paper_id}/submit`
  - `GET /api/v1/evaluation/results/{record_id}`
  - `GET /api/v1/evaluation/results/{record_id}/wrong-questions`
- 扩展评估 schema，支持试卷、答案、错题和结果标识。
- 重构评估服务，接通“出卷 -> 提交 -> 聚合评估 -> 错题回看”链路。

## verification
- 运行 `python -m compileall app`
- 编译通过
