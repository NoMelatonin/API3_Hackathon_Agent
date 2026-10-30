import { defineConfig } from 'vite';
export default defineConfig({
  server: {
    host: '127.0.0.1',
    proxy: {
      '/api/v3': { target: 'http://127.0.0.1:3007', changeOrigin: true },
    },
  },
  preview: {
    host: '127.0.0.1',
    proxy: {
      '/api/v3': { target: 'http://127.0.0.1:3007', changeOrigin: true },
    },
  },
});
