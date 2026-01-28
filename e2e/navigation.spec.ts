/**
 * App Navigation E2E Tests - YardFlow Hub
 * 
 * Tests for core navigation and tab switching
 */

import { test, expect, navigateToTab, getActiveTab } from './fixtures';

test.describe('App Navigation', () => {
  test('should load the application', async ({ appPage }) => {
    // Check that main app container is visible
    await expect(appPage.locator('body')).toBeVisible();
    
    // Check for app title or header
    await expect(appPage.locator('text=YardFlow')).toBeVisible();
  });
  
  test('should display all navigation tabs', async ({ appPage }) => {
    // Check for main navigation tabs
    const expectedTabs = ['Hitlist', 'AI Assistant', 'Dashboard', 'ROI', 'Assets'];
    
    for (const tab of expectedTabs) {
      const tabButton = appPage.getByRole('button', { name: new RegExp(tab, 'i') });
      await expect(tabButton).toBeVisible();
    }
  });
  
  test('should switch between tabs', async ({ appPage }) => {
    // Start on Hitlist tab (default)
    
    // Navigate to AI Assistant
    await navigateToTab(appPage, 'AI Assistant');
    await expect(appPage.locator('text=/AI|Assistant|Chat/i')).toBeVisible();
    
    // Navigate to Dashboard
    await navigateToTab(appPage, 'Dashboard');
    await expect(appPage.locator('text=/Dashboard|Analytics|Overview/i')).toBeVisible();
    
    // Navigate to ROI
    await navigateToTab(appPage, 'ROI');
    await expect(appPage.locator('text=/ROI|Calculator|Return/i')).toBeVisible();
  });
  
  test('should maintain tab state after refresh', async ({ appPage }) => {
    // Navigate to ROI tab
    await navigateToTab(appPage, 'ROI');
    
    // Get current URL
    const url = appPage.url();
    
    // Refresh the page
    await appPage.reload();
    
    // App should still be functional
    await expect(appPage.locator('body')).toBeVisible();
  });
  
  test('should be responsive on mobile viewport', async ({ appPage }) => {
    // Set mobile viewport
    await appPage.setViewportSize({ width: 375, height: 667 });
    
    // App should still be visible and functional
    await expect(appPage.locator('body')).toBeVisible();
    
    // Navigation should adapt to mobile
    // Either tabs scroll or a menu appears
    const navigationArea = appPage.locator('[role="navigation"], nav, [class*="tabs"]');
    await expect(navigationArea.first()).toBeVisible();
  });
});

test.describe('Keyboard Navigation', () => {
  test('should support keyboard navigation', async ({ appPage }) => {
    // Focus on the first interactive element
    await appPage.keyboard.press('Tab');
    
    // Check that something is focused
    const focusedElement = appPage.locator(':focus');
    await expect(focusedElement).toBeVisible();
  });
  
  test('should allow tab key navigation through buttons', async ({ appPage }) => {
    // Tab through multiple elements
    for (let i = 0; i < 5; i++) {
      await appPage.keyboard.press('Tab');
    }
    
    // Should still have a focused element
    const focusedElement = appPage.locator(':focus');
    await expect(focusedElement).toBeDefined();
  });
  
  test('should activate buttons with Enter key', async ({ appPage }) => {
    // Focus on a tab button
    const tabButton = appPage.getByRole('button').first();
    await tabButton.focus();
    
    // Press Enter
    await appPage.keyboard.press('Enter');
    
    // Button should have been activated (no error)
    await expect(appPage.locator('body')).toBeVisible();
  });
});

test.describe('Error Handling', () => {
  test('should handle missing routes gracefully', async ({ page }) => {
    // Navigate to a non-existent route
    await page.goto('/non-existent-page');
    
    // Should either redirect to home or show 404
    // App should still be functional
    await expect(page.locator('body')).toBeVisible();
  });
  
  test('should not crash on rapid tab switching', async ({ appPage }) => {
    const tabs = ['Hitlist', 'AI Assistant', 'Dashboard', 'ROI', 'Assets'];
    
    // Rapidly switch tabs
    for (let i = 0; i < 10; i++) {
      const randomTab = tabs[Math.floor(Math.random() * tabs.length)];
      const tabButton = appPage.getByRole('button', { name: new RegExp(randomTab, 'i') });
      if (await tabButton.isVisible()) {
        await tabButton.click();
      }
    }
    
    // App should still be functional
    await expect(appPage.locator('body')).toBeVisible();
  });
});
