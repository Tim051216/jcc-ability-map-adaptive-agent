# 前端接入总结

## 问题

- 当前仓库原本只有后端与接口文档，没有接入可运行的前端工程。
- 上游前端目录、项目名称、页签标题、页脚文案和说明文档仍保留明显的原项目痕迹。
- 前端默认直连上游接口，浏览器运行时容易受到跨域、无效开发地址或网关未启动影响。

## 根因

- 仓库最初是从开源项目二次整理而来，`tj-admin`、`tj-portal` 没有一起迁入。
- 上游前端把环境配置、文案和品牌信息写死在多个文件中。
- 原始请求逻辑对网络异常处理较弱，接口不可达时会继续触发前端报错。

## 修改

- 新增 `a3-admin-web` 与 `a3-portal-web` 两个前端工程到当前仓库。
- 将两个前端的项目名、浏览器标题、页脚文案、README 与图标元数据改为 A3 赛题化命名。
- 为两个前端补充 `dev`、`dev:local`、`dev:upstream`、`build:local`、`build:upstream` 脚本。
- 调整前端接口配置，默认通过 Vite 本地代理访问接口，避免浏览器跨域。
- 修复请求异常处理，接口不可达时不再因为读取 `err.response.status` 二次报错。
- 为 portal 用户端补充本地演示登录兜底，并将头部、底部 Logo 改为 A3 文字版。
- 在 `LOCAL_SETUP.md` 中补充前端启动与联调说明。

## 验证

- `npm install` in `a3-admin-web`
- `npm install` in `a3-portal-web`
- `npm run dev:upstream` in `a3-admin-web`
- `npm run dev:upstream` in `a3-portal-web`
- 本地页面端口已启动：`http://127.0.0.1:18081`、`http://127.0.0.1:18082`

## 当前限制

- `npm run dev` 仍依赖本地网关 `http://127.0.0.1:10010` 和后端微服务联调环境。
- `npm run dev:upstream` 依赖当前网络能访问上游公开测试接口；若外网受限，页面只能先展示前端框架与静态资源。
