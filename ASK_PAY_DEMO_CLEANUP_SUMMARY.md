# 问答详情与支付链路清洗摘要

## problem
- 问答详情页仍保留原项目旧实现，文案乱码、交互混乱，且依赖真实接口导致演示不稳定。
- 支付链路中的购物车、结算、支付、成功页仍是旧商城语义，缺少本地演示数据兜底。

## root cause
- 前端关键页面没有完成赛题化和去原项目化清洗。
- 问答与支付相关接口在演示模式下没有成体系的本地数据支撑。

## changes
- 重写 `a3-portal-web/src/pages/ask/askDetails.vue`，统一为中文问答详情、回答、回复、点赞与弹窗查看体验。
- 重写 `a3-portal-web/src/pages/pay/carts.vue`、`settlement.vue`、`payment.vue`、`success.vue`、`components/Countdown.vue`，改成 A3 赛题演示语境。
- 清洗 `a3-portal-web/src/pages/ask/components/ReplayForm.vue` 与 `src/pages/pay/components/ReplayForm.vue` 的中文文案。
- 为 `a3-portal-web/src/api/classDetails.js`、`src/api/order.js` 增加演示模式分支。
- 在 `a3-portal-web/src/config/demo-learning.js` 补充问答详情、回答回复、购物车、结算、支付方式、支付状态等本地演示数据。

## verification
- 浏览器实测通过：
  - `#/askDetails/index?id=11001&detailsId=101...`
  - `#/pay/carts`
  - `#/pay/settlement?courseIds=102,201`
  - `#/pay/payment?orderId=A3PDEMO001&payAmount=298.00`
  - 支付页点击“微信支付”后可弹出二维码，并可继续进入 `#/pay/success`
- `npm run build` 未通过，但失败原因是项目原有 `vite build --mode local` 脚本与 Vite 的 `local` mode 命名冲突，不是本轮页面改动引入。
