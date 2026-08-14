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
      // Serve ONLY the app itself and the canonical fixtures. Never the repo root:
      // reference/ and outputs/ must stay unreachable even if the dev server is
      // shared or tunneled (audit finding 9).
      strict: true,
      allow: ['.', '../data/sample'],
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
