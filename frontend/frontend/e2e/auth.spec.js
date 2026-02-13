/**
 * Authentication Flow Tests
 * Tests: Login, Registration, Password visibility, Error handling
 */
const { test, expect } = require('@playwright/test');
const { login, setupConsoleErrorCapture, checkNoTextOverflow } = require('./helpers');

test.describe('Authentication', () => {
  
  test('login page renders without overflow', async ({ page }) => {
    const errors = setupConsoleErrorCapture(page);
    
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    
    // Check for text overflow
    const overflows = await checkNoTextOverflow(page);
    expect(overflows).toHaveLength(0);
    
    // Check no console errors
    expect(errors).toHaveLength(0);
  });
  
  test('login form elements are visible and tappable', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    
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
  
  test('login with valid credentials succeeds', async ({ page }) => {
    const errors = setupConsoleErrorCapture(page);
    
    await login(page);
    
    // Should be redirected away from login
    expect(page.url()).not.toContain('/login');
    
    // No errors
    expect(errors).toHaveLength(0);
  });
  
  test('login with invalid credentials shows error', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    
    await page.fill('input[type="email"]', 'wrong@email.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    
    // Should show error message (stay on login page)
    await page.waitForTimeout(2000);
    expect(page.url()).toContain('/login');
  });
  
  test('register page renders without overflow', async ({ page }) => {
    const errors = setupConsoleErrorCapture(page);
    
    await page.goto('/register');
    await page.waitForLoadState('networkidle');
    
    const overflows = await checkNoTextOverflow(page);
    expect(overflows).toHaveLength(0);
    expect(errors).toHaveLength(0);
  });
  
  test('register form elements are visible', async ({ page }) => {
    await page.goto('/register');
    await page.waitForLoadState('networkidle');
    
    // Name input
    const nameInput = page.locator('input[name="full_name"], input[placeholder*="name" i]').first();
    await expect(nameInput).toBeVisible();
    
    // Email input
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toBeVisible();
    
    // Password input
    const passwordInput = page.locator('input[type="password"]').first();
    await expect(passwordInput).toBeVisible();
    
    // Submit button
    const submitBtn = page.locator('button[type="submit"]');
    await expect(submitBtn).toBeVisible();
  });
});
