import { defineConfig } from '@playwright/test';

/**
 * Eden E2E Test Configuration
 *
 * - baseURL: http://localhost:3000 (assumes frontend is already running)
 * - Chromium only for speed
 * - 30s default timeout
 * - Screenshots captured on failure
 * - Results output to e2e-results/
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  timeout: 30_000,

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
});
