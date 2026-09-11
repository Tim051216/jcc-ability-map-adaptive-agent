# Chrome URL 通道故障排查

- 重新初始化 `@oai/sky` 成功，Chrome 窗口唯一识别为窗口 `464206`。
- 已通过地址栏导航至：`https://agent.xfyun.cn/agentbuilder/work_flow/661895/arrange`
- 导航动作本身返回成功。
- 读取窗口状态时仍被 Computer Use 安全策略终止：`could not determine the current browser URL on Windows with enough confidence`。
- 根因表现为 Chrome 连接器的当前认证方式为 `apikey`，URL 元数据无法回传；不是页面地址或工作流编号问题。

## 恢复建议

1. 在 Codex/浏览器连接器设置中重新连接 Chrome，改用受支持的 OAuth/浏览器扩展会话，避免 `apikey` 会话。
2. 关闭并重新打开 Chrome 扩展连接，再让 Codex 读取标签页 URL。
3. 若需立即继续，使用 Codex In-app Browser 打开同一星辰地址并完成云端操作。
