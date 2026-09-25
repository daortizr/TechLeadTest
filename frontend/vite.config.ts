import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        // Point it at the backend's SERVER_PORT when it is not 3000: DEV_API_TARGET=http://localhost:3001
        target: process.env.DEV_API_TARGET ?? 'http://localhost:3000',
        changeOrigin: true
      }
    }
  },
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}']
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // shared is compiled to CommonJS for the backend; the bundler reads its ESM source instead
      '@flight-reservations/shared': path.resolve(__dirname, '../shared/src/index.ts')
    }
  }
});
