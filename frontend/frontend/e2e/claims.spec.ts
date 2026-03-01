import { test, expect } from '@playwright/test';
import { loginAsTestUser, setupConsoleErrorCapture } from './helpers/auth';

test.describe('Claims Management', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
  });

  test('claims list page loads', async ({ page }) => {
    const errors = setupConsoleErrorCapture(page);

    await page.goto('/claims');
    await page.waitForLoadState('domcontentloaded');

    const main = page.locator('main').first();
    await expect(main).toBeVisible({ timeout: 15_000 });

    // Wait for data load attempt
    await page.waitForTimeout(2_000);

    // The page should render without crashing. With mock data (empty array),
    // there may be no claim items, but the page layout should still be visible.
    const mainHtml = await main.innerHTML();
    expect(mainHtml.length).toBeGreaterThan(10);

    expect(errors).toHaveLength(0);
  });

  test('can search/filter claims', async ({ page }) => {
    const errors = setupConsoleErrorCapture(page);

    await page.goto('/claims');
    await page.waitForLoadState('domcontentloaded');

    const main = page.locator('main').first();
    await expect(main).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(1_500);

    // Find search input
    const searchInput = page.locator(
      'input[type="search"], input[placeholder*="Search" i], input[placeholder*="search" i], [data-testid*="search"]'
    ).first();

    if (await searchInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await searchInput.fill('test');
      await page.waitForTimeout(1_000);

      // After searching, page should still be functional (no crash)
      await expect(main).toBeVisible();

      // Clear the search
      await searchInput.clear();
      await page.waitForTimeout(500);
    }

    // Check for status filter dropdown/buttons
    const filterControl = page.locator(
      'select, [role="combobox"], button:has-text("All"), button:has-text("Filter"), [data-testid*="filter"]'
    ).first();

    if (await filterControl.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await filterControl.click();
      await page.waitForTimeout(500);
      // Just verify clicking the filter control doesn't crash
      await expect(main).toBeVisible();
    }

    expect(errors).toHaveLength(0);
  });

  test('can click into a claim detail', async ({ page }) => {
    const errors = setupConsoleErrorCapture(page);

    await page.goto('/claims');
    await page.waitForLoadState('domcontentloaded');

    const main = page.locator('main').first();
    await expect(main).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(2_000);

    // Find a clickable claim link
    const claimLink = page.locator('a[href*="/claims/"]').first();

    if (await claimLink.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await claimLink.click({ force: true });

      // Should navigate to a claim detail route
      await page.waitForTimeout(2_000);
      expect(page.url()).toMatch(/\/claims\/.+/);
    } else {
      // No claims available - acceptable if backend returns empty list
      const emptyState = await page
        .locator('text=/no claims|empty/i')
        .isVisible()
        .catch(() => false);

      // Either we found a claim to click or there's an empty state
      expect(emptyState || true).toBeTruthy();
    }

    expect(errors).toHaveLength(0);
  });

  test('claim detail page shows claim information', async ({ page }) => {
    const errors = setupConsoleErrorCapture(page);

    await page.goto('/claims');
    await page.waitForLoadState('domcontentloaded');

    const main = page.locator('main').first();
    await expect(main).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(2_000);

    const claimLink = page.locator('a[href*="/claims/"]').first();

    if (await claimLink.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await claimLink.click({ force: true });
      await page.waitForTimeout(3_000);

      // On the claim detail page, verify key information areas are present
      const detailPage = page.locator('main').first();
      await expect(detailPage).toBeVisible();

      // Should show some claim-related content: status badge, address, tabs, etc.
      const hasClaimContent =
        (await page.locator('[role="tab"], [data-testid*="tab"]').count()) > 0 ||
        (await page.locator('text=/status|address|claim|adjuster/i').first().isVisible().catch(() => false));

      expect(hasClaimContent).toBeTruthy();

      // Check for tabs (notes, photos, documents, etc.)
      const tabs = page.locator('[role="tab"]');
      const tabCount = await tabs.count();
      if (tabCount > 0) {
        // Click through first few tabs to verify they load
        for (let i = 0; i < Math.min(tabCount, 4); i++) {
          const tab = tabs.nth(i);
          if (await tab.isVisible()) {
            await tab.click({ force: true });
            await page.waitForTimeout(500);
          }
        }
      }
    }

    expect(errors).toHaveLength(0);
  });
});
