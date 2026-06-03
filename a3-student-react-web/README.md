# A3 学生端前端

`a3-student-react-web` 现已切换为 `bililearn.zip` 提供的前端版本，并保留仓库本地运行所需的最小外层配置。

## 本地运行

前置条件：`Node.js 18+`

1. 安装依赖：`npm install`
2. 按需配置环境变量：复制 `.env.example` 为 `.env.local`
3. 启动开发环境：`npm run dev`

默认开发地址：`http://localhost:3002`

## 环境变量

- `VITE_AI_BASE_URL`：后端接口基础地址，默认 `http://127.0.0.1:18080/api/v1`
- `VITE_ENABLE_OFFLINE_DEMO`：是否允许接口失败时回退到前端演示数据
- `GEMINI_API_KEY`：仅在本地调试仍使用 Gemini 能力时需要
