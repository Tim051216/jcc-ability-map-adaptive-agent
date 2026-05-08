# A3 学习平台管理端

## 简介

`a3-admin-web` 是当前仓库接入的管理后台前端，来源于开源教学演示项目的前端部分，已按软杯赛题场景改名并接入 A3 仓库。

## 技术栈

- Vue 3
- Vite 2
- Pinia
- Element Plus

## 启动方式

```bash
npm install

# 默认走本地网关 http://127.0.0.1:10010
npm run dev

# 明确指定本地联调
npm run dev:local

# 走上游公开测试环境，便于单独查看前端页面
npm run dev:upstream
```

## 构建命令

```bash
npm run build
npm run build:local
npm run build:upstream
```
