# A3 演示接口说明

## 1. 说明

当前仓库里同时存在两套演示接口：

- `Java 学习服务演示骨架接口`
  位于 `a3-learning`，前缀为 `/a3/agent-demo`
- `Python AI 服务真实演示接口`
  位于 `a3-ai-python`，默认前缀为 `/api/v1`

答辩时建议把这两套接口区分说明：

- `/a3/agent-demo/**` 更适合展示输入输出结构与多智能体演示骨架
- `/api/v1/**` 更适合展示当前真实 AI 链路和后端能力闭环

## 2. Java 学习服务演示骨架接口

服务地址：

- 直连 `http://127.0.0.1:8090`

接口前缀：

- `/a3/agent-demo`

接口列表：

- `POST /a3/agent-demo/profile`
- `POST /a3/agent-demo/resources`
- `POST /a3/agent-demo/path`
- `POST /a3/agent-demo/preview`

请求体示例：

```json
{
  "studentName": "张三",
  "major": "计算机科学与技术",
  "courseName": "机器学习基础",
  "learningGoal": "两周内掌握监督学习核心概念并完成课程项目",
  "recentDialogue": "我看公式时容易乱，希望多给我例子和实践任务。",
  "weakPoints": ["损失函数理解", "梯度下降原理", "模型评估指标"],
  "preferredResourceTypes": ["讲解文档", "练习题", "实操案例"],
  "availableHoursPerWeek": 6
}
```

适用场景：

- 不依赖 Python AI 中台时的演示兜底
- 展示赛题所需的输入输出结构
- 说明系统后续可替换为真实 AI 编排

## 3. Python AI 服务接口

服务地址：

- 直连 `http://127.0.0.1:18080/api/v1`
- 经过网关 `http://127.0.0.1:10010/ai/v1`

### 3.1 核心 AI 能力

- `POST /chat`
- `POST /profile/build`
- `GET /profile/latest`
- `GET /profile/history`
- `POST /plan/generate`
- `GET /plan/latest`
- `POST /resource/generate`
- `GET /resource`
- `POST /rag/search`
- `POST /admin/knowledge/{course_code}/ingest`

### 3.2 智能辅导

- `POST /tutoring/ocr-preview`
- `POST /tutoring/upload-image`
- `POST /tutoring/question`
- `GET /tutoring/answer/{question_id}`
- `GET /tutoring/history`
- `POST /tutoring/evaluate`
- `POST /tutoring/escalate`
- `POST /tutoring/favorite`
- `DELETE /tutoring/favorite/{question_id}`
- `WS /tutoring/stream/{question_id}`

### 3.3 后台运营与治理

- `GET /admin/ping`
- `GET /admin/dashboard/summary`
- `GET /admin/llm/ping`
- `GET /admin/embedding/ping`
- `GET /admin/configs`
- `GET /admin/reviews`
- `GET /admin/logs`
- `GET /admin/agents/status`
- `GET /admin/users`

## 4. Java 学习服务当前可演示接口

服务地址：

- `http://127.0.0.1:8090`

当前与学生主链路直接相关的接口包括：

- `POST /learning/path/create`
- `GET /learning/path/{pathId}`
- `GET /learning/path/current`
- `POST /learning/path/{pathId}/activate`
- `POST /learning/path/{pathId}/pause`
- `POST /learning/path/{pathId}/resume`
- `GET /learning/path/{pathId}/progress`
- `POST /learning/progress/record`
- `POST /evaluation/test`
- `GET /evaluation/test/course/{courseId}`
- `GET /evaluation/test/{testId}`
- `POST /evaluation/answer/submit`
- `GET /evaluation/answer/wrong`
- `POST /evaluation/report/generate/{testId}`
- `GET /evaluation/report/{reportId}`
- `GET /evaluation/report/{reportId}/export`

## 5. 当前推荐口径

如果评委问“你们现在到底演示哪套接口”，推荐这样回答：

- 学生学习闭环由 Java 学习服务承载，保证基础链路稳定
- AI 增强能力由 Python AI 中台承载，包含画像、RAG、问答、资源生成和后台运营能力
- `/a3/agent-demo/**` 用来做赛题骨架展示，`/api/v1/**` 用来做真实 AI 能力展示
