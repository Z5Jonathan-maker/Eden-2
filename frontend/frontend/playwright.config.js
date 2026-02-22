// @ts-check
const { defineConfig, devices } = require('@playwright/test');
const e2eBackendUrl = process.env.E2E_BACKEND_URL || process.env.REACT_APP_BACKEND_URL || 'https://eden-gsot.onrender.com';

/**
 * Eden E2E Test Configuration
 * Tests critical flows on small iPhone, large iPhone, and desktop viewports
 */
module.exports = defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { outputFolder: 'e2e-results' }],
    ['json', { outputFile: 'e2e-results/results.json' }],
    ['list']
  ],
  
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  /* Test across different viewport sizes - all using Chromium */
  projects: [
    {
      name: 'iPhone SE (small)',
      use: { 
        browserName: 'chromium',
        viewport: { width: 375, height: 667 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: 'iPhone 14 Pro Max (large)',
      use: { 
        browserName: 'chromium',
        viewport: { width: 430, height: 932 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: 'Desktop Chrome',
      use: { 
        browserName: 'chromium',
        viewport: { width: 1920, height: 1080 }
      },
    },
  ],

  /* Run local server before tests */
  webServer: {
    command: `cross-env REACT_APP_BACKEND_URL=${e2eBackendUrl} npm start`,
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 180000,
  },
});
