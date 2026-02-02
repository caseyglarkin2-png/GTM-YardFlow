import { test, expect } from '@playwright/test';

test.describe('Desktop Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should navigate between main tabs', async ({ page }) => {
    // Navigate to Hitlist
    await page.getByText('Prospects').click();
    await expect(page.getByText('All Prospects')).toBeVisible(); 
    // Wait for URL or state 
    // await expect(page).toHaveURL(/prospects/);

    // Navigate to Sequences
    await page.getByText('Sequences').click();
    await expect(page.getByText('Templates')).toBeVisible(); 
    // await expect(page).toHaveURL(/sequences/);
    
    // Navigate to Dashboard
    await page.getByText('Dashboard').click();
    await expect(page.getByText('System Health')).toBeVisible();
  });
});
