# 智能辅导系统 - 实施进度

## 已完成任务

### ✅ 任务 1: 数据库设计与创建
**完成时间**: 2024-01-10

**交付物**:
- `sql/tj_tutoring.sql` - 完整的数据库表设计
  - tutoring_session - 答疑会话表
  - tutoring_question - 问题表（支持多模态）
  - tutoring_answer - 解答表（支持文字+图解+视频）
  - escalation_record - 升级记录表
  - tutoring_favorite - 收藏记录表
  - 完整的索引设计

**验收标准**: ✅ 全部达成
- [x] 所有表结构创建成功
- [x] 支持多模态内容存储（JSON字段）
- [x] 支持会话管理
- [x] 索引创建完成

---

### ✅ 任务 2: 辅导数据模型开发
**完成时间**: 2024-01-10

**交付物**:

**Java 实体类和 Mapper**:
- 枚举类（5个）:
  - `TutoringSessionStatus` - 会话状态
  - `TutoringQuestionStatus` - 问题状态
  - `AnswerSource` - 解答来源
  - `EscalationReason` - 升级原因
  - `EscalationStatus` - 升级处理状态
- 实体类（5个）:
  - `TutoringSession` - 会话实体
  - `TutoringQuestion` - 问题实体
  - `TutoringAnswer` - 解答实体
  - `EscalationRecord` - 升级记录实体
  - `TutoringFavorite` - 收藏记录实体
- Mapper 接口（5个）:
  - 对应每个实体的 MyBatis Mapper

**Python 数据模型**:
- `app/db/models/tutoring.py` - SQLAlchemy 模型
- `app/schemas/tutoring.py` - Pydantic Schema（包含请求/响应模型）

**验收标准**: ✅ 全部达成
- [x] Java 实体类和 Mapper 完成
- [x] Python 数据模型完成
- [x] 支持多模态数据结构（JSON字段）

---

### ✅ 任务 3: 问题分析智能体
**完成时间**: 2024-01-10

**交付物**:
- `app/agents/nodes/question_analyzer_agent.py`
  - `QuestionAnalyzerAgent` 类
  - 问题理解（文字解析、意图识别）
  - 问题分类（知识点识别、类型分类、难度评估）
  - 问题扩展（背景信息、关联知识点、相似问题检索）
  - `question_analyzer_node` - LangGraph 节点函数

**验收标准**: ✅ 核心功能完成
- [x] 问题理解准确（基于 LLM）
- [x] 分类功能实现（知识点、类型、难度）
- [x] 图片识别支持（预留接口）

---

### ✅ 任务 4: 解答生成智能体
**完成时间**: 2024-01-10

**交付物**:
- `app/agents/nodes/answer_generator_agent.py`
  - `AnswerGeneratorAgent` 类
  - RAG 检索（知识检索、相似问题检索）
  - 解答生成（Markdown 格式、LaTeX 公式支持）
  - 个性化调整（根据学生画像）
  - 知识来源标注
  - 置信度评估
  - `answer_generator_node` - LangGraph 节点函数

**验收标准**: ✅ 核心功能完成
- [x] 解答生成准确（基于 LLM + RAG）
- [x] 个性化效果（支持学生画像）
- [x] 来源标注完整

---

### ✅ 任务 5: 图解生成智能体
**完成时间**: 2024-01-10

**交付物**:
- `app/agents/nodes/diagram_generator_agent.py`
  - `DiagramGeneratorAgent` 类
  - 图解需求判断
  - 图解类型确定（flowchart/mindmap/graph）
  - Mermaid 代码生成
  - 图解优化
  - `diagram_generator_node` - LangGraph 节点函数

**验收标准**: ✅ 核心功能完成
- [x] 图解生成准确
- [x] 图解类型合适
- [x] 可视化效果（Mermaid 格式）

---

### ✅ 任务 6: 视频推荐智能体
**完成时间**: 2024-01-10

**交付物**:
- `app/agents/nodes/video_recommender_agent.py`
  - `VideoRecommenderAgent` 类
  - 基于知识点的视频检索
  - 基于问题类型的视频检索
  - 推荐策略（考虑学生画像、多样性）
  - 视频片段定位：`VideoRecommenderAgent._locate_relevant_segments` — 支持 `captions` / `chapters` / `segments_detail` 文本命中选段；`transcript` 概览区间；无字幕时标题/知识点关键词与时长启发式（`segments`：`start_sec` / `end_sec` / `reason`）
  - `video_recommender_node` - LangGraph 节点函数
