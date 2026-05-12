# 多智能体协同资源生成 - 实施进度（节选）

## 任务 1：数据库设计与创建

**交付物**

- `sql/tj_learning_resource.sql`：`learning_resource`、`resource_generation_task`、`resource_content`、`resource_favorite`，以及按类型的扩展表（文档 / 导图 / 题库 / 视频 / 代码案例）、索引与注释。
- Java 侧实体字段与该脚本对齐（`a3-learning` 模块）。

## 任务 2：资源数据模型

**Java（MyBatis-Plus）**

- 主表与任务：`LearningResource`、`ResourceGenerationTask`、`ResourceContent`、`ResourceFavorite`
- 分类型 PO：`ResourceDocument`、`ResourceMindmap`、`ResourceQuestion`/`ResourceQuestionBank`、`ResourceVideo`、`ResourceCodeExample`
- 推送：`ResourcePush`
- 枚举：`ResourceType`、`ResourceStatus`
- 对应 `mapper/*.java`

**Python（AI 服务）**

- `app/schemas/resource.py`：请求/响应与任务、收藏等 Pydantic 模型
- `app/db/models/generated_resource.py`：PostgreSQL 侧 `ai_generated_resource` / 收藏相关（与门户 AI 生成链路一致；Java MySQL 主 schema 为另一数据源时可按需对齐同步）

## 任务 8–12（后端概要）

- **协调器**：`app/agents/nodes/resource_generation/coordinator_agent.py`
- **服务**：`app/services/resource_generation_service.py`、`resource_management_service.py`、`resource_service.py`
- **路由**：`app/api/v1/resource.py`（挂载于 `app/api/router.py` 前缀 `/v1/resource`）
  - 生成、任务 CRUD、资源列表/详情、收藏等（以当前代码为准）

## 任务 13–14：管理端前端（已实现骨架）

- `a3-admin-web/src/pages/resource/generation/index.vue` — 生成
- `management/index.vue`、`detail/index.vue`、`favorites/index.vue`
- `a3-admin-web/src/pages/resource/README.md`

## 任务 15：集成测试（部分自动化）

- `a3-ai-python/app/tests/test_multi_agent_resource_generation_integration.py`（Mock 环境下协调器、任务创建/查询/取消、列表过滤等）
- **运行**（`a3-ai-python` 目录）：`python -m pytest app/tests/test_multi_agent_resource_generation_integration.py -q`

**仍建议手工 / 后续**

- 网关转发与登录态全链路、WebSocket 进度（若产品要求）、真实 LLM 与对象存储、并发与性能。

## 下一步建议

- 明确 Java MySQL 资源表与 Python `ai_generated_resource` 是否要做单向同步或统一写入路径。
- 任务 15 扩展：对 `app/api/v1/resource.py` 的 HTTP 契约测试（Starlette `TestClient`，类似辅导模块）。
