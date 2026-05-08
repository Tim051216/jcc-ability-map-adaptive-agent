# Portal List/Search Branding Cleanup Summary

## Problem
- `a3-portal-web` 的头部、课程列表页、课程搜索页仍残留旧项目文案和明显乱码，影响赛题化展示。

## Root Cause
- 上游前端文件存在历史编码污染，且入口页组件一直没有完整重写，导致品牌文案、搜索提示和筛选文案仍沿用旧内容。

## Changes
- 重写 `a3-portal-web/src/components/Header.vue`，统一为 A3 中文品牌、中文搜索提示、中文登录/学习中心/采购清单文案。
- 重写 `a3-portal-web/src/pages/classList/index.vue`，完成课程列表页中文化和赛题化说明横幅。
- 重写 `a3-portal-web/src/pages/classSearch/index.vue` 及其 `SearchKey.vue`、`SortBar.vue`，统一搜索、筛选、分页、空状态文案。
- 在 `a3-portal-web/src/config/demo-learning.js` 增加演示数据字符串归一化逻辑，为后续继续清理演示课程文案做统一兜底。

## Verification
- 在 `F:\A3-cnsoftbei\a3-learning-agent-system\a3-portal-web` 执行 `npm run build` 通过。
- 使用关键字扫描 `src`，未再命中本轮关注的入口页乱码关键词。
