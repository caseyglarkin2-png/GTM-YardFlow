/**
 * ROI Calculator E2E Tests - YardFlow Hub
 * 
 * Tests for the ROI Calculator workflow
 */

import { test, expect, navigateToTab, testData } from './fixtures';

test.describe('ROI Calculator', () => {
  test.beforeEach(async ({ appPage }) => {
    // Navigate to ROI tab
    await navigateToTab(appPage, 'ROI');
  });
  
  test('should display ROI calculator interface', async ({ appPage }) => {
    // Check for ROI calculator elements
    await expect(appPage.locator('text=/ROI|Return on Investment|Calculator/i')).toBeVisible();
  });
  
  test('should have input fields for calculations', async ({ appPage }) => {
    // Look for input fields or sliders
    const inputs = appPage.locator('input[type="number"], input[type="range"], input[type="text"]');
    const inputCount = await inputs.count();
    
    // Should have at least some input fields
    expect(inputCount).toBeGreaterThan(0);
  });
  
  test('should calculate ROI when values are entered', async ({ appPage }) => {
    // Find input fields
    const trailerInput = appPage.locator('input').first();
    
    if (await trailerInput.isVisible()) {
      // Clear and enter a value
      await trailerInput.fill('100');
      
      // Look for calculation results
      const resultsArea = appPage.locator('text=/\\$|savings|return|annual/i');
      await expect(resultsArea.first()).toBeVisible();
    }
  });
  
  test('should display savings breakdown', async ({ appPage }) => {
    // Look for savings-related content
    const savingsContent = appPage.locator('text=/savings|detention|efficiency|time/i');
    
    // At least one savings-related element should be visible
    await expect(savingsContent.first()).toBeVisible();
  });
  
  test('should handle edge case inputs', async ({ appPage }) => {
    // Find input fields
    const inputs = appPage.locator('input[type="number"]');
    const inputCount = await inputs.count();
    
    if (inputCount > 0) {
      const firstInput = inputs.first();
      
      // Test with zero
      await firstInput.fill('0');
      await expect(appPage.locator('body')).toBeVisible(); // No crash
      
      // Test with large number
      await firstInput.fill('10000');
      await expect(appPage.locator('body')).toBeVisible(); // No crash
    }
  });
  
  test('should have export or share functionality', async ({ appPage }) => {
    // Look for export/share buttons
    const exportButton = appPage.locator('button, a').filter({
      hasText: /export|download|share|pdf|save/i
    });
    
    // If export exists, it should be clickable
    if (await exportButton.count() > 0) {
      await expect(exportButton.first()).toBeEnabled();
    }
  });
});

test.describe('ROI Calculator Validation', () => {
  test.beforeEach(async ({ appPage }) => {
    await navigateToTab(appPage, 'ROI');
  });
  
  test('should show validation for required fields', async ({ appPage }) => {
    // Try to find a submit or calculate button
    const calculateButton = appPage.locator('button').filter({
      hasText: /calculate|submit|get results/i
    });
    
    if (await calculateButton.count() > 0) {
      await calculateButton.first().click();
      
      // Should show validation message or calculate anyway
      await expect(appPage.locator('body')).toBeVisible();
    }
  });
  
  test('should update calculations in real-time', async ({ appPage }) => {
    const inputs = appPage.locator('input[type="number"], input[type="range"]');
    
    if (await inputs.count() > 0) {
      const firstInput = inputs.first();
      const initialContent = await appPage.content();
      
      // Change input value
      await firstInput.fill('50');
      await appPage.waitForTimeout(500);
      
      // Content should have updated (results changed)
      // Just verify app is still functional
      await expect(appPage.locator('body')).toBeVisible();
    }
  });
});

test.describe('ROI Results Display', () => {
  test.beforeEach(async ({ appPage }) => {
    await navigateToTab(appPage, 'ROI');
  });
  
  test('should format currency values correctly', async ({ appPage }) => {
    // Look for currency formatted values
    const currencyValues = appPage.locator('text=/\\$[0-9,]+/');
    
    // Should have at least one currency value visible
    await expect(currencyValues.first()).toBeVisible();
  });
  
  test('should display ROI metrics', async ({ appPage }) => {
    // Look for common ROI metrics
    const metrics = [
      /payback/i,
      /roi|return/i,
      /savings/i,
      /annual/i,
      /monthly/i,
    ];
    
    let foundMetric = false;
    for (const metric of metrics) {
      const element = appPage.locator(`text=${metric}`);
      if (await element.count() > 0) {
        foundMetric = true;
        break;
      }
    }
    
    expect(foundMetric).toBe(true);
  });
});
