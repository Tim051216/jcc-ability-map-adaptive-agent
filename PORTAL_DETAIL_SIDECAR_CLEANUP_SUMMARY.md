# Portal 详情页侧栏与边缘页清洗总结

## Problem
- 课程详情页侧栏组件源码仍残留大量乱码文本，后续维护风险高。
- 个人中心中的 `我的消息`、`我的收藏`、`考试详情` 仍保留上游占位页或旧文案，不适合作为 A3 演示版本交付。

## Root Cause
- `classDetails/components` 下的多个组件虽然部分页面可显示，但源码层仍未完成统一清洗。
- 部分个人中心边缘页长期处于“未完成模板页”状态，没有被赛题化处理。

## Changes
- 重写详情页相关组件：
  - `a3-portal-web/src/pages/classDetails/components/Ask.vue`
  - `a3-portal-web/src/pages/classDetails/components/ClassAbout.vue`
  - `a3-portal-web/src/pages/classDetails/components/ClassCatalogue.vue`
  - `a3-portal-web/src/pages/classDetails/components/LikeCards.vue`
- 重写个人中心边缘页：
  - `a3-portal-web/src/pages/personal/myMessage.vue`
  - `a3-portal-web/src/pages/personal/myCollect.vue`
  - `a3-portal-web/src/pages/personal/myExamDetails.vue`
- 统一替换为适合 A3 演示的中文说明和交互文案。

## Verification
- 浏览器实际验收通过：
  - `http://127.0.0.1:18082/#/details/index?id=101`
  - `http://127.0.0.1:18082/#/personal/main/myMessage`
  - `http://127.0.0.1:18082/#/personal/main/myCollect`
- 已确认：
  - 详情页可显示 `常见问题 / 猜你喜欢 / 课程目录` 等中文模块
  - `我的消息 / 我的收藏` 页面已变为 A3 版本的明确说明页
