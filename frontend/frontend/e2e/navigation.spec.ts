import { test, expect } from '@playwright/test';
import { loginAsTestUser, setupConsoleErrorCapture } from './helpers/auth';

/**
 * Main sidebar navigation links mapped from the Layout component.
 * Each entry has the sidebar label text and the expected URL path.
 */
const SIDEBAR_NAV_ITEMS = [
  { label: 'Command', path: '/dashboard' },
  { label: 'Garden', path: '/claims' },
  { label: 'Recon', path: '/inspections' },
  { label: 'Harvest', path: '/canvassing' },
  { label: 'Docs', path: '/documents' },
  { label: 'Contracts', path: '/contracts' },
];

test.describe('App Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
  });

  test('all main sidebar navigation links work', async ({ page }) => {
    const errors = setupConsoleErrorCapture(page);

    await page.goto('/dashboard');
    await page.waitForLoadState('domcontentloaded');

    const main = page.locator('main').first();
    await expect(main).toBeVisible({ timeout: 15_000 });

    for (const item of SIDEBAR_NAV_ITEMS) {
      // Sidebar uses <button> elements with data-testid, not <a> links.
      // Build the testid from the label: e.g. "Command" -> "nav-command"
      const testId = `nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`;
      const navBtn = page.locator(
        `[data-testid="${testId}"], a[href="${item.path}"], a[href*="${item.path}"]`
      ).first();

      if (await navBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await navBtn.click({ force: true });
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(1_500);

        // Verify the URL contains the expected path
        expect(page.url()).toContain(item.path);

        // Page should render without crash
        await expect(page.locator('body')).toBeVisible();
      }
    }

    // setupConsoleErrorCapture already filters known noise patterns
    expect(errors).toHaveLength(0);
  });

  test('breadcrumbs work correctly', async ({ page }) => {
    const errors = setupConsoleErrorCapture(page);

    // Navigate deep: dashboard -> claims -> claim detail
    await page.goto('/claims');
    await page.waitForLoadState('domcontentloaded');

    const main = page.locator('main').first();
    await expect(main).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(2_000);

    const claimLink = page.locator('a[href*="/claims/"]').first();

    if (await claimLink.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await claimLink.click({ force: true });
      await page.waitForTimeout(2_000);

      // Look for breadcrumb navigation
      const breadcrumbs = page.locator(
        'nav[aria-label*="breadcrumb" i], [data-testid*="breadcrumb"], .breadcrumb, nav ol'
      ).first();

      if (await breadcrumbs.isVisible({ timeout: 3_000 }).catch(() => false)) {
        // Click the first breadcrumb link to go back
        const firstCrumb = breadcrumbs.locator('a').first();
        if (await firstCrumb.isVisible()) {
          const previousUrl = page.url();
          await firstCrumb.click();
          await page.waitForTimeout(1_000);

          // URL should have changed (navigated back)
          expect(page.url()).not.toBe(previousUrl);
        }
      }
    }

    expect(errors).toHaveLength(0);
  });

  test('back navigation works', async ({ page }) => {
    const errors = setupConsoleErrorCapture(page);

    // Navigate: dashboard -> claims
    await page.goto('/dashboard');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1_000);

    await page.goto('/claims');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1_000);

    expect(page.url()).toContain('/claims');

    // Use browser back
    await page.goBack();
    await page.waitForTimeout(1_500);

    // Should go back to dashboard
    expect(page.url()).toContain('/dashboard');

    expect(errors).toHaveLength(0);
  });

  test('notification bell is clickable without crashing', async ({ page }) => {
    const errors = setupConsoleErrorCapture(page);

    await page.goto('/dashboard');
    await page.waitForLoadState('domcontentloaded');

    const main = page.locator('main').first();
    await expect(main).toBeVisible({ timeout: 15_000 });

    const bell = page.locator('[data-testid="notification-bell"]');

    if (await bell.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await bell.click();
      await page.waitForTimeout(1_000);

      // Verify the click didn't crash - page should still be functional
      await expect(page.locator('body')).toBeVisible();
    }

    expect(errors).toHaveLength(0);
  });

  test('pages load without console errors', async ({ page }) => {
    // setupConsoleErrorCapture already filters known noise patterns.
    // We set it up once and check after visiting all pages.
    const errors = setupConsoleErrorCapture(page);

    const pagesToCheck = [
      '/dashboard',
      '/claims',
      '/inspections',
      '/contracts',
      '/integrations',
    ];

    for (const path of pagesToCheck) {
      await page.goto(path);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1_500);

      // Page should render
      await expect(page.locator('body')).toBeVisible();
    }

    // All non-ignorable errors across all pages
    expect(errors).toHaveLength(0);
  });
});
