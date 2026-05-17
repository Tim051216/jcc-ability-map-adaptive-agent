import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
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
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes("node_modules")) {
              return undefined;
            }
            if (id.includes("/node_modules/react-router-dom/") || id.includes("/node_modules/react-router/")) {
              return "router";
            }
            if (
              id.includes("/node_modules/react/") ||
              id.includes("/node_modules/react-dom/") ||
              id.includes("/node_modules/scheduler/")
            ) {
              return "react-vendor";
            }
            if (
              id.includes("/node_modules/d3-") ||
              id.includes("/node_modules/internmap/") ||
              id.includes("/node_modules/delaunator/") ||
              id.includes("/node_modules/robust-predicates/")
            ) {
              return "d3-vendor";
            }
            if (
              id.includes("/node_modules/@reduxjs/toolkit/") ||
              id.includes("/node_modules/react-redux/") ||
              id.includes("/node_modules/redux/") ||
              id.includes("/node_modules/redux-thunk/") ||
              id.includes("/node_modules/immer/") ||
              id.includes("/node_modules/reselect/") ||
              id.includes("/node_modules/use-sync-external-store/") ||
              id.includes("/node_modules/tiny-invariant/") ||
              id.includes("/node_modules/decimal.js-light/") ||
              id.includes("/node_modules/eventemitter3/") ||
              id.includes("/node_modules/victory-vendor/") ||
              id.includes("/node_modules/react-is/")
            ) {
              return "charts-support";
            }
            if (id.includes("/node_modules/recharts/")) {
              return "charts";
            }
            if (
              id.includes("/node_modules/motion/") ||
              id.includes("/node_modules/framer-motion/") ||
              id.includes("/node_modules/motion-dom/") ||
              id.includes("/node_modules/motion-utils/")
            ) {
              return "motion-vendor";
            }
            if (id.includes("/node_modules/lucide-react/")) {
              return "icons-vendor";
            }
            if (id.includes("/node_modules/clsx/") || id.includes("/node_modules/tailwind-merge/")) {
              return "utils-vendor";
            }
            return "vendor";
          },
        },
      },
    },
    server: {
      // Allow the local dev environment to disable HMR during automated edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
