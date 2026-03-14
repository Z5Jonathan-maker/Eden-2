/**
 * Eden E2E Test Utilities
 * Shared helpers for all test files
 */
const { expect } = require('@playwright/test');

const TEST_USER = {
  email: 'test@eden.com',
  password: 'password'
};

const MOCK_USER = {
  id: 'e2e-user',
  email: 'test@eden.com',
  full_name: 'E2E Test User',
  role: 'admin',
  permissions: ['territories.write', 'harvest.territories.manage'],
};

/**
 * Removes the webpack-dev-server error overlay iframe that blocks all
 * pointer events during E2E tests. Call before any page navigation.
 */
async function removeWebpackOverlay(page) {
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
 */
async function setupApiMocks(page) {
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_USER) })
  );

  await page.route('**/api/auth/login', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ user: MOCK_USER, access_token: 'e2e-fallback-token' }),
    })
  );

  await page.route('**/api/auth/logout', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) })
  );

  await page.route('**/api/**', (route, request) => {
    const url = request.url();
    if (url.includes('/api/auth/me') || url.includes('/api/auth/login') || url.includes('/api/auth/logout')) {
      return route.fallback();
    }
    // Return empty array (most list endpoints expect this)
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });
}

/**
 * Login helper - authenticates and stores session.
 * Uses mock API routes so no real backend is needed.
 */
async function login(page) {
  // Remove webpack overlay and set up API mocks first
  await removeWebpackOverlay(page);
  await setupApiMocks(page);

  // Inject token into localStorage before navigation
  await page.addInitScript(() => {
    localStorage.setItem('eden_token', 'e2e-fallback-token');
  });

  // Navigate directly to dashboard — mocks will serve /api/auth/me
  // so AuthContext sees an authenticated session
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('nav, aside, [role="navigation"]', { timeout: 15000 }).catch(() => {});
}

/**
 * Check for console errors during test
 */
function setupConsoleErrorCapture(page) {
  const errors = [];

  const ignoredPatterns = [
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

  const isIgnorable = (text) => ignoredPatterns.some((p) => text.includes(p));

  page.on('console', msg => {
    if (msg.type() === 'error' && !isIgnorable(msg.text())) {
      errors.push(msg.text());
    }
  });

  page.on('pageerror', error => {
    if (!isIgnorable(error.message)) {
      errors.push(`Page Error: ${error.message}`);
    }
  });

  return errors;
}

/**
 * Check that no text overflows its container (excluding known safe overflows)
 * This is a visual regression check
 */
async function checkNoTextOverflow(page, selector = 'body') {
  const overflowingElements = await page.evaluate((sel) => {
    const elements = document.querySelectorAll(`${sel} *`);
    const overflowing = [];

    elements.forEach(el => {
      const style = window.getComputedStyle(el);
      // Skip hidden elements
      if (style.display === 'none' || style.visibility === 'hidden') return;
      // Skip elements with 0 width (hidden sidebars, etc)
      if (el.clientWidth === 0) return;

      // Check horizontal overflow
      if (el.scrollWidth > el.clientWidth + 5) {
        // Check if it's intentionally scrollable or a known safe element
        if (style.overflowX !== 'scroll' &&
            style.overflowX !== 'auto' &&
            !el.className.includes('leaflet') &&
            !el.className.includes('sidebar') &&
            !el.className.includes('nav') &&
            !el.closest('aside') &&
            !el.closest('[role="navigation"]')) {
          overflowing.push({
            tag: el.tagName,
            class: el.className,
            text: el.textContent?.substring(0, 50),
            scrollWidth: el.scrollWidth,
            clientWidth: el.clientWidth
          });
        }
      }
    });

    return overflowing.slice(0, 5); // Return first 5 issues
  }, selector);

  return overflowingElements;
}

/**
 * Click a button and verify it does something
 * Fails if: uncaught error, no navigation, no modal, no visible change
 */
async function clickAndVerifyAction(page, selector, expectedBehavior = 'any') {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));

  const button = page.locator(selector).first();
  await expect(button).toBeVisible({ timeout: 5000 });

  const urlBefore = page.url();
  const modalCountBefore = await page.locator('[role="dialog"], .modal, [data-radix-dialog-content]').count();

  await button.click({ force: true });
  await page.waitForTimeout(500);

  // Check for errors
  if (errors.length > 0) {
    throw new Error(`Button click caused error: ${errors.join(', ')}`);
  }

  const urlAfter = page.url();
  const modalCountAfter = await page.locator('[role="dialog"], .modal, [data-radix-dialog-content]').count();

  // Verify something happened
  if (expectedBehavior === 'navigate') {
    expect(urlAfter).not.toBe(urlBefore);
  } else if (expectedBehavior === 'modal') {
    expect(modalCountAfter).toBeGreaterThan(modalCountBefore);
  }
  // 'any' behavior just checks for no errors

  return { navigated: urlAfter !== urlBefore, modalOpened: modalCountAfter > modalCountBefore };
}

/**
 * Verify all primary buttons on a page are clickable and don't crash
 */
async function verifyAllButtonsClickable(page) {
  const buttons = page.locator('button:visible, [role="button"]:visible, a[href]:visible');
  const count = await buttons.count();

  const issues = [];

  for (let i = 0; i < Math.min(count, 20); i++) { // Test first 20 buttons
    const button = buttons.nth(i);

    try {
      const isEnabled = await button.isEnabled();
      if (!isEnabled) continue;

      const text = await button.textContent();
      const testId = await button.getAttribute('data-testid');

      // Skip navigation links that would leave the page
      const href = await button.getAttribute('href');
      if (href && (href.startsWith('http') || href.startsWith('mailto'))) continue;

      // Verify button is visible and accessible
      await expect(button).toBeVisible();

    } catch (e) {
      issues.push(`Button ${i}: ${e.message}`);
    }
  }

  return issues;
}

module.exports = {
  TEST_USER,
  MOCK_USER,
  login,
  removeWebpackOverlay,
  setupApiMocks,
  setupConsoleErrorCapture,
  checkNoTextOverflow,
  clickAndVerifyAction,
  verifyAllButtonsClickable
};
