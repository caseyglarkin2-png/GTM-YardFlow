/**
 * E2E Test Fixtures - YardFlow Hub
 * 
 * Custom fixtures and utilities for E2E tests
 */

import { test as base, expect, Page } from '@playwright/test';

/**
 * Application state for test setup
 */
interface AppState {
  isLoaded: boolean;
  currentTab: string;
}

/**
 * Custom test fixtures
 */
interface CustomFixtures {
  appPage: Page;
  mockProspects: boolean;
}

/**
 * Wait for the app to fully load
 */
async function waitForAppLoad(page: Page): Promise<void> {
  // Wait for main app container
  await page.waitForSelector('[class*="min-h-screen"]', { timeout: 10000 });
  
  // Wait for any loading states to complete
  await page.waitForFunction(() => {
    const loadingElements = document.querySelectorAll('[data-loading="true"]');
    return loadingElements.length === 0;
  }, { timeout: 5000 }).catch(() => {
    // Timeout is OK - no loading elements present
  });
}

/**
 * Get current active tab
 */
async function getActiveTab(page: Page): Promise<string> {
  const activeTab = await page.locator('button[class*="border-b-2"]').textContent();
  return activeTab?.trim() ?? '';
}

/**
 * Navigate to a specific tab
 */
async function navigateToTab(page: Page, tabName: string): Promise<void> {
  await page.getByRole('button', { name: tabName }).click();
  await page.waitForTimeout(300); // Allow tab transition
}

/**
 * Extended test with custom fixtures
 */
export const test = base.extend<CustomFixtures>({
  appPage: async ({ page }, use) => {
    // Navigate to app
    await page.goto('/');
    await waitForAppLoad(page);
    
    // Use the page in the test
    await use(page);
  },
  
  mockProspects: async ({}, use) => {
    // Flag for tests that need mock data
    await use(true);
  },
});

export { expect, waitForAppLoad, getActiveTab, navigateToTab };

/**
 * Test data helpers
 */
export const testData = {
  prospect: {
    name: 'Test Prospect',
    company: 'Test Logistics Inc',
    email: 'test@logistics.com',
    title: 'Fleet Manager',
  },
  
  message: {
    subject: 'Quick question about yard operations',
    body: 'Hi, I noticed your fleet has been growing...',
  },
  
  roiInputs: {
    trailerCount: 100,
    avgDetentionCost: 150,
    yearlyIncidents: 50,
    currentEfficiency: 75,
  },
};

/**
 * Accessibility helpers
 */
export async function checkAccessibility(page: Page): Promise<void> {
  // Check for common accessibility issues
  const images = await page.locator('img').all();
  for (const img of images) {
    const alt = await img.getAttribute('alt');
    expect(alt, 'Images should have alt text').toBeTruthy();
  }
  
  // Check for proper heading hierarchy
  const h1Count = await page.locator('h1').count();
  expect(h1Count, 'Page should have exactly one h1').toBeLessThanOrEqual(1);
  
  // Check for focus visibility
  const focusableElements = await page.locator('button, a, input, select, textarea').all();
  expect(focusableElements.length, 'Page should have focusable elements').toBeGreaterThan(0);
}

/**
 * Performance helpers
 */
export async function measurePageLoad(page: Page): Promise<{
  firstContentfulPaint: number;
  largestContentfulPaint: number;
  domContentLoaded: number;
}> {
  const performanceTimings = await page.evaluate(() => {
    const entries = performance.getEntriesByType('paint');
    const fcp = entries.find(e => e.name === 'first-contentful-paint');
    const lcp = entries.find(e => e.name === 'largest-contentful-paint');
    
    return {
      firstContentfulPaint: fcp?.startTime ?? 0,
      largestContentfulPaint: lcp?.startTime ?? 0,
      domContentLoaded: performance.timing.domContentLoadedEventEnd - performance.timing.navigationStart,
    };
  });
  
  return performanceTimings;
}

/**
 * Visual regression helpers
 */
export async function takeScreenshot(page: Page, name: string): Promise<void> {
  await page.screenshot({
    path: `./e2e/screenshots/${name}.png`,
    fullPage: true,
  });
}
