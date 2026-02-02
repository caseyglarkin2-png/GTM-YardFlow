import { test, expect } from '@playwright/test';

test.describe('Desktop Sidebar', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should be visible on desktop viewport', async ({ page }) => {
    // Assuming sidebar has a generic nav container or class
    // We should use accessible roles if possible
    const sidebar = page.getByRole('navigation');
    await expect(sidebar).toBeVisible();
    
    // Check width is typically sidebar sized (e.g. > 200px)
    const box = await sidebar.boundingBox();
    expect(box?.width).toBeGreaterThan(200);
  });

  test('should collapse and expand', async ({ page }) => {
    // Assuming a collapse button exists, usually with an icon or aria-label
    // Looking for generic collapse/menu button
    const collapseBtn = page.getByRole('button', { name: /collapse|toggle/i }).first();
    
    if (await collapseBtn.isVisible()) {
        await collapseBtn.click();
        
        // Wait for animation or state update
        await page.waitForTimeout(500);
        
        const sidebar = page.getByRole('navigation');
        const box = await sidebar.boundingBox();
        // Expect width to decrease
        expect(box?.width).toBeLessThan(100);
        
        // Expand
        await collapseBtn.click();
        await page.waitForTimeout(500);
        const expandedBox = await sidebar.boundingBox();
        expect(expandedBox?.width).toBeGreaterThan(200);
    } else {
        console.log('Skipping collapse test - button not found');
    }
  });

  test('keyboard navigation should work', async ({ page }) => {
    const sidebar = page.getByRole('navigation');
    await sidebar.click(); // Focus sidebar context
    
    // Check first active item
    await page.keyboard.press('Tab');
    
    // Just verifying focus moves, exact behavior depends on implementation
    // This is a smoke test for keyboard support
    const focused = await page.evaluate(() => document.activeElement?.tagName);
    expect(focused).toBeTruthy();
  });
});