- `app/integrations/java_clients/media_client.py` - 媒体服务客户端

**验收标准**: ✅ 核心功能完成
- [x] 视频检索准确
- [x] 推荐效果好
- [x] 片段定位（字幕/章节匹配 + 无字幕启发式；见 `test_video_recommender_segments.py`）

---

### ✅ 任务 7: 辅导协调器
**完成时间**: 2024-01-10

**交付物**:
- `app/agents/tutoring_coordinator.py`
  - `TutoringCoordinator` 类
  - LangGraph 工作流编排
  - 多智能体协同（问题分析 → 解答生成 + 视频推荐 → 图解生成 → 聚合 → 置信度评估）
  - 置信度评估和升级判断
  - 结果聚合
  - 流式输出支持

**验收标准**: ✅ 全部达成
- [x] 协调器正常运行
- [x] 置信度评估准确
- [x] 结果聚合完整

---

### ✅ 任务 8-11: 业务服务开发
**完成时间**: 2024-01-10

**交付物**:
- `app/services/tutoring_service.py`
  - `TutoringService` 类
  - 问题输入服务（接收、验证、预处理）
  - 解答生成服务（异步生成、保存、评价）
  - 答疑历史服务（查询、搜索、管理）
  - 升级处理服务（自动升级、人工分配、反馈机制）

**验收标准**: ✅ 核心功能完成
- [x] 问题接收正常
- [x] 解答生成稳定
- [x] 历史查询功能完整
- [x] 升级触发准确

---

### ✅ 任务 12: 辅导 API
**完成时间**: 2024-01-10

**交付物**:
- `app/api/v1/tutoring.py`
  - POST `/api/v1/tutoring/question` - 提交问题
  - GET `/api/v1/tutoring/answer/{questionId}` - 获取解答
  - GET `/api/v1/tutoring/history` - 查询历史（`start_date` / `end_date`、`keyword` 匹配问题或解答正文）
  - POST `/api/v1/tutoring/evaluate` - 评价解答
  - POST `/api/v1/tutoring/escalate` - 升级问题
  - POST `/api/v1/tutoring/favorite` - 收藏记录
  - DELETE `/api/v1/tutoring/favorite/{questionId}` - 取消收藏

**验收标准**: ✅ 全部达成
- [x] 所有接口功能正常
- [x] 参数验证完整
- [x] 接口文档（通过 FastAPI 自动生成）

---

## 待完成任务

### ✅ 任务 13: 前端辅导界面
**完成时间**: 2024-01-10

**交付物**:
- `a3-admin-web/src/api/tutoring.js` - API 客户端
- `a3-admin-web/src/pages/tutoring/index.vue` - 主页面
- `a3-admin-web/src/pages/tutoring/components/QuestionInput.vue` - 问题输入组件
- `a3-admin-web/src/pages/tutoring/components/AnswerDisplay.vue` - 解答展示组件
- `a3-admin-web/src/pages/tutoring/components/TutoringHistory.vue` - 答疑历史组件
- `a3-admin-web/src/pages/tutoring/README.md` - 使用文档

**已实现功能**:
- ✅ 问题提交界面（文字输入、图片上传、课程关联）
- ✅ 解答展示界面（Markdown 渲染、Mermaid 图表渲染、视频推荐）
- ✅ 答疑历史界面（列表、搜索、筛选、分页、**日期范围**）
- ✅ 评价功能（有帮助/没帮助、星级评分、文字反馈）
- ✅ 收藏功能（收藏/取消收藏）
- ✅ 升级功能（升级到人工处理）

