# 首页与头部清洗摘要

## problem
- 首页和公共头部仍有大量乱码与旧文案残留。
- `a3-portal-web/src/api/class.js` 中存在已经损坏的字符串模板，后续刷新或重编译时有潜在风险。

## root cause
- 这些文件此前只完成了部分赛题化，仍混有原项目遗留源码。
- 公共区域和数据格式化工具没有做统一的最终清洗。

## changes
- 重写 `a3-portal-web/src/components/Header.vue`，统一品牌、分类、搜索、学习中心、采购清单、登录注册文案。
- 重写 `a3-portal-web/src/pages/main/index.vue`，统一首页轮播文案、兴趣弹窗文案和专题区标题。
- 重写 `a3-portal-web/src/api/class.js`，修复损坏的优惠券规则格式化逻辑，保留演示模式能力。

## verification
- 浏览器实测通过：
  - `#/main/index`
- 首页头部、搜索框、轮播文案已显示为中文赛题化内容。
- 全仓再次扫描未发现新的乱码关键词或 `天机/学堂/黑马/itheima/itcast` 残留命中。
