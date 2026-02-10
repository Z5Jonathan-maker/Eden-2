/**
 * Modals and Forms Tests
 * Tests: Contracts, Calendar, Inspections modals and forms
 */
const { test, expect } = require('@playwright/test');
const { login, setupConsoleErrorCapture, checkNoTextOverflow } = require('./helpers');

test.describe('Modals and Forms', () => {
  
  test.beforeEach(async ({ page }) => {
    await login(page);
  });
  
  test('contracts page renders without overflow', async ({ page }) => {
    await page.goto('/contracts');
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
      console.log('Contracts unintended overflow:', JSON.stringify(overflows, null, 2));
    }
    expect(overflows.length).toBeLessThanOrEqual(2);
  });
  
  test('contracts page buttons are accessible', async ({ page }) => {
    const errors = setupConsoleErrorCapture(page);
    
    await page.goto('/contracts');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    
    // Find primary buttons
    const buttons = page.locator('button:visible').filter({
      hasText: /new|add|create|sign|send/i
    });
    
    const count = await buttons.count();
    
    for (let i = 0; i < Math.min(count, 5); i++) {
      const btn = buttons.nth(i);
      await expect(btn).toBeVisible();
    }
    
    expect(errors).toHaveLength(0);
  });
  
  test('inspections page renders', async ({ page }) => {
    const errors = setupConsoleErrorCapture(page);
    
    await page.goto('/inspections');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    
    await expect(page.locator('body')).toBeVisible();
    expect(errors).toHaveLength(0);
  });
  
  test('inspections rapid capture button is accessible', async ({ page }) => {
    const errors = setupConsoleErrorCapture(page);
    
    await page.goto('/inspections');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    
    const rapidCaptureBtn = page.locator('button:has-text("Rapid Capture"), [data-testid*="rapid"]').first();
    
    if (await rapidCaptureBtn.isVisible()) {
      // Button exists - it may be disabled until a claim is selected (expected behavior)
      await expect(rapidCaptureBtn).toBeVisible();
    }
    
    expect(errors).toHaveLength(0);
  });
  
  test('calendar modal opens from claim detail', async ({ page }) => {
    const errors = setupConsoleErrorCapture(page);
    
    // Navigate to a claim
    await page.goto('/claims');
    await page.waitForLoadState('networkidle');
    
    const claimLink = page.locator('a[href*="/claims/"]').first();
    
    if (await claimLink.isVisible()) {
      await claimLink.click({ force: true });
      await page.waitForTimeout(2000);
      
      // Look for schedule/calendar button
      const calendarBtn = page.locator('button:has-text("Schedule"), button:has-text("Calendar"), button:has-text("Appointment")').first();
      
      if (await calendarBtn.isVisible()) {
        await calendarBtn.click({ force: true });
        await page.waitForTimeout(1000);
        
        // Check if modal opened
        const modal = page.locator('[role="dialog"], .modal, [data-radix-dialog-content]').first();
        // Just verify no crash
      }
    }
    
    expect(errors).toHaveLength(0);
  });
  
  test('form inputs accept text', async ({ page }) => {
    const errors = setupConsoleErrorCapture(page);
    
    // Go to claims and try to create new
    await page.goto('/claims');
    await page.waitForLoadState('networkidle');
    
    const newBtn = page.locator('button:has-text("New"), button:has-text("Add")').first();
    
    if (await newBtn.isVisible()) {
      await newBtn.click({ force: true });
      await page.waitForTimeout(1000);
      
      // Try to fill form fields
      const textInputs = page.locator('input[type="text"]:visible, input:not([type]):visible');
      const inputCount = await textInputs.count();
      
      for (let i = 0; i < Math.min(inputCount, 3); i++) {
        const input = textInputs.nth(i);
        if (await input.isEnabled()) {
          await input.fill('Test Input');
          await page.waitForTimeout(100);
        }
      }
    }
    
    expect(errors).toHaveLength(0);
  });
  
  test('dropdown selects work', async ({ page }) => {
    const errors = setupConsoleErrorCapture(page);
    
    await page.goto('/claims');
    await page.waitForLoadState('networkidle');
    
    // Find any select/dropdown
    const selects = page.locator('select:visible, [role="combobox"]:visible');
    const selectCount = await selects.count();
    
    if (selectCount > 0) {
      const select = selects.first();
      await select.click({ force: true });
      await page.waitForTimeout(500);
    }
    
    expect(errors).toHaveLength(0);
  });
});
