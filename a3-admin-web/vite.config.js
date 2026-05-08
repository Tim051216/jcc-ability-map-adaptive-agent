// 项目配置页面
import { defineConfig, loadEnv } from "vite";
import vue from "@vitejs/plugin-vue";
import svgLoader from "vite-svg-loader";
import vueJsx from "@vitejs/plugin-vue-jsx";
import path from "path";

const CWD = process.cwd();
const API_PROXY_TARGET = {
  local: "http://127.0.0.1:10010",
  development: "https://tjxt-admin-t.itheima.net",
  mock: "https://tjxt-admin-t.itheima.net",
};

// 配置参考 https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  loadEnv(mode, CWD);
  const apiTarget = API_PROXY_TARGET[mode] || API_PROXY_TARGET.local;
  const rewriteApiPath =
    mode === "local"
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
        "/api": {
          target: apiTarget,
          changeOrigin: true,
          rewrite: rewriteApiPath,
        },
        "/img-tx": {
          // 图片资源仍走上游公开静态地址，避免本地缺失素材导致页面空白
          target: "https://tjxt-dev.itheima.net",
          changeOrigin: true,
          // rewrite: (path) => {
          //   return path.replace(/^\/img-tx/, '')
          // }
        },
      },
    },
  };
});
