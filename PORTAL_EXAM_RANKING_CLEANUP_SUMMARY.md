# Portal 考试与积分榜清洗总结

## Problem
- `我的考试`、`考试详情`、`学习积分榜` 相关页面和子组件仍残留乱码文案。
- 积分榜面包屑标题错误，显示成了与当前页面无关的旧文案。
- 考试列表跳转详情页的路径写法不统一，存在兼容风险。

## Root Cause
- 考试表格、积分榜表格、章节筛选条等组件仍沿用上游旧实现。
- 路由元信息没有跟随前端赛题化一起清洗。

## Changes
- 重写：
  - `a3-portal-web/src/components/AskChapterItems.vue`
  - `a3-portal-web/src/pages/personal/components/ExamTable.vue`
  - `a3-portal-web/src/pages/personal/components/IntegralRankTab.vue`
  - `a3-portal-web/src/pages/personal/myExam.vue`
  - `a3-portal-web/src/pages/personal/myIntegralRanking.vue`
  - `a3-portal-web/src/pages/classDetails/components/ClassAsk.vue`
  - `a3-portal-web/src/pages/classDetails/components/Note.vue`
  - `a3-portal-web/src/router/modules/base.js`
- 修正考试详情跳转路径为 `myExamDetails`
- 统一路由元信息与面包屑中文标题，例如：
  - `课程详情`
  - `考试详情`
  - `学习积分榜`

## Verification
- 浏览器实际验收通过：
  - `http://127.0.0.1:18082/#/personal/main/myExam`
  - `http://127.0.0.1:18082/#/personal/main/myIntegralRanking`
  - `http://127.0.0.1:18082/#/personal/main/myExamDetails?...`
- 已确认：
  - 我的考试页可正常显示表格与分页
  - 积分榜面包屑已恢复为 `我的积分 / 学习积分榜`
  - 考试详情页可以稳定打开并显示 A3 版本中文结构
