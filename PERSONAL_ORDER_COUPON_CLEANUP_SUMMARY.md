# 个人中心订单与优惠券清洗摘要

## problem
- 个人中心中的优惠券页、订单页、订单详情页和部分路由标题仍存在乱码与原项目残留。
- 订单详情与退款相关页面在演示模式下缺少本地数据支撑，容易因为真实接口不可用而打不开。

## root cause
- 这些页面没有完成统一的赛题化中文清洗。
- 演示模式只覆盖了订单列表和基础支付链路，没有补齐订单详情与退款详情。

## changes
- 重写 `a3-portal-web/src/pages/personal/myCoupon.vue`、`myCouponExplain.vue`、`myOrder.vue`、`myOrderDetails.vue`。
- 重写 `a3-portal-web/src/components/CouponCards.vue`，统一优惠券卡片文案。
- 重写 `a3-portal-web/src/router/modules/base.js`，清理全局路由 `meta` 中文标题。
- 更新 `a3-portal-web/src/api/order.js`，为订单详情、退款申请、退款详情增加演示模式分支。
- 在 `a3-portal-web/src/config/demo-learning.js` 追加订单详情和退款演示数据函数。

## verification
- 浏览器实测通过：
  - `#/personal/main/myCoupon`
  - `#/personal/main/myOrder`
  - `#/personal/main/myOrderDetails?id=5001001`
- 页面已能正常显示中文标题、订单状态、优惠券信息与订单详情流程。
