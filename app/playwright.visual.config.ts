import { defineConfig, devices } from '@playwright/test';

/** Visual-regression project (local QA). Separate from the smoke config so the default
 *  `npx playwright test` never depends on platform-specific baselines; snapshots live under
 *  outputs/visual-snapshots (ignored). Build first: `npm run build`. */
export default defineConfig({
  testDir: './e2e',
  testMatch: /visual\.spec\.ts/,
  timeout: 60_000,
  reporter: [['list']],
  snapshotPathTemplate: '../outputs/visual-snapshots/{projectName}/{arg}{ext}',
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
    },
  ],
  webServer: {
    command: 'npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
