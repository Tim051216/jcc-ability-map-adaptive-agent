# Portal Build Proxy Fix Summary

## problem
- `a3-portal-web` 的本地构建模式使用了 `local`，和 Vite 对 `.local` 环境文件的约定冲突，导致模式和代理行为不稳定。
- 前端代理里仍残留上游项目地址，不利于赛题化和本地可复现。
- 入口使用 `app.use(ElementPlus)` 整库注册，打包后 `vendor-element` 过大并触发 chunk warning。
- 接入按需加载后，`unplugin-auto-import` 在当前 `Vite 2.9.15` 的开发态触发 `plugin.transform.call is not a function`，导致 `18082` 页面黑屏。
- 首页头部仍残留部分乱码文案，且在后端未启动时需要更稳的兜底。

## root cause
- 构建脚本、代理目标和本地演示环境没有完全从原项目上下文中剥离。
- `Element Plus` 采用整库挂载方式，导致未使用组件也被打进主依赖包。
- `unplugin-auto-import` 即使降级后，在该项目当前 `Vite 2` 开发链路里仍不稳定，但项目其实并不依赖它来自动导入 JS API。
- 头部组件历史上混入了原项目残留文案和编码异常内容。

## changes
- 将前端本地模式统一改为 `a3local`，同步更新 `dev/build` 脚本。
- 重构 `vite.config.js`：
  - 代理目标优先读取 `VITE_API_PROXY_TARGET`、`VITE_IMG_PROXY_TARGET`、`VITE_MOCK_PROXY_TARGET`
  - 本地默认回落到 `127.0.0.1` 的可演示服务地址
  - 移除源码中的上游品牌域名
  - 增加 `manualChunks`，拆分 `vue`、`element`、`icons`、`utils`、`swiper`
- 将 `Element Plus` 改为按需加载：
  - 删除 `src/main.js` 中的整库 `app.use(ElementPlus)`
  - 接入 `unplugin-vue-components@0.25.2`
  - 保留 `App.vue` 中文 locale 配置
- 去掉 `unplugin-auto-import`，只保留组件级按需解析，兼顾 `build` 和 `dev`
- 重写 `src/components/Header.vue`，完成首页头部中文化、赛题化和失败兜底清洗

## verification
- 在 `F:\A3-cnsoftbei\a3-learning-agent-system\a3-portal-web` 执行 `npm run build` 通过。
- 重新构建后不再出现 `vendor-element` 超过 500 KiB 的 chunk warning。
- 重启 `npm run dev` 后，`http://127.0.0.1:18082/#/main/index` 可正常打开。
- in-app browser 验证首页恢复显示，最近控制台 `error/warn` 日志为空。
