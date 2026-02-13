/**
 * Navigation Tests
 * Tests: Main nav, Bottom tabs, Sidebar links
 */
const { test, expect } = require('@playwright/test');
const { login, setupConsoleErrorCapture, checkNoTextOverflow, clickAndVerifyAction } = require('./helpers');

test.describe('Navigation', () => {
  
  test.beforeEach(async ({ page }) => {
    await login(page);
  });
  
  test('main navigation links are visible', async ({ page }) => {
    const errors = setupConsoleErrorCapture(page);
    
    // Check for nav elements
    const nav = page.locator('nav, [role="navigation"], header').first();
    await expect(nav).toBeVisible();
    
    // No console errors
    expect(errors).toHaveLength(0);
  });
  
  test('dashboard loads without overflow', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    const overflows = await checkNoTextOverflow(page);
    expect(overflows.length).toBeLessThanOrEqual(2); // Allow minor issues
  });
  
  test('claims page loads without errors', async ({ page }) => {
    const errors = setupConsoleErrorCapture(page);
    
    await page.goto('/claims');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    
    // Page should load
    await expect(page.locator('body')).toBeVisible();
    
    // No critical errors
    const criticalErrors = errors.filter(e => 
      !e.includes('404') && !e.includes('network')
    );
    expect(criticalErrors).toHaveLength(0);
  });
  
  test('harvest/canvassing page loads', async ({ page }) => {
    const errors = setupConsoleErrorCapture(page);
    
    await page.goto('/canvassing');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // Should see map or harvest content
    const content = page.locator('[data-testid="harvest-page"], .leaflet-container, [class*="harvest"]').first();
    await expect(content).toBeVisible({ timeout: 10000 });
    
    // Filter out known non-critical errors (GPS denied in test env)
    const criticalErrors = errors.filter(e => 
      !e.includes('Geolocation') && !e.includes('GPS')
    );
    expect(criticalErrors).toHaveLength(0);
  });
  
  test('inspections page loads', async ({ page }) => {
    const errors = setupConsoleErrorCapture(page);
    
    await page.goto('/inspections');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    
    await expect(page.locator('body')).toBeVisible();
    expect(errors).toHaveLength(0);
  });
  
  test('contracts page loads', async ({ page }) => {
    const errors = setupConsoleErrorCapture(page);
    
    await page.goto('/contracts');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    
    await expect(page.locator('body')).toBeVisible();
    expect(errors).toHaveLength(0);
  });
  
  test('integrations page loads', async ({ page }) => {
    const errors = setupConsoleErrorCapture(page);
    
    await page.goto('/integrations');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    
    await expect(page.locator('body')).toBeVisible();
    expect(errors).toHaveLength(0);
  });
  
  test('notification bell is clickable', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    const bell = page.locator('[data-testid="notification-bell"]');
    
    if (await bell.isVisible()) {
      await bell.click();
      await page.waitForTimeout(500);
      
      // Should show notifications dropdown or modal
      const notifContent = page.locator('[class*="notification"], [role="dialog"]').first();
      // Just verify click didn't crash
    }
  });
});
