import fs from 'fs';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { visualizer } from 'rollup-plugin-visualizer';
import type { OutputBundle } from 'rollup';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  const shouldAnalyze = env.ANALYZE === 'true' || process.env.ANALYZE === 'true';
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
    // Keep the API proxy scoped to /ai/ so the legacy UI route
    // /ai-annotation-agent is served by the SPA instead of being proxied.
    proxy['/ai/'] = {
      target: aiProxyTarget,
      changeOrigin: true,
      ws: true,
      rewrite: (path) => path.replace(/^\/ai/, ""),
    };
  }

  return {
    plugins: [
      react(),
      tailwindcss(),
      shouldAnalyze
        ? {
            name: 'bundle-stats-export',
            generateBundle(_, bundle: OutputBundle) {
              const stats = Object.entries(bundle).flatMap(([fileName, item]) => {
                if (item.type !== 'chunk') return [];
                const chunk = item;
                const modules = Object.entries(chunk.modules || {})
                    .map(([id, mod]) => {
                      const moduleInfo = mod as { renderedLength?: number; originalLength?: number };
                      return {
                      id,
                      renderedLength: moduleInfo.renderedLength || 0,
                      originalLength: moduleInfo.originalLength || 0,
                      };
                    })
                    .sort((a, b) => b.renderedLength - a.renderedLength);

                return [{
                    fileName,
                    name: chunk.name,
                    isEntry: chunk.isEntry,
                    isDynamicEntry: chunk.isDynamicEntry,
                    imports: chunk.imports,
                    dynamicImports: chunk.dynamicImports,
                    moduleCount: modules.length,
                    modules,
                }];
              });

              const outputDir = path.resolve(__dirname, 'dist');
              fs.mkdirSync(outputDir, { recursive: true });
              fs.writeFileSync(path.join(outputDir, 'bundle-stats.json'), JSON.stringify(stats, null, 2));
            },
          }
        : null,
      shouldAnalyze
        ? visualizer({
            filename: path.resolve(__dirname, 'dist', 'stats.html'),
            gzipSize: true,
            brotliSize: true,
            template: 'treemap',
          })
        : null,
    ].filter(Boolean),
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
            if (id.includes('react-dom')) {
              return 'react-dom';
            }
            if (id.includes('/three/')) {
              return 'three-runtime';
            }
            if (id.includes('nprogress')) {
              return 'app-shell';
            }
            if (id.includes('/react/')) {
              return 'react-core';
            }
            if (id.includes('motion') || id.includes('framer-motion')) {
              return 'motion';
            }
            if (id.includes('@google/genai')) {
              return 'genai';
            }
            if (id.includes('lottie-web')) {
              return 'lottie';
            }
            if (id.includes('jsmind')) {
              return 'mindmap';
            }
            if (id.includes('zrender')) {
              return 'zrender';
            }
            if (id.includes('echarts/core') || id.includes('echarts/renderers')) {
              return 'echarts-runtime';
            }
            if (id.includes('/echarts/')) {
              return 'echarts-runtime';
            }
            if (id.includes('html2canvas')) {
              return 'capture';
            }
            if (id.includes('katex')) {
              return 'katex';
            }
            if (id.includes('react-markdown') || id.includes('remark-') || id.includes('rehype-')) {
              return 'markdown';
            }
            if (id.includes('gsap')) {
              return 'gsap';
            }
            if (
              id.includes('unified') ||
              id.includes('micromark') ||
              id.includes('mdast') ||
              id.includes('hast') ||
              id.includes('property-information') ||
              id.includes('vfile') ||
              id.includes('bail') ||
              id.includes('trough') ||
              id.includes('markdown-table') ||
              id.includes('inline-style-parser') ||
              id.includes('style-to-js') ||
              id.includes('style-to-object') ||
              id.includes('unist-util') ||
              id.includes('@ungap/structured-clone') ||
              id.includes('comma-separated-tokens') ||
              id.includes('space-separated-tokens') ||
              id.includes('decode-named-character-reference') ||
              id.includes('html-url-attributes') ||
              id.includes('longest-streak') ||
              id.includes('trim-lines') ||
              id.includes('ccount') ||
              id.includes('extend')
            ) {
              return 'markdown-runtime';
            }
            if (id.includes('lodash') || id.includes('dayjs') || id.includes('uuid')) {
              return 'utils';
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
