# 学习效果评估系统 - 实施进度（节选）

## 任务 13：集成测试（当前已自动化部分）

### Java HTTP 契约烟测

- `a3-learning/src/test/java/com/cnsoftbei/a3/learning/controller/EvaluationControllerTest.java`
  - **Standalone `MockMvc`** + `LocalValidatorFactoryBean`（`@Validated` DTO）+ Mockito 注入四类 Service
  - Jackson `JavaTimeModule`
  - 覆盖：`POST /evaluation/test`、`PUT …/publish`、`GET …/course/{courseId}`、`GET …/test/{id}`、`POST /evaluation/answer/submit`、`GET /evaluation/answer/wrong`（含 `prompt` / `correct_answer` / `explanation` 映射）、`POST …/report/generate/{testId}`、`GET …/report/{reportId}`（摘要 / `reportTypeDesc` / `masteryLevel`）
  - 结果：`2026-05-10` 本地复跑通过，`Tests run: 8, Failures: 0, Errors: 0`

### Python 路由与服务回归

- `a3-ai-python/app/tests/test_evaluation_service.py`
- `a3-ai-python/app/tests/test_evaluation_history_service.py`
- `a3-ai-python/app/tests/test_evaluation_history_api.py`
- `a3-ai-python/app/tests/test_evaluation_export_service.py`
- `a3-ai-python/app/tests/test_evaluation_paper_summary_service.py`
- `a3-ai-python/app/tests/test_evaluation_paper_summary_api.py`
- `a3-ai-python/app/tests/test_learning_api.py`
  - 覆盖：测评主流程、历史查询、导出、试卷摘要，以及学习路径/资源/测评相关 API 回归
  - 结果：`2026-05-10` 本地复跑通过，`34 passed`

### 本轮修复

- `a3-ai-python/app/db/session.py`
  - 补充异步 `get_db()` 上下文，修复 `EvaluationAgentService` 导入存在但实现缺失的问题。
- `a3-ai-python/app/schemas/resource.py`
  - 拆分 V1/V2 收藏响应模型命名，避免 `ResourceFavoriteResponse` 被 V2 模型覆盖。
- `a3-ai-python/app/api/v1/resource.py`
- `a3-ai-python/app/services/resource_management_service.py`
  - 同步适配新的 V2 收藏响应模型，消除 `test_learning_api.py` 中的响应校验失败。

## 运行

```bash
.\mvnw.cmd -pl a3-learning test -Dtest=EvaluationControllerTest
cd a3-ai-python
python -m pytest app\tests\test_evaluation_service.py app\tests\test_evaluation_history_service.py app\tests\test_evaluation_history_api.py app\tests\test_evaluation_export_service.py app\tests\test_evaluation_paper_summary_service.py app\tests\test_evaluation_paper_summary_api.py app\tests\test_learning_api.py
```

## 仍需补充

- 端到端（网关 + 登录态）联调
- AI 出题 / 批改真实模型全链路验证
- 性能测试

## 已实现后端概要（代码库）

- MySQL 脚本与 Java：`evaluation_*` 表、Mapper、`EvaluationController` 及管理端/门户对接（见仓库）。
- 批改与报告：`EvaluationAnswerRecordServiceImpl`、`IEvaluationReportService` 等。
