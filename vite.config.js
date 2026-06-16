import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Single source of truth for the displayed app version.
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url)));

// Dev server proxies /api to the local drill-api (port 4252) so cookies and the
// OAuth flow behave like production (same origin).
export default defineConfig({
  plugins: [react()],
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  server: {
    port: 5180,
    proxy: {
      '/api': { target: 'http://127.0.0.1:4252', changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          charts: ['recharts'],
        },
      },
    },
  },
});
