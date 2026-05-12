// Vite 开发配置
import { defineConfig, loadEnv } from "vite";
import vue from "@vitejs/plugin-vue";
import svgLoader from "vite-svg-loader";
import vueJsx from "@vitejs/plugin-vue-jsx";
import path from "path";

const CWD = process.cwd();

// 配置参考：https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, CWD, "");
  const apiProxyTarget = {
    // 避免直接使用 local 作为 mode，防止与 Vite 的 .env.local 规则冲突
    devlocal: env.VITE_LOCAL_GATEWAY_URL || "http://127.0.0.1:10010",
    development:
      env.VITE_DEVELOPMENT_PROXY_TARGET || "https://tjxt-admin-t.itheima.net",
    mock: env.VITE_MOCK_PROXY_TARGET || "https://tjxt-admin-t.itheima.net",
  };
  const aiResourceProxyTarget =
    env.VITE_LOCAL_AI_RESOURCE_URL || "http://127.0.0.1:18080";
  const imageAssetProxyTarget =
    env.VITE_IMAGE_ASSET_PROXY_TARGET || "https://tjxt-dev.itheima.net";
  const apiTarget = apiProxyTarget[mode] || apiProxyTarget.devlocal;
  const rewriteApiPath =
    mode === "devlocal"
      ? (proxyPath) => proxyPath.replace(/^\/api/, "")
      : (proxyPath) => proxyPath;
  return {
    base: "./",
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    plugins: [vue(), vueJsx(), svgLoader()],
    // server:{
    //   port: 8081
    // }
    server: {
      port: 18081,
      host: "0.0.0.0",
      // proxy: {
      //     '/img-tx': {
      //     target: 'http://wisehub-1312394356.cos.ap-shanghai.myqcloud.com',
      //     // rewrite: (path) => {
      //     //   return path.replace(/^\/img-tx/, '')
      //     // }
      //   },
      // },
      proxy: {
        "/api/resource": {
          target: mode === "devlocal" ? aiResourceProxyTarget : apiTarget,
          changeOrigin: true,
          ws: true,
          rewrite:
            mode === "devlocal"
              ? (proxyPath) => proxyPath.replace(/^\/api\/resource/, "/api/v1/resource")
              : (proxyPath) => proxyPath,
        },
        "/api": {
          target: apiTarget,
          changeOrigin: true,
          ws: true,
          rewrite: rewriteApiPath,
        },
        "/img-tx": {
          // 图片静态资源继续走历史联调地址，避免本地缺少素材时页面空白
          target: imageAssetProxyTarget,
          changeOrigin: true,
          // rewrite: (path) => {
          //   return path.replace(/^\/img-tx/, '')
          // }
        },
      },
    },
  };
});