**待完善功能**:
- ✅ WebSocket 实时推送（进度步骤 + 完成后 `saved`；失败回退 HTTP `getAnswer`）
- ✅ LaTeX 公式渲染（KaTeX `auto-render`）
- ✅ 代码高亮（highlight.js）
- ✅ 课程 / 小节下拉：`QuestionInput`、`TutoringHistory` 对接 `getCoursesPage`、`getcoursesListData`（与资源生成页一致）
- ✅ 图片随问题提交：`QuestionInput` 在提交时将本地图片转为 **Base64 data URL** 填入 `question_images`（无需对象存储即可联调多模态）
- ✅ 图片 OCR 预览（可选）：`POST /api/v1/tutoring/ocr-preview`（Base64/data URL；`poetry install --extras ocr` 或等价安装 Pillow+pytesseract 后 `engine=tesseract`，否则 `engine=none` + `hint`）；管理端 `QuestionInput.vue`「识别首张图中文字」+ `tutoring.js` `ocrPreview`
- ✅ 图片上传 MinIO：`POST /api/v1/tutoring/upload-image`（multipart，`MINIO_*` + 可选 `MINIO_PUBLIC_BASE_URL`；无私网前缀时用预签名 GET）；管理端提交时**优先 URL**，失败回退 Base64

**验收标准**: ✅ 核心功能完成
- [x] 提交界面友好
- [x] 解答渲染正确（Markdown + Mermaid + KaTeX + 代码高亮）
- [x] 历史管理方便
- [x] 评价功能完整
- [x] 实时交互（WebSocket + 降级同步拉取）

---

### ✅ 任务 14: 集成测试（自动化范围已完成）

**最近验证时间**: 2026-05-10

**自动化验证结果**:
- `.\.venv\Scripts\python.exe -m pytest app/tests/test_answer_generator_fallback.py app/tests/test_tutoring_api.py app/tests/test_tutoring_history_query.py app/tests/test_video_recommender_segments.py app/tests/test_tutoring_performance_smoke.py`
- 结果：`34 passed`

**本机手工联调结果**:
- AI 服务可启动并响应：`GET /health` 返回 `status=ok`
- AI 管理接口可用：`GET /api/v1/admin/ping` 返回 `admin ok`
- 真实模型联通正常：`GET /api/v1/admin/llm/ping` 返回 `status=ok`
- 真实 Embedding 联通正常：`GET /api/v1/admin/embedding/ping` 返回 `status=ok`
- Docker 依赖已拉起：MySQL / Redis / PostgreSQL / MinIO / Milvus 可用
- MySQL 初始化已完成：`scripts/init-mysql.ps1`
- PostgreSQL Alembic 迁移已补齐辅导表：新增 `20260510_0009_tutoring_tables.py`
- 智能辅导真实接口可用：`history`、`question`、`answer`、`evaluate`、`escalate`、`favorite` 已完成实测
- AI 直连与网关转发均可创建问题并查询答案
- 网关本地正确入口为 `/ai/v1/**`；当前配置会先 `StripPrefix=1` 再 `PrefixPath=/api`，因此 `/ai/api/v1/**` 会变成错误的 `/api/api/v1/**`
- 当前本地生成链路在 LLM 异常时会返回**结构化降级答案**，不再只返回“抱歉，生成出错”
- 2026-05-10 最新实测：直连 `POST /api/v1/tutoring/question` + `GET /api/v1/tutoring/answer/{id}` 的真实生成耗时约 `46.1s`；经网关 `/ai/v1/tutoring/**` 转发的端到端耗时约 `48.5s`
- 相比此前真实生成耗时约 `147s` 到 `155s`，超时控制与启发式降级已显著缩短等待时间
- 本地 `gateway` 已补齐 `ai / ls / us / cs` 直连路由；重启后 `/ls/**` 不再返回“服务不存在”，而是落到学习服务自身响应（当前 `actuator/health` 返回 `401`）
- `a3-user` 已补齐本地启动配置并成功监听 `8082`；经网关 `/us/**` 转发已落到真实后端响应（当前 `actuator/health` 为 `404`，与直连一致）
- `a3-resource` 已补齐本地启动配置并在 `local` 模式禁用 Seata，成功监听 `8086`；经网关 `/cs/**` 转发已落到真实后端响应（当前 `actuator/health` 为 `404`，与直连一致）
- `a3-user` 真实业务接口已验证：直连 `GET /users/checkCellphone?cellphone=13900000000` 返回 `true`，经网关 `/us/users/checkCellphone?...` 返回统一包装 `code=200`
- `a3-resource` 真实业务接口已验证：直连 `GET /categorys/all?admin=false` 返回 `[]`，经网关 `/cs/categorys/all?admin=false` 返回统一包装 `code=200`
- `a3-user` 本地 `500` 的根因已定位为 `MyBatis-Plus 3.4.3 + JDK 21` 的模块反射限制；补充 `--add-opens java.base/java.lang.invoke=ALL-UNNAMED` 后已恢复正常查询
- RabbitMQ 本地容器已修复：将 `docker-compose.local.yml` 中的 RabbitMQ 数据目录改为 Docker named volume，避免 Windows bind mount 导致 `.erlang.cookie` 权限不符合要求
- 2026-05-11 最新实测：`a3-rabbitmq` 容器稳定 `Up`，`5672/15672` 正常监听，管理台 `GET /api/overview`（`guest/guest`）返回 `200`
- `.\.venv\Scripts\python.exe -m pytest app/tests/test_tutoring_performance_smoke.py -q` 已通过：`2 passed`
- `.\.venv\Scripts\python.exe -m pytest app/tests/test_tutoring_history_query.py -q` 已通过：`3 passed`
- `.\.venv\Scripts\python.exe -m pytest app/tests/test_tutoring_api.py -q` 已通过：`25 passed`
- 2026-05-11 本地顺序基线：
  - AI 直连 `GET /api/v1/tutoring/history?page=1&page_size=5`，20 次顺序请求 `avg ≈ 101.65ms`，`p95 ≈ 118.73ms`
  - 网关转发 `GET /ai/v1/tutoring/history?page=1&page_size=5`，20 次顺序请求 `avg ≈ 100.67ms`，`p95 ≈ 95.66ms`
