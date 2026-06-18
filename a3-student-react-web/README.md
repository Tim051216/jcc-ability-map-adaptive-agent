# A3 学生端前端

`a3-student-react-web` 现已切换为 `bililearn.zip` 提供的前端版本，并保留仓库本地运行所需的最小外层配置。

## 本地运行

前置条件：`Node.js 18+`

1. 安装依赖：`npm install`
2. 按需配置环境变量：复制 `.env.example` 为 `.env.local`
3. 启动开发环境：`npm run dev`

默认开发地址：`http://localhost:3002`

## AI Tutor 验证

AI Tutor 的上传、截图和多格式正文提取现在都有独立 smoke 脚本，默认会连到 `http://127.0.0.1:3002`。

- 统一运行：`npm run smoke:ai-tutor`
- 仅测上传与正文交互：`npm run smoke:ai-tutor-upload`
- 仅测多格式正文提取：`npm run smoke:ai-tutor-multiformat`
- 仅测截图加入对话：`npm run smoke:ai-tutor-capture`

也可以临时覆盖环境地址和账号：

```bash
AI_TUTOR_BASE_URL=http://127.0.0.1:3002 \
AI_TUTOR_LOGIN_ID=demo2024 \
AI_TUTOR_LOGIN_PASSWORD=bililearn \
npm run smoke:ai-tutor
```

这几项验证主要覆盖：

- 上传图片和常见文档附件
- 附件正文提取与展示
- 复制正文、插入输入框、直接发送正文
- 页面截图加入 AI Tutor 会话

## 项目界面约定

- 项目主色系为粉色，界面优先使用 `#fb7299` 及其浅色延展，不要切回紫色或偏冷默认方案。
- 首页与学习路径优先采用“先设目标，再生成路径”的产品流程；如果用户已有历史目标记录，则按记录恢复并继续学习。

## 环境变量

- `VITE_AI_BASE_URL`：后端接口基础地址，默认 `http://127.0.0.1:18080/api/v1`
- `VITE_ENABLE_OFFLINE_DEMO`：是否允许接口失败时回退到前端演示数据
- `GEMINI_API_KEY`：仅在本地调试仍使用 Gemini 能力时需要
