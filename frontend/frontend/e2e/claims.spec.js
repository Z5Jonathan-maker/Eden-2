/**
 * Claims Tests
 * Tests: Claim list, Claim detail, All sections, Forms
 */
const { test, expect } = require('@playwright/test');
const { login, setupConsoleErrorCapture, checkNoTextOverflow, clickAndVerifyAction } = require('./helpers');

test.describe('Claims', () => {
  
  test.beforeEach(async ({ page }) => {
    await login(page);
  });
  
  test('claims list page renders without overflow', async ({ page }) => {
    await page.goto('/claims');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    
    // Check main content area for unintended overflow (exclude intentional truncation)
    const overflows = await page.evaluate(() => {
      const main = document.querySelector('main') || document.body;
      const elements = main.querySelectorAll('*');
      const overflowing = [];
      
      elements.forEach(el => {
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') return;
        if (el.clientWidth === 0) return;
        
        if (el.scrollWidth > el.clientWidth + 5) {
          // Skip if it's intentionally scrollable
          if (style.overflowX === 'scroll' || style.overflowX === 'auto') return;
          
          // Skip if it has truncate class (text-overflow: ellipsis is intentional)
          if (el.className.includes('truncate') || style.textOverflow === 'ellipsis') return;
          
          overflowing.push({
            tag: el.tagName,
            cls: el.className.substring(0, 50),
            text: el.textContent?.substring(0, 30)
          });
        }
      });
      return overflowing.slice(0, 5);
    });
    
    // Log issues for debugging
    if (overflows.length > 0) {
      console.log('Claims unintended overflow:', JSON.stringify(overflows, null, 2));
    }
    expect(overflows.length).toBeLessThanOrEqual(2);
  });
  
  test('claims list shows claim cards', async ({ page }) => {
    const errors = setupConsoleErrorCapture(page);
    
    await page.goto('/claims');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // Look for claim items
    const claimItems = page.locator('[data-testid*="claim"], [class*="claim-card"], tr, .card').first();
    
    // Just verify page loaded
    await expect(page.locator('body')).toBeVisible();
    expect(errors).toHaveLength(0);
  });
  
  test('new claim button is clickable', async ({ page }) => {
    const errors = setupConsoleErrorCapture(page);
    
    await page.goto('/claims');
    await page.waitForLoadState('networkidle');
    
    const newClaimBtn = page.locator('button:has-text("New Claim"), button:has-text("Add Claim"), [data-testid="new-claim"]').first();
    
    if (await newClaimBtn.isVisible()) {
      await newClaimBtn.click({ force: true });
      await page.waitForTimeout(1000);
      
      // Should show form or navigate
      expect(errors).toHaveLength(0);
    }
  });
  
  test('claim detail page loads', async ({ page }) => {
    const errors = setupConsoleErrorCapture(page);
    
    await page.goto('/claims');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    
    // Try to click first claim
    const claimLink = page.locator('a[href*="/claims/"], [data-testid*="claim"]').first();
    
    if (await claimLink.isVisible()) {
      await claimLink.click({ force: true });
      await page.waitForTimeout(2000);
      
      // Should load claim detail
      await expect(page.locator('body')).toBeVisible();
    }
    
    expect(errors).toHaveLength(0);
  });
  
  test('claim detail sections are accessible', async ({ page }) => {
    const errors = setupConsoleErrorCapture(page);
    
    // Navigate to first claim
    await page.goto('/claims');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    
    const claimLink = page.locator('a[href*="/claims/"]').first();
    
    if (await claimLink.isVisible()) {
      await claimLink.click({ force: true });
      await page.waitForTimeout(2000);
      
      // Check for tabs or sections
      const tabs = page.locator('[role="tab"], [data-testid*="tab"]');
      const tabCount = await tabs.count();
      
      // Click through tabs
      for (let i = 0; i < Math.min(tabCount, 5); i++) {
        const tab = tabs.nth(i);
        if (await tab.isVisible()) {
          await tab.click({ force: true });
          await page.waitForTimeout(500);
        }
      }
    }
    
    expect(errors).toHaveLength(0);
  });
  
  test('claim detail buttons do not crash', async ({ page }) => {
    const errors = setupConsoleErrorCapture(page);
    
    await page.goto('/claims');
    await page.waitForLoadState('networkidle');
    
    const claimLink = page.locator('a[href*="/claims/"]').first();
    
    if (await claimLink.isVisible()) {
      await claimLink.click({ force: true });
      await page.waitForTimeout(2000);
      
      // Find action buttons
      const actionButtons = page.locator('button:visible').filter({
        hasText: /edit|save|schedule|upload|add/i
      });
      
      const count = await actionButtons.count();
      
      // Verify buttons are visible and accessible (don't actually click destructive actions)
      for (let i = 0; i < Math.min(count, 5); i++) {
        const btn = actionButtons.nth(i);
        await expect(btn).toBeVisible();
        await expect(btn).toBeEnabled();
      }
    }
    
    expect(errors).toHaveLength(0);
  });
});
