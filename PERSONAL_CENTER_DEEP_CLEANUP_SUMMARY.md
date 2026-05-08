# 个人中心深度清洗总结

## problem

- `a3-portal-web` 个人中心多处页面和子组件仍保留原项目乱码文案，进入订单、优惠券、积分、考试等页面时会出现半中文半乱码的展示。

## root cause

- 原始前端文件存在历史编码污染，多个 `.vue` 页面和组件直接保存了乱码字符串。
- 个人中心主页面虽然已部分清洗，但详情页和表格/卡片子组件仍沿用旧内容，导致页面链路不一致。

## changes

- 重写并中文化个人中心页面：
  - `a3-portal-web/src/pages/personal/myClass.vue`
  - `a3-portal-web/src/pages/personal/myOrder.vue`
  - `a3-portal-web/src/pages/personal/myIntegral.vue`
  - `a3-portal-web/src/pages/personal/myCoupon.vue`
  - `a3-portal-web/src/pages/personal/myCouponExplain.vue`
  - `a3-portal-web/src/pages/personal/myIntegralRanking.vue`
  - `a3-portal-web/src/pages/personal/myExam.vue`
  - `a3-portal-web/src/pages/personal/myOrderDetails.vue`
  - `a3-portal-web/src/pages/personal/myExamDetails.vue`
- 清洗个人中心相关子组件：
  - `a3-portal-web/src/pages/personal/components/ExamTable.vue`
  - `a3-portal-web/src/pages/personal/components/IntegralRankTab.vue`
  - `a3-portal-web/src/pages/personal/components/OrderCards.vue`
  - `a3-portal-web/src/components/CouponCards.vue`
- 统一订单状态、积分榜、优惠券规则、考试详情等页面文案为赛题中文展示。

## verification

- 在 `a3-portal-web` 目录执行 `npm run build`，构建通过。
- 浏览器实测 `http://127.0.0.1:18082/#/personal/main/myOrder`，页面已显示“我的订单”等中文内容。
