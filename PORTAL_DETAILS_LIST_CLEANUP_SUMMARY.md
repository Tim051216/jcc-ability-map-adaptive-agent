# Portal 详情页与列表页清洗总结

## Problem
- 课程详情页仍残留大量旧编码文本和原课程平台措辞，不适合直接用于 A3 赛题演示。
- `classList` 页面虽然有文件，但路由未挂载，访问时会直接落到 `404`。

## Root Cause
- `a3-portal-web/src/pages/classDetails/index.vue` 和 `a3-portal-web/src/pages/classList/index.vue` 长期沿用上游实现，页面文案和交互说明没有完成赛题化。
- `src/router/modules/base.js` 中缺少 `classList` 路由入口。

## Changes
- 重写：
  - `a3-portal-web/src/pages/classDetails/index.vue`
  - `a3-portal-web/src/pages/classList/index.vue`
- 补充课程展示页路由：
  - `a3-portal-web/src/router/modules/base.js`
- 将详情页核心文案统一为 A3 风格，例如：
  - `课程节数`
  - `有效期`
  - `收藏课程`
  - `分享介绍`
  - `加入学习`
  - `进入学习`
- 将课程展示页统一为 A3 课程展示入口，不再保留旧页面的模板式口吻。

## Verification
- 浏览器实际验收通过：
  - `http://127.0.0.1:18082/#/details/index?id=101`
  - `http://127.0.0.1:18082/#/classList/index`
- 已确认：
  - 详情页可以显示 A3 中文介绍、问答和推荐内容
  - 课程展示页已从 `404` 恢复为正常页面
