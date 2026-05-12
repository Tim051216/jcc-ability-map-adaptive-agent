## problem

`a3-portal-web` 首页和分类区域仍残留可见乱码，影响赛题演示和页面验收。

## root cause

前台部分组件曾混入旧项目编码污染文本，首页轮播与分类悬浮区的少量文案没有跟随前面的赛题化清理一起更新。

## changes

- 清理首页入口区、展示横幅和兴趣弹窗中的中文文案
- 修正首页轮播右侧说明文案
- 修正课程分类悬浮层标题文案

## verification

- `npm run build` 通过
- 浏览器首页已确认 `bannerDesc`、`metricLabel`、`primaryAction` 等关键节点显示正常中文
