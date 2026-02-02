import { test, expect } from '@playwright/test';

test.describe('Desktop Bulk Actions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByText('Prospects').click();
    // Wait for prospects to load
    await page.waitForSelector('.prospect-row', { timeout: 10000 });
  });

  test('should show bulk toolbar when multiple items selected', async ({ page }) => {
    // Select first row
    await page.locator('.prospect-checkbox').nth(0).click();
    
    // Select second row (Simulate Shift Click if needed, or just multiple clicks)
    await page.locator('.prospect-checkbox').nth(1).click();
    
    // Expect Toolbar to appear (usually at bottom or top)
    const toolbar = page.getByTestId('bulk-actions-toolbar'); 
    // Or by text
    await expect(page.getByText(/Selected 2/)).toBeVisible();
    
    // Check available actions
    await expect(page.getByText('Bulk Sequence')).toBeVisible();
    await expect(page.getByText('Delete')).toBeVisible();
  });

  test('should open bulk sequence modal', async ({ page }) => {
    await page.locator('.prospect-checkbox').nth(0).click();
    await page.locator('.prospect-checkbox').nth(1).click();
    
    await page.getByText('Bulk Sequence').click();
    
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText('Enroll 2 prospects')).toBeVisible();
  });
});
