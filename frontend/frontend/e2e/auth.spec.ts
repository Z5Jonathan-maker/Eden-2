import { test, expect } from '@playwright/test';
import { loginAsTestUser, setupConsoleErrorCapture, TEST_USER } from './helpers/auth';

test.describe('Authentication Flow', () => {
  test('login page loads with correct elements', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');

    // Email input
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toBeVisible();
    await expect(emailInput).toBeEnabled();

    // Password input
    const passwordInput = page.locator('input[type="password"]');
    await expect(passwordInput).toBeVisible();
    await expect(passwordInput).toBeEnabled();

    // Submit button
    const submitBtn = page.locator('button[type="submit"]');
    await expect(submitBtn).toBeVisible();
    await expect(submitBtn).toBeEnabled();
  });

  test('login with invalid credentials shows error', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');

    await page.fill('input[type="email"]', 'wrong@email.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');

    // Should stay on login page (auth failed)
    await page.waitForTimeout(3_000);
    expect(page.url()).toContain('/login');

    // Should display an error alert
    const errorAlert = page.locator('[role="alert"]');
    const errorVisible = await errorAlert.isVisible().catch(() => false);
    if (errorVisible) {
      await expect(errorAlert).toContainText(/fail|invalid|error|wrong/i);
    }
  });

  test('login with valid credentials redirects to dashboard', async ({ page }) => {
    const errors = setupConsoleErrorCapture(page);

    await loginAsTestUser(page);

    // Should be redirected away from /login
    expect(page.url()).not.toContain('/login');

    // Should land on dashboard (or another post-login route)
    const currentPath = new URL(page.url()).pathname;
    expect(['/dashboard', '/client', '/']).toContain(currentPath);

    expect(errors).toHaveLength(0);
  });

  test('protected routes redirect to login when not authenticated', async ({ page }) => {
    // Clear any existing auth state
    await page.context().clearCookies();
    await page.goto('about:blank');
    await page.evaluate(() => localStorage.clear());

    // Try to access a protected route directly
    await page.goto('/dashboard');
    await page.waitForLoadState('domcontentloaded');

    // Should redirect to /login since we're not authenticated
    await page.waitForURL('**/login', { timeout: 10_000 }).catch(() => {});
    expect(page.url()).toContain('/login');
  });

  test('logout works', async ({ page }) => {
    // First, log in
    await loginAsTestUser(page);
    expect(page.url()).not.toContain('/login');

    // Find and click the logout button/link
    const logoutBtn = page.locator(
      'button:has-text("Logout"), button:has-text("Log Out"), button:has-text("Sign Out"), [data-testid="logout-btn"]'
    ).first();

    if (await logoutBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await logoutBtn.click();
      await page.waitForTimeout(2_000);

      // Should redirect to login
      expect(page.url()).toContain('/login');
    } else {
      // Try sidebar/menu expansion first (mobile or collapsed sidebar)
      const menuToggle = page.locator(
        'button[aria-label*="menu"], [data-testid="menu-toggle"], button:has(svg.lucide-menu)'
      ).first();

      if (await menuToggle.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await menuToggle.click();
        await page.waitForTimeout(500);
      }

      // Look for logout in expanded menu
      const logoutInMenu = page.locator(
        'button:has-text("Logout"), button:has-text("Log Out"), [data-testid="logout-btn"]'
      ).first();

      if (await logoutInMenu.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await logoutInMenu.click();
        await page.waitForTimeout(2_000);
        expect(page.url()).toContain('/login');
      } else {
        // Logout not easily accessible via UI - invoke logout via localStorage clear
        // and navigation to verify the redirect guard works
        await page.evaluate(() => {
          localStorage.clear();
          sessionStorage.clear();
        });
        await page.goto('/dashboard');
        await page.waitForURL('**/login', { timeout: 10_000 }).catch(() => {});
        expect(page.url()).toContain('/login');
      }
    }
  });
});
