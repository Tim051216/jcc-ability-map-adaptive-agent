# 个性化学习路径规划 - 实施进度

## 已完成（节选）

- **任务 1–2**：数据库与 Java PO / Mapper（见 `sql` 与 `a3-learning` 模块）。
- **Java 学习路径 API**：`LearningPathController`（创建、详情、激活/确认、我的路径、当前路径、进度、暂停/恢复/完成）。
- **服务实现**：`LearningPathServiceImpl`（所有权校验、完成时行为采集等）。

## 任务 13：集成测试（部分自动化）

**新增（2026）**：

- `a3-learning/src/test/java/com/cnsoftbei/a3/learning/controller/LearningPathControllerTest.java`  
  - **Standalone `MockMvc`** + Mockito 注入 `ILearningPathService`（避免拉起完整 Spring / MyBatis）  
  - Jackson `JavaTimeModule` 用于含 `LocalDateTime` 的 VO 序列化  
  - 覆盖：`POST /learning/path/create`、`GET /learning/path/my`、`GET /learning/path/current`（配合 `UserContext`）、`GET /learning/path/{id}`、`GET /learning/path/{id}/progress`、`POST …/activate`、`POST …/confirm`、`POST …/pause`、`POST …/resume`、`POST …/complete`
- `a3-learning/src/test/java/com/cnsoftbei/a3/learning/controller/PathNodeControllerTest.java`  
  - **Standalone `MockMvc`** + Mockito 注入 `IPathNodeService`  
  - 覆盖：`GET /learning/node/path/{pathId}`（含空列表）、`GET /learning/node/{nodeId}`、`POST …/start|complete|pause|skip|redo`、`GET /learning/node/{nodeId}/next`（含 `data` 为 null）
- `a3-learning/src/test/java/com/cnsoftbei/a3/learning/controller/LearningProgressControllerTest.java`  
  - **Standalone `MockMvc`** + Mockito 注入 `ILearningProgressService`  
  - 覆盖：`POST /learning/progress/record`、`GET /learning/progress/path/{pathId}`、`GET /learning/progress/node/{nodeId}`

**运行**（仓库根目录，PowerShell 需引号包住 `-Dtest`）：

```bash
mvnw.cmd -pl a3-learning test "-Dtest=LearningPathControllerTest,PathNodeControllerTest,LearningProgressControllerTest"
```

**仍建议手工 / E2E**：

- 网关鉴权后真实用户链路、与 Python 规划服务（若接入）联调、节点种子 `seedDemoNodes` 全链路、并发与性能。

## 任务 11（管理端学习路径页，部分）

- `a3-admin-web/src/pages/LearningPath/index.vue`：路径 **`currentNodeId`** 高亮与「当前」角标、**阶段进度**条（按 `stageType` 聚合）、**关注知识点**（目标知识点 + 未完成练习/测评节点上的知识点）、节点详情中 **关联知识点** 与 **完成条件**（JSON 格式化）、跳过节点样式区分。

## 任务 12（门户学习日历，部分）

- `a3-portal-web/src/api/learningPath.js`：`GET /ls/learning/path/current`、`GET /ls/learning/node/path/{pathId}`（走网关 `/api` + 登录态）。
- `a3-portal-web/src/pages/learningCalendar/index.vue`：**正式学习路径优先**（有路径与节点时按 `startTime/activateTime/createTime` 起算逐日铺开），否则沿用 **AI 计划** 与本地 fallback；**月历**（`el-calendar` + 当日任务计数角标）、**列表**、**自定义任务**（`localStorage` 持久化，完成/删除）、本周统计与数据来源说明。

## 下一步

- 日历与真实「测评任务」表联动（若后端提供日历 API）；学习热力图可对接行为埋点。
- ~~扩展 Java 测试：`PathNodeController`、`LearningProgressController` HTTP 契约~~（已补充 `PathNodeControllerTest`、`LearningProgressControllerTest`）。
