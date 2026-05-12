# 学生端 AI 闭环任务

## 负责人目标

把学生端和 AI 相关的四条核心能力链路接成可稳定演示的闭环：学习画像、资源生成、学习路径、学习测评。

## 建议负责目录

- `a3-portal-web/src/pages/learningProfile`
- `a3-portal-web/src/pages/resourceCenter`
- `a3-portal-web/src/pages/resourceFavorites`
- `a3-portal-web/src/pages/learningPath`
- `a3-portal-web/src/pages/learningReport`
- `a3-portal-web/src/pages/evaluation`
- `a3-portal-web/src/pages/wrongQuestion`
- `a3-portal-web/src/pages/intelligentTutor`
- `a3-portal-web/src/api/ai.js`

## 任务清单

1. 学习画像页补齐历史记录、版本变化、手动调整结果展示。
2. 资源中心补齐生成、预览、下载权限、收藏、归档、历史记录展示。
3. 学习路径页补齐打卡、暂停、继续、节点状态变化和进度回溯。
4. 测评页补齐在线作答、提交作答、错题查看、历史记录、趋势摘要、报告导出入口。
5. 智能辅导页补齐 OCR 提问、答疑历史、收藏、人工升级工单入口。
6. 明确哪些接口是真实后端返回，哪些仍是 fallback/demo 数据，并在页面层做好降级处理。

## 验收标准

- 四条核心 AI 页面都能独立演示
- 页面之间能互相跳转，形成讲解闭环
- 真实接口可用时优先走真实数据
- 接口不可用时不会白屏，并能给出明确提示

## 适合的成员类型

- 熟悉前后端联调
- 能快速判断 mock、fallback、真实接口边界
- 对答辩链路敏感，知道什么页面必须稳定
