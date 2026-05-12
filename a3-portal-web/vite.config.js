import { defineConfig, loadEnv } from "vite";
import vue from "@vitejs/plugin-vue";
import svgLoader from "vite-svg-loader";
import vueJsx from "@vitejs/plugin-vue-jsx";
import Components from "unplugin-vue-components/vite";
import { ElementPlusResolver } from "unplugin-vue-components/resolvers";
import path from "path";

const CWD = process.cwd();
const LOCAL_MODE = "a3local";
const LOCAL_API_TARGET = "http://127.0.0.1:8090";
const LOCAL_AI_TARGET = "http://127.0.0.1:18080";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, CWD, "");
  const apiTarget =
    env.VITE_API_PROXY_TARGET ||
    (mode === LOCAL_MODE ? LOCAL_API_TARGET : LOCAL_API_TARGET);
  const aiTarget = env.VITE_AI_PROXY_TARGET || (mode === LOCAL_MODE ? LOCAL_AI_TARGET : LOCAL_API_TARGET);
  const imageTarget = env.VITE_IMG_PROXY_TARGET || apiTarget;
  const mockTarget = env.VITE_MOCK_PROXY_TARGET || "http://127.0.0.1:8321/mock/3359";
  const rewriteApiPath =
    mode === LOCAL_MODE
      ? (proxyPath) => proxyPath.replace(/^\/api/, "")
      : (proxyPath) => proxyPath;

  return {
    base: "./",
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    plugins: [
      vue(),
      vueJsx(),
      svgLoader(),
      Components({
        resolvers: [ElementPlusResolver()],
      }),
    ],
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes("node_modules/vue") || id.includes("node_modules/pinia")) {
              return "vendor-vue";
            }
            if (id.includes("node_modules/element-plus")) {
              return "vendor-element";
            }
            if (id.includes("node_modules/@element-plus/icons-vue")) {
              return "vendor-element-icons";
            }
            if (
              id.includes("node_modules/axios") ||
              id.includes("node_modules/moment") ||
              id.includes("node_modules/nprogress") ||
              id.includes("node_modules/qrcode.vue")
            ) {
              return "vendor-utils";
            }
            if (id.includes("node_modules/swiper")) {
              return "vendor-swiper";
            }
            return undefined;
          },
        },
      },
    },
    server: {
      port: 18082,
      host: "0.0.0.0",
      proxy: {
        "/api": {
          target: apiTarget,
          changeOrigin: true,
          rewrite: rewriteApiPath,
        },
        "/aigw": {
          target: aiTarget,
          changeOrigin: true,
          rewrite: (proxyPath) =>
            mode === LOCAL_MODE ? proxyPath.replace(/^\/aigw/, "/api") : proxyPath.replace(/^\/aigw/, "/ai"),
          timeout: 120000,
          proxyTimeout: 120000,
        },
        "/img-tx": {
          target: imageTarget,
          changeOrigin: true,
        },
        "/mock/3359": {
          target: mockTarget,
          changeOrigin: true,
        },
      },
    },
  };
});
