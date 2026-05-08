# Portal Category Fallback Fix Summary

## Problem
- 首页左侧课程分类仍显示脏数据和乱码，未稳定切换到 A3 中文分类。

## Root Cause
- 当前前端并不总处于 portal demo 登录态，分类接口仍可能走真实链路。
- 旧分类数据还会写入并复用 `pinia` 持久化缓存，导致页面继续读到异常分类名称。

## Changes
- 在 `a3-portal-web/src/api/class.js` 增加 `normalizeCategoryData()`，统一识别异常分类并回退到本地 `demoCategories`。
- 在 `a3local` 模式下让 `getClassCategorys()` 直接返回本地 A3 中文分类，避免首页分类依赖后端状态。
- 在首页、头部、搜索页读取和回写分类缓存时统一走净化逻辑，覆盖旧缓存残留。
- 重写 `a3-portal-web/src/pages/classSearch/index.vue`，同步清理搜索页的旧乱码文案和分类读取逻辑。

## Verification
- 在 `F:\A3-cnsoftbei\a3-learning-agent-system\a3-portal-web` 执行 `npm run build` 通过。
