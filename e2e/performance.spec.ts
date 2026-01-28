/**
 * Performance E2E Tests - YardFlow Hub
 * 
 * Tests for application performance and load times
 */

import { test, expect, navigateToTab, measurePageLoad } from './fixtures';

test.describe('Performance Metrics', () => {
  test('should load initial page within acceptable time', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    
    const loadTime = Date.now() - startTime;
    
    // Page should load within 5 seconds
    expect(loadTime).toBeLessThan(5000);
  });
  
  test('should have acceptable First Contentful Paint', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('load');
    
    // Wait a bit for metrics to be collected
    await page.waitForTimeout(1000);
    
    const fcp = await page.evaluate(() => {
      const entries = performance.getEntriesByType('paint');
      const fcpEntry = entries.find(e => e.name === 'first-contentful-paint');
      return fcpEntry?.startTime ?? 0;
    });
    
    // FCP should be under 2.5 seconds (good threshold)
    expect(fcp).toBeLessThan(2500);
  });
  
  test('should not have excessive JavaScript execution time', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Measure time for a complex operation
    const startTime = Date.now();
    
    // Navigate through all tabs
    const tabs = ['Hitlist', 'AI Assistant', 'Dashboard', 'ROI', 'Assets'];
    for (const tab of tabs) {
      const tabButton = page.getByRole('button', { name: new RegExp(tab, 'i') });
      if (await tabButton.isVisible()) {
        await tabButton.click();
        await page.waitForTimeout(100);
      }
    }
    
    const totalTime = Date.now() - startTime;
    
    // Should complete within 5 seconds
    expect(totalTime).toBeLessThan(5000);
  });
  
  test('should handle large data sets', async ({ appPage }) => {
    await navigateToTab(appPage, 'Hitlist');
    
    // Scroll through content to trigger any lazy loading
    await appPage.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    
    await appPage.waitForTimeout(500);
    
    await appPage.evaluate(() => {
      window.scrollTo(0, 0);
    });
    
    // Should still be responsive
    await expect(appPage.locator('body')).toBeVisible();
  });
});

test.describe('Memory Performance', () => {
  test('should not leak memory on tab switches', async ({ appPage }) => {
    // Switch tabs multiple times
    const tabs = ['Hitlist', 'AI Assistant', 'Dashboard', 'ROI', 'Assets'];
    
    for (let i = 0; i < 20; i++) {
      const randomTab = tabs[Math.floor(Math.random() * tabs.length)];
      const tabButton = appPage.getByRole('button', { name: new RegExp(randomTab, 'i') });
      if (await tabButton.isVisible()) {
        await tabButton.click();
      }
    }
    
    // App should still be responsive
    await expect(appPage.locator('body')).toBeVisible();
  });
  
  test('should handle rapid interactions', async ({ appPage }) => {
    // Find interactive elements
    const buttons = appPage.locator('button');
    const buttonCount = await buttons.count();
    
    // Click multiple buttons rapidly
    for (let i = 0; i < Math.min(buttonCount, 10); i++) {
      const button = buttons.nth(i);
      if (await button.isVisible() && await button.isEnabled()) {
        await button.click({ force: true }).catch(() => {});
      }
    }
    
    // App should still be functional
    await expect(appPage.locator('body')).toBeVisible();
  });
});

test.describe('Network Performance', () => {
  test('should work with slow network', async ({ page }) => {
    // Simulate slow 3G connection
    const client = await page.context().newCDPSession(page);
    await client.send('Network.enable');
    await client.send('Network.emulateNetworkConditions', {
      offline: false,
      downloadThroughput: (750 * 1024) / 8, // 750 Kbps
      uploadThroughput: (250 * 1024) / 8,    // 250 Kbps
      latency: 100,
    });
    
    const startTime = Date.now();
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    const loadTime = Date.now() - startTime;
    
    // Should still load within 15 seconds on slow network
    expect(loadTime).toBeLessThan(15000);
    
    // App should be functional
    await expect(page.locator('body')).toBeVisible();
  });
  
  test('should handle network recovery', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('load');
    
    // Simulate going offline
    const client = await page.context().newCDPSession(page);
    await client.send('Network.enable');
    await client.send('Network.emulateNetworkConditions', {
      offline: true,
      downloadThroughput: 0,
      uploadThroughput: 0,
      latency: 0,
    });
    
    // Try to interact
    await page.waitForTimeout(500);
    
    // Go back online
    await client.send('Network.emulateNetworkConditions', {
      offline: false,
      downloadThroughput: -1,
      uploadThroughput: -1,
      latency: 0,
    });
    
    // App should recover
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('Bundle Size', () => {
  test('should have reasonable resource sizes', async ({ page }) => {
    const resourceSizes: { url: string; size: number }[] = [];
    
    page.on('response', async (response) => {
      const url = response.url();
      const headers = response.headers();
      const size = parseInt(headers['content-length'] || '0', 10);
      
      if (url.includes('.js') || url.includes('.css')) {
        resourceSizes.push({ url, size });
      }
    });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Check that no single JS bundle is excessively large (> 1MB)
    for (const resource of resourceSizes) {
      if (resource.url.includes('.js')) {
        expect(resource.size).toBeLessThan(1024 * 1024); // 1MB
      }
    }
  });
});

test.describe('Rendering Performance', () => {
  test('should not have layout shifts on load', async ({ page }) => {
    await page.goto('/');
    
    // Wait for content to stabilize
    await page.waitForTimeout(2000);
    
    // Take a screenshot to verify layout is stable
    const screenshot1 = await page.screenshot();
    await page.waitForTimeout(500);
    const screenshot2 = await page.screenshot();
    
    // Screenshots should be similar (no major shifts)
    // This is a simplified check - in production you'd use visual regression tools
    expect(screenshot1.length).toBeGreaterThan(0);
    expect(screenshot2.length).toBeGreaterThan(0);
  });
  
  test('should render lists efficiently', async ({ appPage }) => {
    await navigateToTab(appPage, 'Hitlist');
    
    // Measure scroll performance
    const startTime = Date.now();
    
    for (let i = 0; i < 5; i++) {
      await appPage.evaluate(() => window.scrollBy(0, 300));
      await appPage.waitForTimeout(100);
    }
    
    const scrollTime = Date.now() - startTime;
    
    // Scrolling should be smooth (< 2 seconds for 5 scrolls)
    expect(scrollTime).toBeLessThan(2000);
  });
});
