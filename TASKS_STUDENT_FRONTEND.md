# 学生端页面任务

## 负责人目标

把学生端高曝光页面收成统一中文成品态，避免答辩时出现乱码、旧项目口径、空白块和明显演示痕迹。

## 建议负责目录

- `a3-portal-web/src/pages/main`
- `a3-portal-web/src/pages/classList`
- `a3-portal-web/src/pages/classDetails`
- `a3-portal-web/src/pages/classSearch`
- `a3-portal-web/src/pages/learning`
- `a3-portal-web/src/pages/ask`
- `a3-portal-web/src/pages/pay`
- `a3-portal-web/src/pages/result`

## 任务清单

1. 清理首页文案、入口文案、按钮文案，统一为 A3 赛题表达。
2. 清理课程列表、课程详情、搜索页中的乱码、旧项目标题和不一致提示语。
3. 清理学习页、问答页、支付页、结果页中的演示提示、错误提示和残留占位文案。
4. 检查页面空态、加载态、异常态，补齐兜底展示，避免白屏。
5. 统一导航返回关系，保证用户不会走进死路由或回不去首页。
6. 检查移动端和窄屏下的基础可用性，避免布局明显破坏。

## 验收标准

- 所有高频页面中文显示正常
- 页面标题、入口标题、按钮文案口径一致
- 无明显“天机学堂”或旧项目品牌残留
- 接口失败时页面仍能给出友好提示

## 适合的成员类型

- 熟悉 Vue 页面改造
- 擅长 UI 收口和文案统一
- 能快速做页面级联调验证
