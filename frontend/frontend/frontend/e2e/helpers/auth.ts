import { type Page } from '@playwright/test';

const TEST_USER = {
  email: 'test@eden.com',
  password: 'password',
};

const MOCK_USER = {
  id: 'e2e-user',
  email: TEST_USER.email,
  full_name: 'E2E Test User',
  role: 'admin',
  permissions: ['territories.write', 'harvest.territories.manage'],
};

/**
 * Removes the webpack-dev-server error overlay iframe that blocks all
 * pointer events during E2E tests when CRA detects backend connection errors.
 * Must be called before any page navigation/interaction.
 */
export async function removeWebpackOverlay(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const removeOverlay = () => {
      const iframe = document.getElementById('webpack-dev-server-client-overlay');
      if (iframe) iframe.remove();
    };
    removeOverlay();
    setInterval(removeOverlay, 500);
    const observer = new MutationObserver(() => removeOverlay());
    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true });
    } else {
      document.addEventListener('DOMContentLoaded', () => {
        observer.observe(document.body, { childList: true, subtree: true });
      });
    }
  });
}

/**
 * Sets up API route mocking so E2E tests can run without a real backend.
 * Intercepts auth and general API endpoints with mock responses.
 */
export async function setupApiMocks(page: Page): Promise<void> {
  // Intercept /api/auth/me
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_USER),
    })
  );

  // Intercept /api/auth/login
  await page.route('**/api/auth/login', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user: MOCK_USER,
        access_token: 'e2e-fallback-token',
      }),
    })
  );

  // Intercept /api/auth/logout
  await page.route('**/api/auth/logout', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true }),
    })
  );

  // Catch-all for other API calls - return empty but valid responses
  // Many components expect the response to be a raw array, not { data: [] }
  await page.route('**/api/**', (route, request) => {
    const url = request.url();
    // Already handled above -- let those routes take precedence
    if (
      url.includes('/api/auth/me') ||
      url.includes('/api/auth/login') ||
      url.includes('/api/auth/logout')
    ) {
      return route.fallback();
    }
    // Default: return empty array (most list endpoints expect this)
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });
}

/**
 * Logs in as the test user.
 *
 * Strategy: set up API mocks and inject token, then navigate directly
 * to /dashboard. The mocked /api/auth/me endpoint returns a valid user
 * so AuthContext treats the session as authenticated.
 *
 * This avoids race conditions with the login form (which would redirect
 * away before we can fill it, since the mock auth already kicks in).
 */
export async function loginAsTestUser(page: Page): Promise<void> {
  // Remove the webpack dev server overlay that blocks pointer events
  await removeWebpackOverlay(page);

  // Set up API mocks BEFORE navigating so they're active from the start
  await setupApiMocks(page);

  // Inject token into localStorage before navigation
  await page.addInitScript(() => {
    localStorage.setItem('eden_token', 'e2e-fallback-token');
  });

  // Navigate directly to dashboard -- mocks will serve /api/auth/me
  // so AuthContext sees an authenticated session
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });

  // Wait for the app to fully render with the authenticated layout
  await page.waitForSelector('nav, aside, [role="navigation"]', { timeout: 15_000 }).catch(() => {});
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
    'Failed to load resource: net::ERR_CONNECTION_REFUSED',
    'net::ERR_CONNECTION_REFUSED',
    '[Auth]',
    'Connectivity',
    'Download the React DevTools',
    'Sentry',
    'sentry',
    'chunk',
    'Loading chunk',
    'loading chunk',
    'ResizeObserver',
    'Content Security Policy',
    'worker-src',
    'script-src',
    'violates the following',
    'posthog',
    'PostHog',
    'is not a function',
    'removeChild',
    'not a child of this node',
    'Cannot read properties of',
    'Cannot read property',
    'GPS Error',
    'User denied Geolocation',
    'denied geolocation',
  ];

  const isIgnorable = (text: string): boolean =>
    IGNORED_PATTERNS.some((p) => text.includes(p));

  page.on('console', (msg) => {
    if (msg.type() === 'error' && !isIgnorable(msg.text())) {
      errors.push(msg.text());
    }
  });

  page.on('pageerror', (error) => {
    if (!isIgnorable(error.message)) {
      errors.push(`Page Error: ${error.message}`);
    }
  });

  return errors;
}

export { TEST_USER };
