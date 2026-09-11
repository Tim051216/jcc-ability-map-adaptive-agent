# BiliLearn Student Web

`a3-student-react-web` 是当前默认学生端前端，聚合了学习画像、学习路径、资源中心、AI 导师、互动课堂、学习报告、测评与消息中心等核心页面。

默认本地开发端口：`3002`

## Current Pages

当前学生端已覆盖的主要页面：

- `/`
  首页总览、目标恢复、学习闭环入口
- `/profile`
  学习画像、能力图谱、画像解读
- `/path`
  个性化学习路径与阶段任务
- `/resources`
  课程资源中心、课程工作台、补充资源生成
- `/resources/preview`
  资源预览、文档问答、代码实操、生成内容查看
- `/learn`
  视频学习页、互动课堂、生成按钮与学习助手
- `/tutor`
  AI 导师、截图/附件/追问答疑
- `/report`
  学习报告、答疑证据、资源偏好、学习反馈
- `/evaluation`
  测评入口与结果查看
- `/im`
  消息中心、收件箱、学习提醒

## Local Run

前置条件：

- Node.js 18+

启动方式：

```bash
npm install
npm run dev
```

默认访问地址：

- [http://localhost:3002](http://localhost:3002)

## AI 数据标注实训智能体（竞赛 MVP）

人工智能专业版微任务页面：服务 AI 数据标注工程师岗位，训练遮挡、截断和同类目标实例判定。

- 直接访问：[http://localhost:3002/annotation-agent](http://localhost:3002/annotation-agent)
- 兼容地址：[http://localhost:3002/ai-annotation-agent](http://localhost:3002/ai-annotation-agent)
- 试用口令：`这张图里的人被车挡住了，框怎么画？`、`同类目标挨在一起，应该标几个框？`
- 反馈入口：页面右侧“提交试用反馈”，支持实用性/易用性/准确性评分与 CSV 导出。

`/robot-ops-agent` 为早期工业机器人版本，保留用于兼容演示，不作为当前人工智能专业竞赛主版本。

## Build

```bash
npm run build
```

类型检查：

```bash
npm run lint
```

## Environment Variables

- `VITE_AI_BASE_URL`
  AI 后端地址，默认 `http://127.0.0.1:18080/api/v1`
- `VITE_ENABLE_OFFLINE_DEMO`
  是否允许接口失败时回退到前端演示数据
- `GEMINI_API_KEY`
  仅在本地仍保留 Gemini 调试能力时使用

## Smoke Scripts

当前已经补了多组 smoke 脚本，用于验证关键闭环页面：

- `npm run smoke:ai-tutor`
  AI 导师总体验证
- `npm run smoke:ai-tutor-upload`
  附件上传与正文提取
- `npm run smoke:ai-tutor-multiformat`
  多格式文档理解
- `npm run smoke:ai-tutor-capture`
  截图加入 AI 对话
- `npm run smoke:personalized-learning`
  画像/路径/报告闭环
- `npm run smoke:resource-center`
  资源中心主链路
- `npm run smoke:resource-preview`
  资源预览页主链路
- `npm run smoke:im-realtime`
  消息中心与实时交互
- `npm run smoke:defense-core`
  演示核心链路组合验证

## Product Notes

- 主视觉延续 `BiliLearn` 粉蓝体系，避免切回默认紫色或泛用企业后台风格
- 首页和路径页默认遵循“先设目标，再生成路径；若已有历史目标则自动恢复”的流程
- AI 导师优先强调课程上下文、附件理解、截图理解与连续追问，而不只是普通聊天框
- 资源中心强调“已有课程资料 + 智能体一键补齐”双入口

## Related Files

- [package.json](./package.json)
  前端脚本与依赖
- [DESIGN.md](./DESIGN.md)
  当前前端设计方向与约定
- [src/lib/studentApi.ts](./src/lib/studentApi.ts)
  学生端 API 封装
