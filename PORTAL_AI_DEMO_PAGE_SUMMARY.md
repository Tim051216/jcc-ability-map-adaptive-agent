# Portal AI Demo Page Summary

## 问题

门户前端缺少一个能直观展示多智能体协同结果的演示页，无法把 `intent`、`agent_trace`、`generated_plan`、`generated_resources` 用于答辩和验收展示。

## 根因

现有 `a3-portal-web` 主要围绕课程门户业务页面构建，请求封装也默认依赖传统 `code/data` 包装，不适合直接消费 AI 网关返回的原始 JSON 结构。

## 变更

- 新增独立 AI 请求模块，直接调用 `/api/ai/v1/chat`
- 新增 `AI 协同演示页`，可切换场景并可视化展示多智能体结构化输出
- 在首页演示横幅中增加显眼入口，便于现场答辩快速跳转

## 验证

- 在 `a3-portal-web` 执行 `npm run build:local`
- Vite 构建通过，说明新增页面、路由和样式均可正常打包