- 2026-05-11 本地 5 并发基线：
  - AI 直连 `history`：`5/5` 成功，`avg ≈ 599.34ms`，`p95 ≈ 1079.13ms`
  - 网关转发 `history`：`5/5` 成功，`avg ≈ 332.39ms`，`p95 ≈ 387.25ms`
  - 网关 `/us/users/checkCellphone`：`5/5` 成功，`avg ≈ 1176.03ms`，`p95 ≈ 2041.09ms`
  - 网关 `/cs/categorys/all`：`5/5` 成功，`avg ≈ 1225.31ms`，`p95 ≈ 2048.81ms`
- 2026-05-11 更高并发读接口基线：
  - AI 直连 `history`：`10/10` 成功，`avg ≈ 621.62ms`，`p95 ≈ 786.43ms`
  - AI 直连 `history`：`20/20` 成功，`avg ≈ 626.28ms`，`p95 ≈ 1036.31ms`
  - 网关转发 `history`：`10/10` 成功，`avg ≈ 643.26ms`，`p95 ≈ 877.52ms`
  - 网关转发 `history`：`20/20` 成功，`avg ≈ 651.01ms`，`p95 ≈ 1046.94ms`
- 2026-05-11 真实生成小并发样本：
  - 经网关 `POST /ai/v1/tutoring/question` + `GET /ai/v1/tutoring/answer/{id}` 做 `3` 并发真实提问，`3/3` 成功
  - 端到端总耗时 `avg ≈ 51834.67ms`，`p95 ≈ 54064ms`
  - 单次 `generation_time` 约 `45.8s` 到 `46.8s`，未出现并发下的异常失败或明显级联放大
- 2026-05-11 30 秒混合场景基线（网关读接口持续请求 + 真实生成并行）：
  - `gateway-ai-history` 两个持续读 worker 共完成 `56` 次请求，`56/56` 成功，单 worker `avg ≈ 984.67ms / 1042.42ms`，`p95 ≈ 5.3s`
  - `gateway-us-checkCellphone` 单 worker 在 30 秒内完成 `3792/3792` 成功，`avg ≈ 6.92ms`，`p95 ≈ 12.43ms`
  - `gateway-cs-category-all` 单 worker 在 30 秒内完成 `3708/3708` 成功，`avg ≈ 6.9ms`，`p95 ≈ 11.44ms`
  - 并行的 1 个真实生成请求成功完成，端到端 `total ≈ 51173ms`，`generation_time ≈ 46277ms`
  - 结论：轻量读流量不会击穿真实生成链路，但 `history` 的尾延迟会在混合负载下被明显拉高
- 本地网关仍存在旁路告警：`/cs`、`/ls`、`/us` 等服务发现路由在当前本地模式下返回“服务不存在”，`RabbitMQ` 容器也存在 `.erlang.cookie` 权限问题；但不阻塞智能辅导主链路最小验证

