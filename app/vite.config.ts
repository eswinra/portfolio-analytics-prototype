import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Relative base + hash routing: the built app works from any static subpath
// (GitHub Pages project site included) with no repo-name coupling and no 404 rewrite.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          charts: ['recharts'],
        },
      },
    },
  },
  server: {
    fs: {
      // allow importing the canonical fixture from ../data/sample via ?raw
      allow: ['..'],
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
