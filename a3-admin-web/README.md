<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# A3 管理端前端

`a3-admin-web` 是当前仓库默认的管理端前端，主要用于后台运营、审核、日志、配置和管理视角下的 AI 能力展示。

该目录最初由 AI Studio 应用模板演进而来，目前已作为本项目管理端前端使用。

AI Studio 原始应用地址：
https://ai.studio/apps/df268062-f468-43c4-a6ae-57bafb2cb730

## 本地运行

前置条件：`Node.js 18+`

1. 安装依赖：`npm install`
2. 如项目依赖 Gemini 能力，请在 `.env.local` 中配置 `GEMINI_API_KEY`
3. 启动开发环境：`npm run dev`

默认开发地址：`http://localhost:3004`

## 常用脚本

- `npm run dev`：启动本地开发服务
- `npm run build`：构建生产产物
- `npm run preview`：预览构建结果
- `npm run lint`：执行 TypeScript 类型检查
