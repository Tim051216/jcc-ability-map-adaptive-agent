## problem

`a3-portal-web` 课程列表页的 demo 课程卡片仍有旧项目痕迹，封面不适合卡片展示，部分导师名和课程文案出现乱码。

## root cause

课程推荐数据在本地演示模式下仍混有上游 demo 数据，且 `demo-learning.js` 是高风险编码文件，直接修改容易放大乱码问题。

## changes

- 重做课程列表页、标题组件、课程卡片组件的中文文案和展示样式
- 在 `class.js` 中为本地推荐课程增加 A3 赛题化覆盖，统一课程名、导师名和卡片封面
- 修正优惠券规则文案格式化函数

## verification

- `npm run build` 通过
- 浏览器页面 `#/classList/index` 已确认 4 张课程卡片标题、导师名、封面地址都切换为 A3 数据
