# Portal 演示主链路修复总结

## Problem
- `a3-portal-web` 的首页之后主链路还依赖真实后端，导致搜索、课程详情、学习页在本地演示时容易空白、报错或无法继续验收。
- 学习页目录组件本身还存在循环变量错误，即使接口可用也可能把页面逻辑跑坏。

## Root Cause
- 搜索、详情、学习、练习、问答、笔记等接口缺少统一的演示模式兜底。
- 学习页默认强依赖外部视频签名与播放器初始化，不适合当前本地验收场景。
- 目录组件存在旧代码 bug，导致“自动下一节”和目录高亮逻辑不稳定。

## Changes
- 在 `a3-portal-web/src/config/demo-learning.js` 新增完整演示课程数据，覆盖：
  - 搜索结果
  - 课程详情
  - 教师信息
  - 课程目录
  - 学习记录
  - 练习题
  - 问答
  - 笔记
- 在以下 API 文件接入演示模式兜底：
  - `a3-portal-web/src/api/class.js`
  - `a3-portal-web/src/api/classDetails.js`
  - `a3-portal-web/src/api/subject.js`
  - `a3-portal-web/src/api/notes.js`
  - `a3-portal-web/src/api/order.js`
- 重写 `a3-portal-web/src/pages/learning/index.vue`：
  - 演示模式下不再强依赖真实视频签名
  - 保留目录、练习、问答、笔记验收能力
  - 非演示模式下继续兼容原播放器逻辑
- 修复 `a3-portal-web/src/pages/learning/components/Catalogue.vue` 的目录遍历和下一节逻辑错误。

## Verification
- 浏览器验收通过：
  - `http://127.0.0.1:18082/#/search/index`
  - `http://127.0.0.1:18082/#/details/index?id=101`
  - `http://127.0.0.1:18082/#/learning/index?id=101`
- 已确认页面可展示 A3 演示课程内容，学习页可进入演示模式并继续验收目录与练习链路。
- 额外发现：
  - `a3-portal-web` 当前 `vite build --mode local` 会被新版 Vite 拒绝，这是原有构建脚本问题，不影响开发态验收。
