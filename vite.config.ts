import { defineConfig } from 'vite';
export default defineConfig({
  optimizeDeps: { entries: ['index.html'] },
  server: {
    host: '127.0.0.1',
    port: Number(process.env.DISASTERDAO_UI_PORT ?? 5173),
    watch: {
      ignored: [
        '**/.dependency-backups.noindex/**',
        '**/node_modules.stalled-*/**',
      ],
    },
    fs: {
      strict: true,
      deny: [
        '.env',
        '.env.*',
        '*.{crt,pem,key}',
        '**/.git/**',
        '**/.runtime/**',
        '**/server/**',
        '**/.aws/**',
        '**/.codex/**',
        '**/.agents/**',
        '**/.dependency-backups.noindex/**',
        '**/node_modules.stalled-*/**',
      ],
    },
    proxy: {
      '/api/v3': {
        target: `http://127.0.0.1:${process.env.DISASTERDAO_API_PORT ?? 3008}`,
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: '127.0.0.1',
    proxy: {
      '/api/v3': {
        target: `http://127.0.0.1:${process.env.DISASTERDAO_API_PORT ?? 3008}`,
        changeOrigin: true,
      },
    },
  },
});
