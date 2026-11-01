import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import { fileURLToPath, URL } from 'url';

// https://vite.dev/config/
export default defineConfig({

  plugins: [
    react(),
    tsconfigPaths(),
    {
      name: 'runtime-api-config',
      apply: 'build',
      transformIndexHtml() {
        return [
          {
            tag: 'script',
            attrs: { src: '/config.js' },
            injectTo: 'head-prepend',
          },
        ];
      },
    },
  ],

  resolve: {
    alias: {
      '@': fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  
  server: {
    watch: {
      usePolling: true,
    },
  },
})
