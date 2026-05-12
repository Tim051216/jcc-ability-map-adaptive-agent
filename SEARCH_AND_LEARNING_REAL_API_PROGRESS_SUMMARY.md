# 搜索与学习页真实接口推进总结

## 问题
- 搜索页分类筛选已生效，但高亮状态因 `id` 类型不一致没有同步。
- 学习页的问答、笔记、练习在 `a3local` 下仍依赖旧接口或 demo 数据，课程内页真实后端占比不够。

## 根因
- 搜索筛选组件里 `activeId` 是字符串，分类项 `item.id` 是数字，模板比较时没有统一类型。
- 课程内页缺少独立的 A3 学习接口层，前端只能继续走旧 `/ls`、`/es` 链路。

## 修改
- 修复搜索筛选高亮比较逻辑，统一按字符串比较。
- 新增 A3 学习接口：
  - 问答列表、创建、详情、编辑、删除
  - 回答列表、创建、点赞
  - 笔记列表、创建、编辑、删除、采集
  - 练习题生成、提交
- 前端在 `a3local` 下把以下模块切到新 A3 接口：
  - `classDetails.js` 的问答相关调用
  - `notes.js` 的笔记相关调用
  - `subject.js` 的练习相关调用
- 补了学习页笔记面板和问答详情页的未登录空值保护，避免 `userInfo` 为空时白屏。

## 验证
- 后端测试：
  - `python -m pytest app\tests\test_course_api.py app\tests\test_learning_demo_api.py`
- 前端构建：
  - `npm run build`
- 浏览器验收：
  - `#/search/index?type=categoryIdLv1&id=1` 分类高亮与结果一致
  - `#/learning/index?id=101` 问答页、笔记页已显示新后端返回的数据
  - `#/askDetails/index?id=3001&detailsId=101` 可正常展示问题详情与回答
