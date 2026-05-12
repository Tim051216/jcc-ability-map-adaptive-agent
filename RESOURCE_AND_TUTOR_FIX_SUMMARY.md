# 资源生成与智能辅导修复记录

## 问题
- 学生端资源生成页点击后没有返回可用结果，收藏链路无法演示。
- 智能辅导页还是静态展示壳子，未接入真实异步任务流程。

## 根因
- `a3-ai-python/app/services/resource_service.py` 存在乱码和字符串损坏，资源生成服务本身不可靠。
- 本机当前未连通 `127.0.0.1:18080` 的 AI 接口，前端请求无法拿到真实后端结果。
- 智能辅导页未接 `/aigw/v1/chat/tasks` 异步任务轮询链路。

## 修改
- 重写 `a3-portal-web/src/pages/intelligentTutor/index.vue`，补齐异步提问、任务轮询、结果展示、引用片段、执行轨迹和本地历史记录。
- 修复 `a3-ai-python/app/services/resource_service.py`，恢复正常资源标题、摘要、Markdown 内容与学习建议生成逻辑。

## 验证
- `cd F:\A3-cnsoftbei\a3-learning-agent-system\a3-portal-web && npm run build`
- `cd F:\A3-cnsoftbei\a3-learning-agent-system\a3-ai-python && python -m compileall app`
- 本机接口探测：`http://127.0.0.1:18080/ai/v1/resource/generate` 当前未连通，说明还需启动 AI 服务链路后再做端到端验收。
