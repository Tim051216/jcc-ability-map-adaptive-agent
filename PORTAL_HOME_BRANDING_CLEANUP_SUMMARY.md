# Portal 首页赛题化清洗总结

## Problem
- 门户首页和头部区域仍残留通用课程平台口吻，栏目名、兴趣模块按钮和公共头部文案不够贴合 A3 赛题演示场景。
- `proxy.js` 里还保留了上游外部域名，`Header` 初始化逻辑也比较脆弱，容易让旧请求噪音继续出现。

## Root Cause
- 首页栏目、兴趣卡片和课程卡片长期沿用原模板组件，文案没有统一切换到 A3 赛题化表述。
- 头部组件同时承担登录态、分类、最近学习等初始化逻辑，异常兜底不足。

## Changes
- 重写头部与演示用户配置：
  - `a3-portal-web/src/components/Header.vue`
  - `a3-portal-web/src/config/demo-user.js`
  - `a3-portal-web/src/config/proxy.js`
- 重写首页公共展示组件：
  - `a3-portal-web/src/components/MainTitle.vue`
  - `a3-portal-web/src/components/ClassCards.vue`
  - `a3-portal-web/src/pages/main/components/Interest.vue`
  - `a3-portal-web/src/pages/main/components/OpenClass.vue`
- 将首页展示文案统一为 A3 风格，例如：
  - `调整方向`
  - `加入学习`
  - `导师`
  - `查看全部`
  - `赛题演示课程`
  - `项目实战专题`
  - `最新接入课程`
- 去掉 `proxy.js` 中硬编码的上游 `itheima` 域名，统一改为 `/api` 代理入口。

## Verification
- 浏览器实际验收通过：
  - `http://127.0.0.1:18082/#/main/index`
  - `http://127.0.0.1:18082/#/personal/main/mySet`
- 已确认首页能看到新的 A3 栏目标题和兴趣区文案：
  - `调整方向`
  - `赛题演示课程`
  - `项目实战专题`
  - `最新接入课程`
- 头部组件本轮未再观察到新的报错时间戳；控制台中可见的 `Header/AxiosError` 仍是更早之前留下的旧日志记录。
