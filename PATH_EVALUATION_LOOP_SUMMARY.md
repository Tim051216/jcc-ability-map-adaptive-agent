# 路径与评估闭环升级总结

## 问题
- 当前 AI 演示链路更偏向“问答 + 资源生成”，和 PPT 里要求的“个性化学习路径 + 学习效果评估 + 闭环反馈”还有差距。

## 根因
- `plan` 与 `evaluation` 只有占位实现，缺少阶段化路径节点、资源推送、评估报告与结果回流。
- 现有多智能体图里没有独立评估节点，前端也没有把这部分业务结果可视化出来。

## 变更
- 新增独立 `assessment_agent`，将链路扩成 `profile -> router -> retriever/planner/resource -> assessment -> evaluator -> safety`。
- 扩展学习路径结构，支持阶段、节点状态、资源推送、动态调整建议、检查点。
- 扩展评估结构，支持分层评估、指标得分、报告摘要、路径反馈、画像反馈。
- 为学习路径与评估结果增加数据库持久化写入。
- 更新 AI 演示页，新增路径阶段卡、风险提示、评估报告展示区。

## 验证
- `F:\\A3-cnsoftbei\\a3-learning-agent-system\\a3-ai-python\\.venv\\Scripts\\python.exe -m compileall app`
- `POST http://127.0.0.1:18080/api/v1/plan/generate`
- `POST http://127.0.0.1:18080/api/v1/chat`
- 浏览器页 `http://127.0.0.1:18082/#/main/ai-demo` 已刷新并确认出现 `Learning Profile`、`Evaluation Report`、路径阶段卡
