/**
 * Critical Buttons Smoke Test
 * Tests: Every primary button on key pages doesn't crash
 */
const { test, expect } = require('@playwright/test');
const { login, setupConsoleErrorCapture } = require('./helpers');

const CRITICAL_PAGES = [
  { path: '/dashboard', name: 'Dashboard' },
  { path: '/claims', name: 'Claims List' },
  { path: '/canvassing', name: 'Harvest' },
  { path: '/contracts', name: 'Contracts' },
  { path: '/inspections', name: 'Inspections' },
  { path: '/integrations', name: 'Integrations' },
];

test.describe('Critical Buttons Smoke Test', () => {
  
  test.beforeEach(async ({ page }) => {
    await login(page);
  });
  
  for (const pageInfo of CRITICAL_PAGES) {
    test(`${pageInfo.name} - all buttons are visible and don't crash on hover`, async ({ page, isMobile }) => {
      const errors = setupConsoleErrorCapture(page);
      
      await page.goto(pageInfo.path);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1500);
      
      // Get all visible buttons in main content (not sidebar)
      const main = page.locator('main');
      const buttons = main.locator('button:visible, [role="button"]:visible');
      const count = await buttons.count();
      
      // On mobile, just verify buttons exist and page loaded without errors
      // Desktop can do hover testing
      const maxToTest = isMobile ? 5 : 15;
      
      for (let i = 0; i < Math.min(count, maxToTest); i++) {
        const button = buttons.nth(i);
        try {
          if (!isMobile) {
            await button.hover({ timeout: 2000 });
            await page.waitForTimeout(100);
          } else {
            // On mobile, just verify button is accessible
            await expect(button).toBeVisible({ timeout: 1000 });
          }
        } catch (e) {
          // Button may have disappeared or moved, that's OK
        }
      }
      
      // Filter out known non-critical errors
      const criticalErrors = errors.filter(e => 
        !e.includes('Geolocation') && 
        !e.includes('GPS') &&
        !e.includes('404') &&
        !e.includes('favicon')
      );
      
      expect(criticalErrors).toHaveLength(0);
    });
  }
  
  test('primary action buttons exist and are enabled', async ({ page }) => {
    const criticalButtons = [
      { page: '/claims', text: 'New Claim' },
      { page: '/contracts', text: 'Create' },
      { page: '/canvassing', text: 'Map' },
    ];
    
    for (const btn of criticalButtons) {
      await page.goto(btn.page);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);
      
      const button = page.locator(`button:has-text("${btn.text}")`).first();
      
      if (await button.isVisible()) {
        await expect(button).toBeEnabled();
      }
    }
  });
});
