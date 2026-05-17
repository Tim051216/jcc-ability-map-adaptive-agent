# 学生端页面任务

## 当前口径

- 当前默认学生端前端：`a3-student-react-web`
- 默认本地端口：`3002`
- `a3-portal-web` 已降级为 legacy 目录，仅保留历史代码参考，不再作为默认任务承接目录

## 建议负责目录

- `a3-student-react-web/src/pages/Overview.tsx`
- `a3-student-react-web/src/pages/CapabilityModel.tsx`
- `a3-student-react-web/src/pages/LearningPath.tsx`
- `a3-student-react-web/src/pages/ResourceCenter.tsx`
- `a3-student-react-web/src/pages/Collection.tsx`
- `a3-student-react-web/src/pages/Evaluation.tsx`
- `a3-student-react-web/src/pages/StudyReport.tsx`
- `a3-student-react-web/src/pages/AITutor.tsx`
- `a3-student-react-web/src/components/*`

## 任务清单

1. 清理学生端残留英文、旧品牌和联调态文案，统一为 A3 成品口径。
2. 去掉默认写死的测试用户、课程和演示参数，改成真实上下文传递。
3. 统一页面的空态、加载态和失败态，避免接口异常时出现“像没数据”的静默降级。
4. 打通概览、学习画像、学习路径、资源中心、测评、学习报告、AI 助教之间的跳转关系。
5. 检查桌面端和移动端基础可用性，避免关键页面布局明显破坏。

## 验收标准

- 学生端核心页面都从 `a3-student-react-web` 提供
- 页面标题、按钮、入口说明口径一致
- 接口失败时能给出明确提示，不出现白屏或无提示空白块
- 主链路可以顺畅完成页面跳转和基本操作
