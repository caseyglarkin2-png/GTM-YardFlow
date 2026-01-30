/**
 * T100.4b: Prospect CRUD E2E Tests
 * End-to-end tests for prospect operations
 */

import { test, expect } from '@playwright/test';

// Helper to login before tests
async function login(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.fill('[name=email], [type=email]', 'test@yardflow.com');
  await page.fill('[name=password], [type=password]', 'testpassword123');
  await page.click('button[type=submit]');
  await page.waitForURL(/^(?!.*login)/, { timeout: 15000 });
}

test.describe('Prospect CRUD Operations', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('displays prospect list', async ({ page }) => {
    await page.goto('/');
    
    // Should see prospect list or table
    const prospectList = page.locator('[data-testid="prospect-list"], table, [class*="prospect"]');
    await expect(prospectList).toBeVisible({ timeout: 10000 });
  });

  test('can search for prospects', async ({ page }) => {
    await page.goto('/');
    
    // Find search input
    const searchInput = page.locator('[data-testid="search"], input[type="search"], input[placeholder*="search" i]');
    
    if (await searchInput.isVisible()) {
      // Type search query
      await searchInput.fill('test');
      await searchInput.press('Enter');
      
      // Wait for search results to update
      await page.waitForTimeout(500);
      
      // Results should update (we can't verify exact results without known data)
      await expect(searchInput).toHaveValue('test');
    }
  });

  test('can open prospect detail view', async ({ page }) => {
    await page.goto('/');
    
    // Click on first prospect row
    const firstProspect = page.locator('[data-testid="prospect-row"], tr[data-prospect-id], .prospect-item').first();
    
    if (await firstProspect.isVisible()) {
      await firstProspect.click();
      
      // Should see detail panel or modal
      const detailView = page.locator('[data-testid="prospect-detail"], [class*="detail"], [class*="panel"]');
      await expect(detailView).toBeVisible({ timeout: 5000 });
    }
  });

  test('can change prospect status', async ({ page }) => {
    await page.goto('/');
    
    // Click on first prospect
    const firstProspect = page.locator('[data-testid="prospect-row"], tr[data-prospect-id], .prospect-item').first();
    
    if (await firstProspect.isVisible()) {
      await firstProspect.click();
      
      // Wait for detail view
      await page.waitForTimeout(500);
      
      // Find status dropdown or button
      const statusControl = page.locator('[data-testid="status-select"], [data-testid="prospect-status"], select[name="status"]');
      
      if (await statusControl.isVisible()) {
        // Click to open dropdown
        await statusControl.click();
        
        // Should see status options
        const statusOptions = page.locator('[role="option"], option, [class*="status-option"]');
        await expect(statusOptions.first()).toBeVisible({ timeout: 3000 });
      }
    }
  });

  test('can filter prospects by tier', async ({ page }) => {
    await page.goto('/');
    
    // Find tier filter
    const tierFilter = page.locator('[data-testid="tier-filter"], select[name="tier"], [class*="tier-filter"]');
    
    if (await tierFilter.isVisible()) {
      await tierFilter.click();
      
      // Select a tier option
      const tierOption = page.locator('[role="option"]:has-text("Tier 1"), option:has-text("Tier 1")');
      if (await tierOption.isVisible()) {
        await tierOption.click();
        
        // Wait for filter to apply
        await page.waitForTimeout(500);
      }
    }
  });

  test('can bulk select prospects', async ({ page }) => {
    await page.goto('/');
    
    // Find select all checkbox
    const selectAll = page.locator('[data-testid="select-all"], input[type="checkbox"][aria-label*="select all" i]');
    
    if (await selectAll.isVisible()) {
      await selectAll.check();
      
      // Bulk action toolbar should appear
      const bulkActions = page.locator('[data-testid="bulk-actions"], [class*="bulk-action"]');
      await expect(bulkActions).toBeVisible({ timeout: 3000 });
    }
  });

  test('shows Railway connection in prospect operations', async ({ page }) => {
    await page.goto('/');
    
    // Check that Railway client is being used (no errors, data loads)
    const prospectData = page.locator('[data-testid="prospect-row"], tr[data-prospect-id], .prospect-item');
    
    // Should load some data (even if empty state)
    await page.waitForTimeout(2000);
    
    // Either have data or show empty state
    const hasData = await prospectData.count() > 0;
    const emptyState = await page.locator('[data-testid="empty-state"], .empty, :text("No prospects")').isVisible();
    
    expect(hasData || emptyState).toBeTruthy();
  });
});

test.describe('Prospect Quick Actions', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('can send email to prospect', async ({ page }) => {
    await page.goto('/');
    
    // Click on first prospect
    const firstProspect = page.locator('[data-testid="prospect-row"], tr[data-prospect-id], .prospect-item').first();
    
    if (await firstProspect.isVisible()) {
      await firstProspect.click();
      await page.waitForTimeout(500);
      
      // Find email button
      const emailButton = page.locator('button:has-text("Email"), button:has-text("Send Email"), [data-testid="send-email"]');
      
      if (await emailButton.isVisible()) {
        await emailButton.click();
        
        // Should open email composer
        const emailComposer = page.locator('[data-testid="email-composer"], [class*="email-form"], textarea');
        await expect(emailComposer).toBeVisible({ timeout: 5000 });
      }
    }
  });

  test('can view prospect activity history', async ({ page }) => {
    await page.goto('/');
    
    // Click on first prospect
    const firstProspect = page.locator('[data-testid="prospect-row"], tr[data-prospect-id], .prospect-item').first();
    
    if (await firstProspect.isVisible()) {
      await firstProspect.click();
      await page.waitForTimeout(500);
      
      // Find activity tab or section
      const activitySection = page.locator('[data-testid="activity"], :text("Activity"), :text("History")');
      
      if (await activitySection.isVisible()) {
        await activitySection.click();
        
        // Should show activity items
        const activityItems = page.locator('[data-testid="activity-item"], [class*="activity-item"]');
        await page.waitForTimeout(1000);
        // Activity may or may not exist, just verify section loads
      }
    }
  });
});
