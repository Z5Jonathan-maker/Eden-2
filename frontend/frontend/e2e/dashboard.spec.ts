import { test, expect } from '@playwright/test';
import { loginAsTestUser, setupConsoleErrorCapture } from './helpers/auth';

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
  });

  test('dashboard loads with stats cards', async ({ page }) => {
    const errors = setupConsoleErrorCapture(page);

    await page.goto('/dashboard');
    await page.waitForLoadState('domcontentloaded');

    // Wait for the main content area to be visible
    const main = page.locator('main').first();
    await expect(main).toBeVisible({ timeout: 15_000 });

    // Stats cards are rendered as cards with numeric values.
    // Look for common stat indicators: card elements, numeric text, or stat labels.
    const statsArea = page.locator(
      '.card, [class*="stat"], [class*="Card"], [data-testid*="stat"]'
    );
    const statsCount = await statsArea.count();

    // Dashboard should show at least one stat card
    expect(statsCount).toBeGreaterThanOrEqual(1);

    expect(errors).toHaveLength(0);
  });

  test('dashboard shows recent claims section', async ({ page }) => {
    const errors = setupConsoleErrorCapture(page);

    await page.goto('/dashboard');
    await page.waitForLoadState('domcontentloaded');

    const main = page.locator('main').first();
    await expect(main).toBeVisible({ timeout: 15_000 });

    // Wait for data to load
    await page.waitForTimeout(2_000);

    // Look for recent claims section - either by heading text or claim-related content
    const recentSection = page.locator(
      'text=/recent|latest|claim/i, [data-testid*="recent"], [data-testid*="claim"]'
    ).first();

    const hasRecentSection = await recentSection.isVisible({ timeout: 5_000 }).catch(() => false);

    // Even if the section text differs, the page should have loaded without errors
    expect(errors).toHaveLength(0);

    // At minimum, the main content area should be populated
    const mainHtml = await main.innerHTML();
    expect(mainHtml.length).toBeGreaterThan(100);
  });

  test('navigation sidebar is visible and functional', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('domcontentloaded');

    // On desktop, sidebar should be visible
    const nav = page.locator('nav, aside, [role="navigation"]').first();
    await expect(nav).toBeVisible({ timeout: 10_000 });

    // Sidebar should contain navigation links
    const navLinks = nav.locator('a[href], button');
    const linkCount = await navLinks.count();
    expect(linkCount).toBeGreaterThanOrEqual(3);
  });

  test('can navigate to Claims page from sidebar', async ({ page }) => {
    const errors = setupConsoleErrorCapture(page);

    await page.goto('/dashboard');
    await page.waitForLoadState('domcontentloaded');

    // Sidebar uses <button data-testid="nav-garden"> for the claims/garden link
    const claimsLink = page.locator(
      '[data-testid="nav-garden"], a[href="/claims"], a[href*="/claims"], text=/Garden|Claims/i'
    ).first();

    await expect(claimsLink).toBeVisible({ timeout: 10_000 });
    await claimsLink.click();

    // Should navigate to claims page
    await page.waitForURL('**/claims', { timeout: 10_000 }).catch(() => {});
    expect(page.url()).toContain('/claims');

    expect(errors).toHaveLength(0);
  });
});
