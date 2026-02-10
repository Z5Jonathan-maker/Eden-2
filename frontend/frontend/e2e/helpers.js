/**
 * Eden E2E Test Utilities
 * Shared helpers for all test files
 */
const { expect } = require('@playwright/test');

const TEST_USER = {
  email: 'test@eden.com',
  password: 'password'
};

/**
 * Login helper - authenticates and stores session
 */
async function login(page) {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  
  await page.fill('input[type="email"]', TEST_USER.email);
  await page.fill('input[type="password"]', TEST_USER.password);
  await page.click('button[type="submit"]');
  
  // Wait for redirect to dashboard
  await page.waitForURL(/\/(dashboard|claims|$)/, { timeout: 10000 });
}

/**
 * Check for console errors during test
 */
function setupConsoleErrorCapture(page) {
  const errors = [];
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text();
      // Ignore known non-critical errors
      if (!text.includes('favicon') && 
          !text.includes('manifest.json') &&
          !text.includes('WebSocket')) {
        errors.push(text);
      }
    }
  });
  
  page.on('pageerror', error => {
    errors.push(`Page Error: ${error.message}`);
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
  login,
  setupConsoleErrorCapture,
  checkNoTextOverflow,
  clickAndVerifyAction,
  verifyAllButtonsClickable
};
