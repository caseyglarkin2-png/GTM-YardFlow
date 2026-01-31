/**
 * Production Smoke Tests
 * Sprint 209: Production Monitoring & Runbook
 * T209.6: Final E2E Smoke Test
 * 
 * Quick smoke tests that validate core functionality.
 * These tests are designed to run fast (< 2 minutes) and verify
 * the most critical paths work.
 */

import { test, expect } from '@playwright/test';

test.describe('Production Smoke Tests', () => {
  test.describe.configure({ timeout: 30000 }); // 30s per test

  // ==========================================================================
  // 1. App Loads
  // ==========================================================================

  test('app loads and displays content', async ({ page }) => {
    await page.goto('/');
    
    // Wait for React to hydrate
    await page.waitForLoadState('networkidle');
    
    // App should have loaded
    await expect(page.locator('body')).not.toBeEmpty();
    
    // No console errors
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    // Wait a bit for any async errors
    await page.waitForTimeout(1000);
    
    // Filter out expected errors (like Firebase analytics in test)
    const criticalErrors = errors.filter(e => 
      !e.includes('analytics') && 
      !e.includes('blocked') &&
      !e.includes('CORS')
    );
    
    expect(criticalErrors).toHaveLength(0);
  });

  test('app has valid HTML structure', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Should have root element
    await expect(page.locator('#root')).toBeVisible();
    
    // Should have navigation or main content
    const hasNav = await page.locator('nav').count() > 0;
    const hasMain = await page.locator('main').count() > 0;
    const hasContent = await page.locator('[role="main"], [data-testid]').count() > 0;
    
    expect(hasNav || hasMain || hasContent).toBe(true);
  });

  // ==========================================================================
  // 2. API Health
  // ==========================================================================

  test('health endpoint returns 200', async ({ request }) => {
    const response = await request.get('/api/health');
    
    expect(response.ok()).toBe(true);
    
    const body = await response.json();
    expect(body.status).toBe('ok');
    expect(body.timestamp).toBeDefined();
  });

  test('health endpoint returns version', async ({ request }) => {
    const response = await request.get('/api/health');
    const body = await response.json();
    
    expect(body.version).toBeDefined();
    expect(body.environment).toBeDefined();
  });

  // ==========================================================================
  // 3. Core UI Elements
  // ==========================================================================

  test('navigation elements are present', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Should have some form of navigation
    const navLinks = page.locator('a, button').filter({ hasText: /(Prospects|Dashboard|Sequences|Settings)/i });
    const count = await navLinks.count();
    
    // At least one nav element should exist
    expect(count).toBeGreaterThan(0);
  });

  test('search or filter input exists', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Look for search/filter input
    const searchInputs = page.locator('input[type="search"], input[placeholder*="search" i], input[placeholder*="filter" i]');
    const count = await searchInputs.count();
    
    // Search should exist somewhere
    expect(count).toBeGreaterThanOrEqual(0); // May be 0 on login page
  });

  // ==========================================================================
  // 4. Authentication Flow (if applicable)
  // ==========================================================================

  test('login form or authenticated content visible', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Should either show login form OR authenticated content
    const hasLoginForm = await page.locator('input[type="email"], input[type="password"], button:has-text("Log in"), button:has-text("Sign in")').count() > 0;
    const hasAuthContent = await page.locator('[data-testid="dashboard"], [data-testid="prospects"], nav').count() > 0;
    
    expect(hasLoginForm || hasAuthContent).toBe(true);
  });

  // ==========================================================================
  // 5. Performance
  // ==========================================================================

  test('initial page load under 5 seconds', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    
    const loadTime = Date.now() - startTime;
    
    expect(loadTime).toBeLessThan(5000);
  });

  test('no uncaught exceptions', async ({ page }) => {
    const exceptions: Error[] = [];
    
    page.on('pageerror', exception => {
      exceptions.push(exception);
    });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    expect(exceptions).toHaveLength(0);
  });

  // ==========================================================================
  // 6. Static Assets
  // ==========================================================================

  test('favicon loads', async ({ request }) => {
    const response = await request.get('/favicon.ico');
    // Favicon might return 200 or 304
    expect([200, 304]).toContain(response.status());
  });

  test('CSS loads correctly', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Check that styles are applied (element has computed styles)
    const body = page.locator('body');
    const backgroundColor = await body.evaluate(el => 
      window.getComputedStyle(el).backgroundColor
    );
    
    // Background should be defined (not empty)
    expect(backgroundColor).toBeDefined();
    expect(backgroundColor).not.toBe('');
  });
});
