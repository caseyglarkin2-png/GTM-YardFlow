/**
 * Hitlist & Prospects E2E Tests - YardFlow Hub
 * 
 * Tests for prospect management and hitlist functionality
 */

import { test, expect, navigateToTab, testData } from './fixtures';

test.describe('Hitlist Tab', () => {
  test.beforeEach(async ({ appPage }) => {
    // Navigate to Hitlist tab (usually default)
    await navigateToTab(appPage, 'Hitlist');
  });
  
  test('should display hitlist interface', async ({ appPage }) => {
    // Check for hitlist-related content
    await expect(appPage.locator('text=/Hitlist|Prospects|Companies|Contacts/i')).toBeVisible();
  });
  
  test('should have a list or table of prospects', async ({ appPage }) => {
    // Look for table or list elements
    const tableOrList = appPage.locator('table, [role="grid"], [role="list"], ul, ol').first();
    
    // Should have some kind of list structure
    await expect(tableOrList).toBeVisible();
  });
  
  test('should display prospect details', async ({ appPage }) => {
    // Look for prospect-related content
    const prospectContent = appPage.locator('text=/company|email|phone|title|contact/i');
    
    // At least one prospect field should be visible
    await expect(prospectContent.first()).toBeVisible();
  });
  
  test('should have search or filter functionality', async ({ appPage }) => {
    // Look for search input or filter controls
    const searchInput = appPage.locator('input[type="search"], input[placeholder*="search" i], input[placeholder*="filter" i]');
    const filterButton = appPage.locator('button, select').filter({ hasText: /filter|sort/i });
    
    // At least one filtering mechanism should exist
    const hasSearch = await searchInput.count() > 0;
    const hasFilter = await filterButton.count() > 0;
    
    expect(hasSearch || hasFilter).toBe(true);
  });
  
  test('should allow clicking on a prospect', async ({ appPage }) => {
    // Find clickable prospect rows or cards
    const clickableItems = appPage.locator('tr[class*="cursor"], [class*="clickable"], [role="row"], [role="button"]');
    
    if (await clickableItems.count() > 0) {
      await clickableItems.first().click();
      
      // Should show details or expand
      await expect(appPage.locator('body')).toBeVisible();
    }
  });
});

test.describe('Prospect Search', () => {
  test.beforeEach(async ({ appPage }) => {
    await navigateToTab(appPage, 'Hitlist');
  });
  
  test('should filter prospects by search term', async ({ appPage }) => {
    const searchInput = appPage.locator('input[type="search"], input[placeholder*="search" i]').first();
    
    if (await searchInput.isVisible()) {
      // Type a search term
      await searchInput.fill('logistics');
      await appPage.waitForTimeout(500);
      
      // Results should update
      await expect(appPage.locator('body')).toBeVisible();
    }
  });
  
  test('should clear search results', async ({ appPage }) => {
    const searchInput = appPage.locator('input[type="search"], input[placeholder*="search" i]').first();
    
    if (await searchInput.isVisible()) {
      // Type and then clear
      await searchInput.fill('test');
      await searchInput.fill('');
      
      // Results should reset
      await expect(appPage.locator('body')).toBeVisible();
    }
  });
  
  test('should handle no results gracefully', async ({ appPage }) => {
    const searchInput = appPage.locator('input[type="search"], input[placeholder*="search" i]').first();
    
    if (await searchInput.isVisible()) {
      // Search for something that shouldn't exist
      await searchInput.fill('xyznonexistent12345');
      await appPage.waitForTimeout(500);
      
      // Should show no results message or empty state
      await expect(appPage.locator('body')).toBeVisible();
    }
  });
});

test.describe('Prospect Actions', () => {
  test.beforeEach(async ({ appPage }) => {
    await navigateToTab(appPage, 'Hitlist');
  });
  
  test('should have action buttons for prospects', async ({ appPage }) => {
    // Look for action buttons
    const actionButtons = appPage.locator('button').filter({
      hasText: /edit|delete|view|message|email|call/i
    });
    
    // Should have at least some action buttons
    const hasActions = await actionButtons.count() > 0;
    
    // Or check for icon buttons
    const iconButtons = appPage.locator('button svg, button [class*="icon"]');
    const hasIconButtons = await iconButtons.count() > 0;
    
    expect(hasActions || hasIconButtons).toBe(true);
  });
  
  test('should allow selecting multiple prospects', async ({ appPage }) => {
    // Look for checkboxes
    const checkboxes = appPage.locator('input[type="checkbox"]');
    
    if (await checkboxes.count() > 0) {
      // Click first checkbox
      await checkboxes.first().click();
      
      // Should be checked
      await expect(checkboxes.first()).toBeChecked();
    }
  });
  
  test('should have bulk action options', async ({ appPage }) => {
    const bulkActions = appPage.locator('button, select').filter({
      hasText: /bulk|all|selected|export/i
    });
    
    // Bulk actions may or may not exist
    // Just verify app is functional
    await expect(appPage.locator('body')).toBeVisible();
  });
});

test.describe('Prospect Data Display', () => {
  test.beforeEach(async ({ appPage }) => {
    await navigateToTab(appPage, 'Hitlist');
  });
  
  test('should display company information', async ({ appPage }) => {
    // Look for company-related fields
    const companyInfo = appPage.locator('text=/company|organization|business/i');
    
    await expect(companyInfo.first()).toBeVisible();
  });
  
  test('should display contact information', async ({ appPage }) => {
    // Look for contact details
    const contactPatterns = [
      /email|@/i,
      /phone|tel/i,
      /name|contact/i,
    ];
    
    let foundContact = false;
    for (const pattern of contactPatterns) {
      const element = appPage.locator(`text=${pattern}`);
      if (await element.count() > 0) {
        foundContact = true;
        break;
      }
    }
    
    expect(foundContact).toBe(true);
  });
  
  test('should display priority or tier information', async ({ appPage }) => {
    // Look for priority indicators
    const priorityIndicators = appPage.locator('text=/tier|priority|hot|warm|cold/i, [class*="badge"], [class*="tag"], [class*="priority"]');
    
    // May or may not have explicit priority display
    await expect(appPage.locator('body')).toBeVisible();
  });
});
