# 学习路径与学习日历主题统一修复总结

## problem
- 学习路径页和学习日历页会直接展示后端原始提示词、旧专题名和课程目录式标题，答辩观感不统一。

## root cause
- 页面直接消费 `latestPlan` / `planData` 原始字段，缺少前端展示归一化。
- 演示课程配置里的关键章节名仍保留旧主题。

## changes
- 在 `a3-portal-web/src/pages/learningPath/index.vue` 增加摘要、阶段、步骤、推送理由的展示归一化。
- 在 `a3-portal-web/src/pages/learningCalendar/index.vue` 增加日历标题与目标说明的归一化。
- 在 `a3-portal-web/src/config/demo-learning.js` 中将演示课程关键章节、最近学习节点和测评章节统一为“模型评估与过拟合”。

## verification
- 浏览器实测 `http://127.0.0.1:18082/#/main/ai-path`，确认不再出现“请解释过拟合，并给我一个学习计划...”原始提示词。
- 浏览器实测 `http://127.0.0.1:18082/#/main/ai-calendar`，确认 Day 1~Day 3 均展示为“模型评估与过拟合”主题链路。
- 额外发现 `src/components/Header.vue` 依赖的 `./ClassCategory.vue` 缺失，当前会阻塞整站 `npm run build`，与本次页面主题修复无直接关系。
