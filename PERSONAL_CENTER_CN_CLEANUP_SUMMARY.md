# 个人中心中文化清洗总结

## Problem
- `a3-portal-web` 个人中心多个页面仍保留上游项目的乱码、旧文案和未清洗的展示组件，导致验收时页面观感割裂，部分路由虽然能打开，但内容不适合直接演示。

## Root Cause
- `myClass`、`myOrder`、`myCoupon`、`mySet` 等页面长期沿用原项目文件，编码污染和旧文案没有彻底替换。
- 订单卡片、优惠券卡片、课程卡片、学习计划表格等子组件仍在直接渲染旧项目文本。

## Changes
- 重写个人中心页面：
  - `a3-portal-web/src/pages/personal/myClass.vue`
  - `a3-portal-web/src/pages/personal/myOrder.vue`
  - `a3-portal-web/src/pages/personal/myCoupon.vue`
  - `a3-portal-web/src/pages/personal/mySet.vue`
- 重写个人中心相关展示组件：
  - `a3-portal-web/src/pages/personal/components/ClassCards.vue`
  - `a3-portal-web/src/pages/personal/components/OrderCards.vue`
  - `a3-portal-web/src/pages/personal/components/PlanTable.vue`
  - `a3-portal-web/src/components/CouponCards.vue`
- 统一替换为中文标题、按钮、状态文案，并保留现有演示接口结构。

## Verification
- 浏览器实际验收通过：
  - `http://127.0.0.1:18082/#/personal/main/myClass`
  - `http://127.0.0.1:18082/#/personal/main/myCoupon`
  - `http://127.0.0.1:18082/#/personal/main/myOrder`
  - `http://127.0.0.1:18082/#/personal/main/mySet`
- 已确认上述页面可以渲染中文内容，不再是空白页或乱码页。
- 当前控制台仍有旧的 `Header beforeMount` / `AxiosError` 噪音，属于既有后端链路问题，不是本轮个人中心中文化改动引入。
