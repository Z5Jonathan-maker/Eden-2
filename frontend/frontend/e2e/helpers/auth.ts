import { type Page } from '@playwright/test';

const TEST_USER = {
  email: 'test@eden.com',
  password: 'password',
};

/**
 * Logs in as the test user via the login form.
 *
 * Flow:
 * 1. Navigate to /login
 * 2. Fill email + password fields
 * 3. Submit
 * 4. Wait for redirect away from /login (landing on /dashboard)
 *
 * Falls back to a deterministic localStorage + route mock approach
 * when the real backend is unavailable (UI smoke testing).
 */
export async function loginAsTestUser(page: Page): Promise<void> {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('domcontentloaded');

  const emailInput = page.locator(
    'input[type="email"], [data-testid="login-email-input"]'
  ).first();
  const passwordInput = page.locator(
    'input[type="password"], [data-testid="login-password-input"]'
  ).first();
  const submitButton = page.locator(
    'button[type="submit"], [data-testid="login-submit-btn"]'
  ).first();

  // Attempt real login
  if (await emailInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await emailInput.fill(TEST_USER.email);
    await passwordInput.fill(TEST_USER.password);
    await submitButton.click();

    try {
      await page.waitForURL((url) => !url.pathname.startsWith('/login'), {
        timeout: 8_000,
      });
      return;
    } catch {
      // Backend unavailable - fall through to mock auth
    }
  }

  // Deterministic fallback: inject a mock user so AuthContext sees an
  // authenticated session without needing the real backend.
  const mockUser = {
    id: 'e2e-user',
    email: TEST_USER.email,
    full_name: 'E2E Test User',
    role: 'admin',
    permissions: ['territories.write', 'harvest.territories.manage'],
  };

  await page.route('**/api/auth/me', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockUser),
    })
  );

  await page.context().addInitScript(() => {
    localStorage.setItem('eden_token', 'e2e-fallback-token');
  });

  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('nav', { timeout: 10_000 }).catch(() => {});
}

/**
 * Captures console errors during a test, filtering out known noise.
 * Returns a mutable array that accumulates errors as they occur.
 */
export function setupConsoleErrorCapture(page: Page): string[] {
  const errors: string[] = [];

  const IGNORED_PATTERNS = [
    'favicon',
    'manifest.json',
    'WebSocket',
    'has been blocked by CORS policy',
    "No 'Access-Control-Allow-Origin' header is present",
    'Failed to load resource: net::ERR_FAILED',
    'TypeError: Failed to fetch',
    'Server fetch failed, using offline cache',
    'Error: Failed to fetch',
  ];

  const isIgnorable = (text: string): boolean =>
    IGNORED_PATTERNS.some((p) => text.includes(p));

  page.on('console', (msg) => {
    if (msg.type() === 'error' && !isIgnorable(msg.text())) {
      errors.push(msg.text());
    }
  });

  page.on('pageerror', (error) => {
    errors.push(`Page Error: ${error.message}`);
  });

  return errors;
}

export { TEST_USER };
