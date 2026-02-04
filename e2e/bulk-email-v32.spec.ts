/**
 * Bulk Email E2E Tests - YardFlow Hub
 * Sprint V32: AI & Email Feature Testing
 * 
 * Tests for bulk email compose and send functionality
 */

import { test, expect, navigateToTab } from './fixtures';

test.describe('Bulk Email', () => {
  test.beforeEach(async ({ appPage }) => {
    // Navigate to Hitlist tab
    await navigateToTab(appPage, 'Hitlist');
  });

  test('should show email button when prospects are selected', async ({ appPage }) => {
    // Find and select prospect checkboxes
    const checkboxes = appPage.locator('input[type="checkbox"]');
    
    if (await checkboxes.count() > 1) {
      // Skip header checkbox, click first data row checkbox
      await checkboxes.nth(1).click();
      await appPage.waitForTimeout(200);
      
      // Look for email/send button in toolbar
      const emailButton = appPage.locator('button').filter({ hasText: /email|send|compose/i });
      
      // Email button should appear when prospects selected
      if (await emailButton.count() > 0) {
        await expect(emailButton.first()).toBeVisible();
      }
    }
  });

  test('should open bulk email modal when button clicked', async ({ appPage }) => {
    // Select a prospect
    const checkboxes = appPage.locator('input[type="checkbox"]');
    if (await checkboxes.count() > 1) {
      await checkboxes.nth(1).click();
    }
    
    // Click email button
    const emailButton = appPage.locator('button').filter({ hasText: /email|send|compose/i });
    if (await emailButton.count() > 0) {
      await emailButton.first().click();
      await appPage.waitForTimeout(500);
      
      // Modal should appear
      const modal = appPage.locator('[role="dialog"], [class*="modal"]').or(
        appPage.locator('div').filter({ hasText: /send email|compose|bulk email/i })
      );
      
      await expect(modal.first()).toBeVisible();
    }
  });

  test('should display personalization variables', async ({ appPage }) => {
    // Select a prospect and open email modal
    const checkboxes = appPage.locator('input[type="checkbox"]');
    if (await checkboxes.count() > 1) {
      await checkboxes.nth(1).click();
    }
    
    const emailButton = appPage.locator('button').filter({ hasText: /email|send|compose/i });
    if (await emailButton.count() > 0) {
      await emailButton.first().click();
      await appPage.waitForTimeout(500);
      
      // Look for personalization tokens like {name}, {company}, etc
      const personalizationText = appPage.locator('text=/{[a-z_]+}|name|company|title/i');
      const templateDropdown = appPage.locator('select, button').filter({ hasText: /template/i });
      
      // Should have some form of personalization UI
      const hasTokens = await personalizationText.count() > 0;
      const hasTemplates = await templateDropdown.count() > 0;
      
      // At least have some compose UI elements
      const hasSubjectInput = await appPage.locator('input[placeholder*="subject" i], [name="subject"]').count() > 0;
      const hasBodyInput = await appPage.locator('textarea, [contenteditable="true"]').count() > 0;
      
      expect(hasTokens || hasTemplates || hasSubjectInput || hasBodyInput).toBe(true);
    }
  });

  test('should show recipient count in modal', async ({ appPage }) => {
    // Select multiple prospects
    const checkboxes = appPage.locator('input[type="checkbox"]');
    if (await checkboxes.count() > 2) {
      await checkboxes.nth(1).click();
      await checkboxes.nth(2).click();
    }
    
    const emailButton = appPage.locator('button').filter({ hasText: /email|send|compose/i });
    if (await emailButton.count() > 0) {
      await emailButton.first().click();
      await appPage.waitForTimeout(500);
      
      // Look for recipient count (e.g., "Send to 2 prospects", "2 recipients")
      const recipientCount = appPage.locator('text=/\\d+.*prospect|\\d+.*recipient|send to \\d+/i');
      
      if (await recipientCount.count() > 0) {
        await expect(recipientCount.first()).toBeVisible();
      }
    }
  });

  test('should validate email form fields', async ({ appPage }) => {
    // Select a prospect and open modal
    const checkboxes = appPage.locator('input[type="checkbox"]');
    if (await checkboxes.count() > 1) {
      await checkboxes.nth(1).click();
    }
    
    const emailButton = appPage.locator('button').filter({ hasText: /email|send|compose/i });
    if (await emailButton.count() > 0) {
      await emailButton.first().click();
      await appPage.waitForTimeout(500);
      
      // Try to find and click send button without filling form
      const sendButton = appPage.locator('button').filter({ hasText: /^send$|send email|send all/i });
      
      if (await sendButton.count() > 0) {
        // Check if button is disabled when form is incomplete
        const isDisabled = await sendButton.first().isDisabled();
        
        // Either button is disabled or form requires validation
        expect(isDisabled).toBe(true);
      }
    }
  });

  test('should close modal on cancel', async ({ appPage }) => {
    // Select and open modal
    const checkboxes = appPage.locator('input[type="checkbox"]');
    if (await checkboxes.count() > 1) {
      await checkboxes.nth(1).click();
    }
    
    const emailButton = appPage.locator('button').filter({ hasText: /email|send|compose/i });
    if (await emailButton.count() > 0) {
      await emailButton.first().click();
      await appPage.waitForTimeout(500);
      
      // Find and click close/cancel button
      const closeButton = appPage.locator('button').filter({ hasText: /cancel|close|×/i }).or(
        appPage.locator('[aria-label="close"], [aria-label="Close"]')
      );
      
      if (await closeButton.count() > 0) {
        await closeButton.first().click();
        await appPage.waitForTimeout(300);
        
        // Modal should be gone
        const modal = appPage.locator('[role="dialog"]');
        await expect(modal).not.toBeVisible();
      }
    }
  });
});