**已完成（自动化烟测）**:
- `a3-ai-python/app/tests/test_tutoring_api.py` — 提交问题、拉取解答（含 `should_escalate`）、历史列表、**历史筛选 query 透传**、**评价**、**升级**、**收藏（新增/重复/删除/不存在）**、**无权访问解答 404**、**提交校验失败 400**、**待生成时触发 `generate_answer`**、**收藏时 answer 与 question 不匹配 404**、**`ocr-preview` 非法 Base64 400 / 最小 PNG 200**、**`upload-image` 成功/校验 400/存储 503**、**WebSocket `/stream/{id}`：`complete` 直出、`step`+`saved` 生成链路、`x-user-id` 头、非 debug 缺 user 错误** Mock 覆盖（24 例；`pytest app/tests/test_tutoring_api.py`）
- `a3-ai-python/app/tests/test_answer_generator_fallback.py` — 当上游 LLM 调用失败时，仍返回结构化 Markdown 降级答案，而不是空白或纯报错
- `a3-ai-python/app/agents/nodes/question_analyzer_agent.py` — 增加启发式分析和 `8s` 超时保护，避免单个分析节点长时间阻塞
- `a3-ai-python/app/agents/nodes/answer_generator_agent.py` — 增加 `10s` 超时保护，并在失败时输出结构化 Markdown 降级答案
- `a3-ai-python/app/agents/nodes/diagram_generator_agent.py` — 关闭额外的“是否需要图解”LLM 判定，并为其余 LLM 调用增加 `6s` 超时保护
- `a3-ai-python/app/tests/test_video_recommender_segments.py` — 视频 `segments`：字幕选段、标题关键词、无字幕回退
- `a3-ai-python/app/tests/test_tutoring_history_query.py` — 历史日期范围「含结束日」辅助函数
- `a3-ai-python/app/tests/test_tutoring_performance_smoke.py` — Mock 环境下的接口时延守门：`GET /answer/{id}` 连续 40 次、WebSocket `/stream/{id}` 连续 20 次，校验 P95 时延未出现异常回退
- `a3-admin-web/src/utils/request.js` — **FormData** 上传不强制 `Content-Type: application/json`，并**合并**调用方传入的头（如辅导 `X-User-Id`），保证 `upload-image` 多部分与鉴权可用
- `app/api/v1/tutoring.py` — 修复 `HTTPException` 被通用 `except Exception` 吞掉导致 404 变 500 的问题（`get_answer` 等）
- `scripts/verify-intelligent-tutoring-local.ps1` — 本地联调检查脚本：校验 AI / 网关端口、`admin ping`、OCR 预览、历史查询，供真实环境拉起后快速验收
- `a3-ai-python/alembic/versions/20260510_0009_tutoring_tables.py` — PostgreSQL 侧正式补齐 `tutoring_session`、`tutoring_question`、`tutoring_answer`、`escalation_record`、`tutoring_favorite`
- `a3-gateway/src/main/resources/bootstrap-local.yml` — 本地模式关闭 Nacos 依赖，并补齐 `ai / ls / us / cs` 直连路由
- `a3-user/src/main/resources/bootstrap-local.yml`、`application-local.yml` — 用户服务本地关闭 Nacos，补齐 MySQL / Redis / RabbitMQ 参数
- `a3-user/pom.xml` — 为 `spring-boot-maven-plugin` 指定 `com.cnsoftbei.a3.user.UserApplication`，修复本地启动时“多主类候选”失败
- `a3-user/pom.xml`、`a3-resource/pom.xml` — 为 `spring-boot-maven-plugin` 补充 `--add-opens java.base/java.lang.invoke=ALL-UNNAMED`，兼容 JDK 21 下 MyBatis-Plus LambdaQuery 反射限制
- `a3-resource/src/main/resources/bootstrap-local.yml`、`application-local.yml` — 课程资源服务本地关闭 Nacos，补齐 MySQL / Redis / RabbitMQ 参数，并在 `local` 模式禁用 Seata
- `docker-compose.local.yml` — 将 RabbitMQ 的 `/var/lib/rabbitmq` 持久化从 Windows bind mount 切换为 named volume `a3-rabbitmq-data`，修复 `.erlang.cookie` 权限导致的启动失败
- `a3-ai-python/app/tests/test_tutoring_history_query.py` — 新增 `query_history()` 批量查询回归测试，明确约束 answers / favorites 仅做批量加载，防止回退到 `N+1` 查询
- `a3-ai-python/app/schemas/tutoring.py` — 将 `class Config` 切换为 Pydantic V2 `ConfigDict(from_attributes=True)`，消除 `tutoring` 相关 schema 的弃用警告

