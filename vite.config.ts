import { defineConfig } from 'vite';
export default defineConfig({
  optimizeDeps: { entries: ['index.html'] },
  server: {
    host: '127.0.0.1',
    watch: {
      ignored: ['**/.dependency-backups.noindex/**', '**/node_modules.stalled-*/**'],
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
