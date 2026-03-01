import { defineConfig } from '@playwright/test';

/**
 * Eden E2E Test Configuration
 *
 * - baseURL: http://localhost:3000 (CRA/craco default)
 * - Chromium only for speed
 * - 60s default timeout (lazy-loaded app can be slow on first load)
 * - Screenshots captured on failure
 * - Results output to e2e-results/
 * - webServer auto-starts `npm start` if nothing is already on port 3000
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 1 : undefined,
  timeout: 60_000,

  reporter: [
    ['html', { outputFolder: 'e2e-results' }],
    ['json', { outputFile: 'e2e-results/results.json' }],
    ['list'],
  ],

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },

  projects: [
    {
      name: 'Desktop Chrome',
      use: {
        browserName: 'chromium',
        viewport: { width: 1920, height: 1080 },
      },
    },
  ],

  webServer: {
    command: 'npm start',
    port: 3000,
    timeout: 120_000,
    reuseExistingServer: true,
  },
});
