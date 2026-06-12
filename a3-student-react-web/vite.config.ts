import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  const aiBaseUrl = env.VITE_AI_BASE_URL || "/ai/api/v1";
  const aiProxyTarget = (env.VITE_AI_PROXY_TARGET || "http://127.0.0.1:18080").replace(/\/$/, "");
  const useAiProxy = aiBaseUrl.startsWith("/ai/");
  const notificationProxyTarget = (env.VITE_NOTIFICATION_BASE_URL || "http://127.0.0.1:8085").replace(/\/$/, "");

  const proxy: Record<string, { target: string; changeOrigin: boolean; ws?: boolean; rewrite?: (path: string) => string }> = {
    '/sms': {
      target: notificationProxyTarget,
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/sms/, ""),
    },
  };

  if (useAiProxy) {
    proxy['/ai'] = {
      target: aiProxyTarget,
      changeOrigin: true,
      ws: true,
      rewrite: (path) => path.replace(/^\/ai/, ""),
    };
  }

  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      strictPort: true,
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      proxy,
    },
    preview: {
      strictPort: true,
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) {
              return;
            }
            if (id.includes('react-router')) {
              return 'router';
            }
            if (id.includes('motion') || id.includes('framer-motion')) {
              return 'motion';
            }
            if (id.includes('@google/genai')) {
              return 'genai';
            }
            if (id.includes('lucide-react')) {
              return 'icons';
            }
            return 'vendor';
          },
        },
      },
    },
  };
});
