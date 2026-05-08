# Portal AI Demo Runtime Fallback Summary

## 问题

AI 协同演示页在本地开发模式下调用长链路 `/chat` 请求时，页面会长时间等待，无法稳定展示 `intent`、`agent_trace`、`generated_plan`、`generated_resources`。

## 根因

- 浏览器侧通过本地开发代理访问长响应 AI 接口时不稳定
- 实时链路在本地联调环境下容易超时或被代理提前断开
- 之前页面只展示失败状态，没有为答辩演示准备可继续展示的降级结果

## 变更

- 为 AI 演示请求增加更宽松的客户端超时
- 新增 25 秒 UI 超时保护，避免页面长时间卡在加载中
- 在实时链路失败时自动切换到同结构演示快照
- 优化演示快照状态文案与学习计划展示文案

## 验证

- 在浏览器中打开 `http://127.0.0.1:18082/#/main/ai-demo`
- 点击“运行演示链路”后，页面会在实时链路不可用时自动切换到“演示快照”
- 结果区可正常展示 `intent`、`agent_trace`、`generated_plan`、`generated_resources`