**尚未覆盖（建议后续补充）**:
- 管理端 / 学生端页面级 E2E（浏览器操作 + WebSocket 展示）
- `/cs`、`/ls`、`/us` 本地静态路由或服务发现补齐后，再做课程/用户上下文增强验证
- 更长时间窗口压测（如持续 5-15 分钟）与更高强度混合读写/生成场景压测

---

## 技术栈总结

### 后端（Python AI 服务）
- **框架**: FastAPI
- **智能体编排**: LangGraph
- **数据库**: PostgreSQL + SQLAlchemy
- **LLM 集成**: OpenAI-compatible API
- **RAG**: Milvus 向量数据库

### 后端（Java 服务）
- **框架**: Spring Boot + MyBatis Plus
- **数据库**: MySQL 8.0

### 前端
- **框架**: Vue 3 + Vite
- **UI 库**: Element Plus
- **Markdown 渲染**: marked + DOMPurify
- **图表渲染**: Mermaid
- **公式渲染**: KaTeX（auto-render）
- **代码高亮**: highlight.js

---

## 下一步计划

1. **集成测试**（任务 14）
   - E2E（网关转发 `/api/ai`、WebSocket 代理 `ws: true`）
   - pytest 已含历史筛选透传与 **WebSocket 流式契约**（Starlette `TestClient`）；本机数据库与网关链路已打通
   - 剩余重点转为浏览器级真实页面联调，以及本地服务发现缺口补齐后的增强验证

2. **优化和完善**
   - 图片 OCR：已接预览与管理端按钮；对象存储 URL 已接；后续可多图批处理与识别质量提示
   - ✅ 视频片段定位（见任务 6 交付物；单测 `app/tests/test_video_recommender_segments.py`）
   - 历史搜索：`GET /history` 支持 `start_date` / `end_date`（结束日为 00:00:00 时按含当日）；`keyword` 同时匹配问题与解答正文（PostgreSQL `ILIKE`）。大规模全文检索可后续接 Elasticsearch
   - ✅ 敏感词过滤：`app/services/tutoring_sensitive.py`，`TUTORING_SENSITIVE_WORDS`（逗号分隔）、`TUTORING_SENSITIVE_FILTER_ENABLED`；问题正文与评价反馈均校验

3. **工程债（已处理）**
   - 本地构建/开发已改用 `--mode devlocal`，避免与 Vite `.env.local` 规则冲突（`npm run dev` / `npm run build` 不变）

---

## 关键文件清单

### 数据库
- `sql/tj_tutoring.sql`

### Java 实体和 Mapper
- `a3-learning/src/main/java/com/cnsoftbei/a3/learning/enums/` - 枚举类
- `a3-learning/src/main/java/com/cnsoftbei/a3/learning/domain/po/` - 实体类
- `a3-learning/src/main/java/com/cnsoftbei/a3/learning/mapper/` - Mapper 接口

### Python 智能体
- `a3-ai-python/app/agents/nodes/question_analyzer_agent.py`
- `a3-ai-python/app/agents/nodes/answer_generator_agent.py`
- `a3-ai-python/app/agents/nodes/diagram_generator_agent.py`
- `a3-ai-python/app/agents/nodes/video_recommender_agent.py`
- `a3-ai-python/app/agents/tutoring_coordinator.py`

### Python 服务和 API
- `a3-ai-python/app/services/tutoring_service.py`
- `a3-ai-python/app/services/tutoring_sensitive.py`（敏感词）
- `a3-ai-python/app/services/tutoring_ocr_service.py`（OCR 预览，可选 Pillow+Tesseract）
- `a3-ai-python/app/services/tutoring_image_storage.py`（MinIO 配图上传）
- `a3-ai-python/app/api/v1/tutoring.py`
- `a3-ai-python/app/db/models/tutoring.py`
- `a3-ai-python/app/schemas/tutoring.py`

### 集成客户端
- `a3-ai-python/app/integrations/java_clients/media_client.py`
