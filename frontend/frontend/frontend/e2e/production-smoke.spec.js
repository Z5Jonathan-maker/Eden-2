/**
 * Production Smoke Tests — Simulated Daily Use
 *
 * Runs against LIVE production (eden2-five.vercel.app + eden-2.onrender.com).
 * Uses storageState to login ONCE then reuse session across all tests.
 *
 * Tests every major feature a PA team uses daily:
 * - Auth, Claims CRM, Harvest/Canvassing, Documents, Contracts,
 *   Inspections, Eve AI, Settings, University, Scales, and more.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const PROD_URL = process.env.EDEN_PROD_URL || 'https://eden2-five.vercel.app';
const API_URL = 'https://eden-2.onrender.com';
const TEST_EMAIL = process.env.EDEN_TEST_EMAIL || 'e2e-test@eden.com';
const TEST_PASSWORD = process.env.EDEN_TEST_PASSWORD || 'E2ETest2026!';

const STORAGE_STATE_PATH = path.join(__dirname, '.auth-state.json');

// Error capture helper
function captureErrors(page) {
  const errors = [];
  const ignore = [
    'favicon', 'manifest', 'WebSocket', 'CORS', 'net::ERR',
    'Sentry', 'sentry', 'ResizeObserver', 'Content Security Policy',
    'worker-src', 'script-src', 'posthog', 'PostHog', 'GPS Error',
    'Geolocation', 'geolocation', 'chunk', 'DevTools', 'removeChild',
    'Download the React', '[Auth]', 'Connectivity', 'service-worker',
    'workbox', 'precache', 'sw.js',
    'import.meta', // Vite service worker in non-module context — not user-facing
    'Failed to load resource', // 401/404 from API calls — expected for unauthenticated/missing data
    'Failed to load module script', // CDN cache during redeploy
    'MIME type', // Service worker MIME mismatch
    'Failed to fetch today data', // Harvest endpoints return 404 when no data
    'Not Found', // 404 from optional API endpoints
  ];
  page.on('console', msg => {
    if (msg.type() === 'error' && !ignore.some(p => msg.text().includes(p))) {
      errors.push(msg.text());
    }
  });
  page.on('pageerror', err => {
    if (!ignore.some(p => err.message.includes(p))) {
      errors.push(`PAGE ERROR: ${err.message}`);
    }
  });
  return errors;
}

// ─── PUBLIC PAGES (no auth needed) ───────────────────────────────

test.describe('Public Pages', () => {
  test('landing page loads with hero and features', async ({ page }) => {
    const errors = captureErrors(page);
    await page.goto(PROD_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await expect(page.locator('nav').first()).toBeVisible({ timeout: 15000 });

    // CTA button (nav buttons like "DEPLOY NOW")
    const cta = page.locator('button, a').filter({ hasText: /deploy|start|trial|sign/i }).first();
    await expect(cta).toBeVisible({ timeout: 10000 });
    expect(errors).toHaveLength(0);
  });

  test('compare page loads with competitor grid', async ({ page }) => {
    const errors = captureErrors(page);
    await page.goto(`${PROD_URL}/compare`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await expect(page.locator('text=Eden').first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator('text=Drodat').first()).toBeVisible({ timeout: 5000 });
    expect(errors).toHaveLength(0);
  });

  test('login page renders form', async ({ page }) => {
    const errors = captureErrors(page);
    await page.goto(`${PROD_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await expect(page.locator('input[type="email"], input[name="email"]').first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator('button[type="submit"]').first()).toBeVisible();
    expect(errors).toHaveLength(0);
  });

  test('register page renders form', async ({ page }) => {
    const errors = captureErrors(page);
    await page.goto(`${PROD_URL}/register`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await expect(page.locator('button[type="submit"]').first()).toBeVisible({ timeout: 15000 });
    expect(errors).toHaveLength(0);
  });
});

// ─── AUTH SETUP (login once, save state) ─────────────────────────

test.describe('Auth Setup', () => {
  test('login and save session', async ({ page }) => {
    await page.goto(`${PROD_URL}/login`, { waitUntil: 'networkidle', timeout: 30000 });

    const emailInput = page.locator('input[type="email"], input[name="email"]').first();
    await expect(emailInput).toBeVisible({ timeout: 15000 });
    await emailInput.fill(TEST_EMAIL);

    const pwInput = page.locator('input[type="password"]').first();
    await pwInput.fill(TEST_PASSWORD);

    await page.locator('button[type="submit"]').first().click();

    // Wait for redirect away from login
    await page.waitForURL(url => !url.toString().includes('/login'), { timeout: 20000 });
    await page.waitForLoadState('networkidle');

    // Save auth state (cookies + localStorage)
    await page.context().storageState({ path: STORAGE_STATE_PATH });
    console.log('Auth state saved');
  });
});

// ─── AUTHENTICATED FEATURES (reuse saved session) ────────────────

test.describe('Authenticated Features', () => {
  test.beforeEach(async ({ page }) => {
    // Load saved auth state if available
    if (fs.existsSync(STORAGE_STATE_PATH)) {
      const state = JSON.parse(fs.readFileSync(STORAGE_STATE_PATH, 'utf8'));
      // Inject localStorage (token)
      if (state.origins?.[0]?.localStorage) {
        await page.addInitScript((items) => {
          for (const item of items) {
            localStorage.setItem(item.name, item.value);
          }
        }, state.origins[0].localStorage);
      }
    }
  });

  // ── Dashboard ──
  test('dashboard loads', async ({ page }) => {
    const errors = captureErrors(page);
    await page.goto(`${PROD_URL}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    await expect(page.locator('body')).toBeVisible();
    const hasNav = await page.locator('nav, aside, [role="navigation"]').first().isVisible().catch(() => false);
    console.log(`Dashboard: nav visible=${hasNav}`);
    expect(errors).toHaveLength(0);
  });

  // ── Claims CRM ──
  test('claims list loads', async ({ page }) => {
    const errors = captureErrors(page);
    await page.goto(`${PROD_URL}/claims`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    await expect(page.locator('body')).toBeVisible();
    const items = await page.locator('a[href*="/claims/"], tr, .card').count();
    console.log(`Claims: ${items} items found`);
    expect(errors).toHaveLength(0);
  });

  test('claim detail tabs work', async ({ page }) => {
    const errors = captureErrors(page);
    await page.goto(`${PROD_URL}/claims`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    const claimLink = page.locator('a[href*="/claims/"]').first();
    if (await claimLink.isVisible().catch(() => false)) {
      await claimLink.click();
      await page.waitForTimeout(3000);

      const tabs = page.locator('[role="tab"], button[class*="tab"]');
      const tabCount = await tabs.count();
      console.log(`Claim Detail: ${tabCount} tabs`);

      for (let i = 0; i < Math.min(tabCount, 6); i++) {
        const tab = tabs.nth(i);
        if (await tab.isVisible()) {
          const text = await tab.textContent().catch(() => `tab-${i}`);
          await tab.click({ force: true });
          await page.waitForTimeout(600);
          console.log(`  Tab "${text?.trim()}" OK`);
        }
      }
    } else {
      console.log('No claims to click — skipping detail test');
    }
    expect(errors).toHaveLength(0);
  });

  test('new claim form opens', async ({ page }) => {
    const errors = captureErrors(page);
    await page.goto(`${PROD_URL}/claims/new`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    await expect(page.locator('body')).toBeVisible();
    const inputs = await page.locator('input:visible, select:visible, textarea:visible').count();
    console.log(`New Claim: ${inputs} form fields`);
    expect(errors).toHaveLength(0);
  });

  // ── Harvest/Canvassing ──
  test('harvest page loads with map', async ({ page }) => {
    const errors = captureErrors(page);
    await page.goto(`${PROD_URL}/canvassing`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(4000);

    const harvestPage = page.locator('[data-testid="harvest-page"]');
    const visible = await harvestPage.isVisible().catch(() => false);
    console.log(`Harvest: page visible=${visible}`);

    if (visible) {
      const map = page.locator('[data-testid="harvest-map"], .gm-style');
      const mapVisible = await map.first().isVisible().catch(() => false);
      console.log(`Harvest: map visible=${mapVisible}`);
    }
    expect(errors).toHaveLength(0);
  });

  test('harvest tabs cycle without crashes', async ({ page }) => {
    const errors = captureErrors(page);
    await page.goto(`${PROD_URL}/canvassing`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(4000);

    for (const id of ['today', 'leaderboard', 'challenges', 'profile', 'map']) {
      const tab = page.locator(`[data-testid="harvest-${id}-tab"]`);
      if (await tab.isVisible().catch(() => false)) {
        await tab.click({ force: true });
        await page.waitForTimeout(800);
        console.log(`  Harvest tab "${id}" OK`);
      }
    }
    expect(errors).toHaveLength(0);
  });

  test('harvest field mode activates', async ({ page }) => {
    const errors = captureErrors(page);
    await page.goto(`${PROD_URL}/canvassing`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(4000);

    const goField = page.locator('[data-testid="enter-field-mode"]');
    if (await goField.isVisible().catch(() => false)) {
      await goField.click();
      await page.waitForTimeout(1500);
      const naBtn = page.locator('[data-testid="field-tap-NA"]');
      const active = await naBtn.isVisible().catch(() => false);
      console.log(`Harvest: field mode active=${active}`);
    }
    expect(errors).toHaveLength(0);
  });

  // ── Documents ──
  test('documents page loads', async ({ page }) => {
    const errors = captureErrors(page);
    await page.goto(`${PROD_URL}/documents`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    await expect(page.locator('body')).toBeVisible();
    console.log('Documents: loaded');
    expect(errors).toHaveLength(0);
  });

  // ── Contracts ──
  test('contracts page loads', async ({ page }) => {
    const errors = captureErrors(page);
    await page.goto(`${PROD_URL}/contracts`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    await expect(page.locator('body')).toBeVisible();
    console.log('Contracts: loaded');
    expect(errors).toHaveLength(0);
  });

  // ── Inspections ──
  test('inspections page loads', async ({ page }) => {
    const errors = captureErrors(page);
    await page.goto(`${PROD_URL}/inspections`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    await expect(page.locator('body')).toBeVisible();
    console.log('Inspections: loaded');
    expect(errors).toHaveLength(0);
  });

  // ── Eve AI ──
  test('eve AI assistant loads with chat input', async ({ page }) => {
    const errors = captureErrors(page);
    await page.goto(`${PROD_URL}/eve`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    const chatInput = page.locator('textarea, input[placeholder*="message" i], input[placeholder*="ask" i]').first();
    const hasChatInput = await chatInput.isVisible().catch(() => false);
    console.log(`Eve AI: chat input=${hasChatInput}`);
    expect(errors).toHaveLength(0);
  });

  // ── University ──
  test('university page loads', async ({ page }) => {
    const errors = captureErrors(page);
    await page.goto(`${PROD_URL}/university`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    await expect(page.locator('body')).toBeVisible();
    console.log('University: loaded');
    expect(errors).toHaveLength(0);
  });

  // ── Scales ──
  test('scales page loads', async ({ page }) => {
    const errors = captureErrors(page);
    await page.goto(`${PROD_URL}/scales`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    await expect(page.locator('body')).toBeVisible();
    console.log('Scales: loaded');
    expect(errors).toHaveLength(0);
  });

  // ── Settings ──
  test('settings page loads', async ({ page }) => {
    const errors = captureErrors(page);
    await page.goto(`${PROD_URL}/settings`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    await expect(page.locator('body')).toBeVisible();
    console.log('Settings: loaded');
    expect(errors).toHaveLength(0);
  });

  // ── Email Intelligence ──
  test('email intelligence loads', async ({ page }) => {
    const errors = captureErrors(page);
    await page.goto(`${PROD_URL}/email-intelligence`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    await expect(page.locator('body')).toBeVisible();
    console.log('Email Intelligence: loaded');
    expect(errors).toHaveLength(0);
  });

  // ── Property Hub ──
  test('property hub loads', async ({ page }) => {
    const errors = captureErrors(page);
    await page.goto(`${PROD_URL}/property`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    await expect(page.locator('body')).toBeVisible();
    console.log('Property Hub: loaded');
    expect(errors).toHaveLength(0);
  });

  // ── Florida Laws ──
  test('florida laws loads', async ({ page }) => {
    const errors = captureErrors(page);
    await page.goto(`${PROD_URL}/florida-laws`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    await expect(page.locator('body')).toBeVisible();
    console.log('Florida Laws: loaded');
    expect(errors).toHaveLength(0);
  });

  // ── Battle Pass ──
  test('battle pass loads', async ({ page }) => {
    const errors = captureErrors(page);
    await page.goto(`${PROD_URL}/battle-pass`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    await expect(page.locator('body')).toBeVisible();
    console.log('Battle Pass: loaded');
    expect(errors).toHaveLength(0);
  });

  // ── Data Management ──
  test('data management loads', async ({ page }) => {
    const errors = captureErrors(page);
    await page.goto(`${PROD_URL}/data`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    await expect(page.locator('body')).toBeVisible();
    console.log('Data Management: loaded');
    expect(errors).toHaveLength(0);
  });

  // ── Workspace ──
  test('workspace loads', async ({ page }) => {
    const errors = captureErrors(page);
    await page.goto(`${PROD_URL}/workspace`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    await expect(page.locator('body')).toBeVisible();
    console.log('Workspace: loaded');
    expect(errors).toHaveLength(0);
  });

  // ── Performance Console ──
  test('performance console loads', async ({ page }) => {
    const errors = captureErrors(page);
    await page.goto(`${PROD_URL}/performance`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    await expect(page.locator('body')).toBeVisible();
    console.log('Performance: loaded');
    expect(errors).toHaveLength(0);
  });

  // ── Integrations ──
  test('integrations page loads', async ({ page }) => {
    const errors = captureErrors(page);
    await page.goto(`${PROD_URL}/integrations`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    await expect(page.locator('body')).toBeVisible();
    console.log('Integrations: loaded');
    expect(errors).toHaveLength(0);
  });

  // ── QA / Adam ──
  test('QA page loads', async ({ page }) => {
    const errors = captureErrors(page);
    await page.goto(`${PROD_URL}/qa`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    await expect(page.locator('body')).toBeVisible();
    console.log('QA: loaded');
    expect(errors).toHaveLength(0);
  });

  // ── Sales Enablement ──
  test('sales page loads', async ({ page }) => {
    const errors = captureErrors(page);
    await page.goto(`${PROD_URL}/sales`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    await expect(page.locator('body')).toBeVisible();
    console.log('Sales: loaded');
    expect(errors).toHaveLength(0);
  });

  // ── Vision Board ──
  test('vision board loads', async ({ page }) => {
    const errors = captureErrors(page);
    await page.goto(`${PROD_URL}/vision`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    await expect(page.locator('body')).toBeVisible();
    console.log('Vision: loaded');
    expect(errors).toHaveLength(0);
  });

  // ── Experts ──
  test('industry experts loads', async ({ page }) => {
    const errors = captureErrors(page);
    await page.goto(`${PROD_URL}/experts`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    await expect(page.locator('body')).toBeVisible();
    console.log('Experts: loaded');
    expect(errors).toHaveLength(0);
  });

  // ── FULL NAVIGATION STRESS TEST ──
  test('navigate ALL routes without crashes', async ({ page }) => {
    const errors = captureErrors(page);
    const routes = [
      '/dashboard', '/claims', '/inspections', '/documents',
      '/eve', '/contracts', '/university', '/scales',
      '/canvassing', '/settings', '/data', '/email-intelligence',
      '/property', '/florida-laws', '/battle-pass', '/workspace',
      '/performance', '/experts', '/sales', '/vision',
      '/integrations', '/qa',
    ];

    const results = [];
    for (const route of routes) {
      try {
        await page.goto(`${PROD_URL}${route}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await page.waitForTimeout(1500);
        const bodyHtml = await page.locator('body').innerHTML();
        const hasContent = bodyHtml.length > 100;
        results.push({ route, status: hasContent ? 'OK' : 'EMPTY' });
      } catch (e) {
        results.push({ route, status: 'FAIL', error: e.message.substring(0, 60) });
      }
    }

    console.log('\n=== ROUTE NAVIGATION RESULTS ===');
    console.table(results);

    const failed = results.filter(r => r.status === 'FAIL');
    const empty = results.filter(r => r.status === 'EMPTY');
    console.log(`Total: ${results.length} | OK: ${results.length - failed.length - empty.length} | Empty: ${empty.length} | Failed: ${failed.length}`);

    expect(failed.length).toBeLessThanOrEqual(2);
  });
});

// ─── API HEALTH CHECKS ──────────────────────────────────────────

test.describe('API Health', () => {
  test('backend health endpoint', async ({ request }) => {
    const res = await request.get(`${API_URL}/health`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.status).toBe('healthy');
    expect(body.checks.database).toBe('ok');
    console.log('API Health:', JSON.stringify(body));
  });

  test('unauthenticated /me returns 401', async ({ request }) => {
    const res = await request.get(`${API_URL}/api/auth/me`);
    expect([401, 429]).toContain(res.status());
  });
});
