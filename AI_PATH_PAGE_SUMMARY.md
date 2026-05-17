# AI 学习路径页补充总结

## 问题
- 当前系统虽然已经能在 AI 协同演示页生成学习路径，但缺少一个更正式的学生端路径执行页，答辩展示时不够像完整业务系统。

## 根因
- 后端只有生成接口，没有“读取最近一次路径”的独立查询入口。
- 前端缺少专门承接学习路径结果的页面，无法体现阶段、节点、资源推送和动态调优。

## 变更
- 新增 `GET /api/v1/plan/latest`，支持按 `user_id + course_code` 读取最近一次学习路径。
- 新增前端 API：
  - `generateAiLearningPlan`
  - `getLatestAiLearningPlan`
- 新增正式路径页：
  - `a3-portal-web/src/pages/learningPath/index.vue`
- 新增首页入口卡片：
  - `a3-portal-web/src/pages/main/components/AiPathEntry.vue`
- 新增路由：
  - `/main/ai-path`
- 在 AI 协同演示页增加“进入正式学习路径页”跳转入口。

## 验证
- `F:\\A3-cnsoftbei\\a3-learning-agent-system\\a3-ai-python\\.venv\\Scripts\\python.exe -m compileall app`
- `GET http://127.0.0.1:18080/api/v1/plan/latest?user_id=1&course_code=ml_intro`
- 浏览器验证：
  - `http://127.0.0.1:18082/#/main/ai-demo` 可见“进入正式学习路径页”
  - 点击后跳转到 `http://127.0.0.1:18082/#/main/ai-path`
  - 路径页可展示阶段、节点任务和最新路径结果
> LEGACY NOTE
> 本文记录的是旧版 `a3-portal-web` 学生端页面历史。
> 当前默认学生端前端为 `a3-student-react-web`（`3002`），当前默认管理端前端为 `a3-admin-web`（`3004`）。
