# 学生端 AI 闭环任务

## 当前口径

- 当前默认学生端前端：`a3-student-react-web`
- 默认本地端口：`3002`
- `a3-portal-web` 已降级为 legacy 目录，仅保留历史代码参考，不再作为默认 AI 闭环任务承接目录

## 建议负责目录

- `a3-student-react-web/src/pages/CapabilityModel.tsx`
- `a3-student-react-web/src/pages/ResourceCenter.tsx`
- `a3-student-react-web/src/pages/Collection.tsx`
- `a3-student-react-web/src/pages/LearningPath.tsx`
- `a3-student-react-web/src/pages/StudyReport.tsx`
- `a3-student-react-web/src/pages/Evaluation.tsx`
- `a3-student-react-web/src/pages/AITutor.tsx`
- `a3-student-react-web/src/lib/studentApi.ts`

## 任务清单

1. 学习画像页补齐真实数据来源、失败提示和版本说明。
2. 资源中心补齐生成、刷新、收藏、筛选和结果预览闭环。
3. 学习路径页补齐生成、刷新、步骤完成和进度回写闭环。
4. 测评页补齐出题、历史、趋势、错题查看和报告联动。
5. AI 助教页补齐提问、引用、历史、异常态和人工升级入口。
6. 明确哪些数据来自真实接口，哪些仍是 fallback，并在界面上给出稳定降级体验。

## 验收标准

- 学习画像、资源、路径、测评、助教五条链路都能独立演示
- 页面之间能够互相跳转，形成完整学习闭环
- 真实接口可用时优先使用真实数据
- 接口不可用时不会白屏，并能给出明确提示
