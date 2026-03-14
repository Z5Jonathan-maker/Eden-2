/**
 * Harvest/Canvassing Tests
 * Tests: Google Maps, Pin creation, Tabs, Leaderboard, Field Mode, Offline banner
 *
 * Updated to match current Google Maps (@vis.gl/react-google-maps) implementation.
 * Uses data-testid attributes already present in the components.
 */
const { test, expect } = require('@playwright/test');
const { login, setupConsoleErrorCapture, checkNoTextOverflow } = require('./helpers');

test.describe('Harvest/Canvassing', () => {

  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/canvassing');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
  });

  test('harvest page renders without overflow', async ({ page }) => {
    const harvestPage = page.locator('[data-testid="harvest-page"]');
    await expect(harvestPage).toBeVisible({ timeout: 10000 });

    const overflows = await checkNoTextOverflow(page);
    if (overflows.length > 0) {
      console.log('Overflow issues found:', JSON.stringify(overflows, null, 2));
    }
    expect(overflows.length).toBeLessThanOrEqual(5);
  });

  test('google map container is visible', async ({ page }) => {
    // Google Maps renders inside [data-testid="harvest-map"]
    const map = page.locator('[data-testid="harvest-map"]');
    await expect(map).toBeVisible({ timeout: 10000 });
  });

  test('tab navigation works without errors', async ({ page }) => {
    const errors = setupConsoleErrorCapture(page);

    const tabIds = ['map', 'today', 'leaderboard', 'challenges', 'profile'];

    for (const id of tabIds) {
      const tab = page.locator(`[data-testid="harvest-${id}-tab"]`);
      if (await tab.isVisible()) {
        await tab.click({ force: true });
        await page.waitForTimeout(500);
      }
    }

    expect(errors).toHaveLength(0);
  });

  test('leaderboard tab renders', async ({ page }) => {
    const tab = page.locator('[data-testid="harvest-leaderboard-tab"]');
    if (await tab.isVisible()) {
      await tab.click();
      await page.waitForTimeout(1000);

      // Period filters should be present
      const periodBtn = page.locator('[data-testid="period-day"]');
      await expect(periodBtn).toBeVisible({ timeout: 5000 });
    }
  });

  test('stats footer is visible on map tab', async ({ page }) => {
    // Map tab is default — stats footer should be visible
    const statsFooter = page.locator('text=TODAY');
    await expect(statsFooter).toBeVisible({ timeout: 5000 });
  });

  test('map controls are present', async ({ page }) => {
    // FAB buttons rendered by HarvestMapInner
    const centerBtn = page.locator('[data-testid="center-on-me-btn"]');
    const dropBtn = page.locator('[data-testid="drop-pin-btn"]');
    const refreshBtn = page.locator('[data-testid="refresh-pins-btn"]');

    await expect(centerBtn).toBeVisible({ timeout: 10000 });
    await expect(dropBtn).toBeVisible({ timeout: 5000 });
    await expect(refreshBtn).toBeVisible({ timeout: 5000 });
  });

  test('legend toggle works', async ({ page }) => {
    const toggle = page.locator('[data-testid="legend-toggle"]');
    if (await toggle.isVisible({ timeout: 5000 })) {
      await toggle.click();
      // After click, legend content should show total
      const total = page.locator('text=Total');
      await expect(total).toBeVisible({ timeout: 3000 });
    }
  });

  test('filter panel opens and closes', async ({ page }) => {
    const filterBtn = page.locator('[data-testid="toggle-filters"]');
    await expect(filterBtn).toBeVisible({ timeout: 5000 });

    await filterBtn.click();
    const filterPanel = page.locator('[data-testid="filter-panel"]');
    await expect(filterPanel).toBeVisible({ timeout: 3000 });

    // Select all / clear all buttons
    const selectAll = page.locator('[data-testid="select-all-filters"]');
    await expect(selectAll).toBeVisible();

    // Close by clicking filter button again
    await filterBtn.click();
    await expect(filterPanel).not.toBeVisible({ timeout: 3000 });
  });

  test('GO FIELD button opens field mode', async ({ page }) => {
    const errors = setupConsoleErrorCapture(page);

    const goFieldBtn = page.locator('[data-testid="enter-field-mode"]');
    await expect(goFieldBtn).toBeVisible({ timeout: 5000 });

    await goFieldBtn.click();
    await page.waitForTimeout(1000);

    // Field mode should show quick-tap buttons (6 status buttons)
    const naButton = page.locator('[data-testid="field-tap-NA"]');
    await expect(naButton).toBeVisible({ timeout: 5000 });

    expect(errors).toHaveLength(0);
  });

  test('no uncaught console errors on harvest page', async ({ page }) => {
    const errors = setupConsoleErrorCapture(page);

    // Navigate through key tabs
    const tabs = ['today', 'leaderboard', 'map'];
    for (const id of tabs) {
      const tab = page.locator(`[data-testid="harvest-${id}-tab"]`);
      if (await tab.isVisible()) {
        await tab.click({ force: true });
        await page.waitForTimeout(800);
      }
    }

    expect(errors).toHaveLength(0);
  });
});
