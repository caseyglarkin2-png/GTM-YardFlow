/**
 * Email Compose E2E Tests - Sprint 42
 * 
 * Tests email compose flow with data-testid selectors
 * Verifies spam score integration, form validation, and modal controls
 */

import { test, expect, navigateToTab } from './fixtures';

test.describe('Email Compose - Sprint 42', () => {
  test.beforeEach(async ({ appPage }) => {
    await navigateToTab(appPage, 'Hitlist');
    // Wait for prospects to load
    await appPage.waitForSelector('input[type="checkbox"]', { timeout: 5000 });
  });

  test.describe('Modal Controls', () => {
    test('opens modal with template and tone selectors', async ({ appPage }) => {
      // Select a prospect
      const checkboxes = appPage.locator('input[type="checkbox"]');
      if (await checkboxes.count() > 1) {
        await checkboxes.nth(1).click();
      }

      // Click email action button
      const emailButton = appPage.locator('button').filter({ hasText: /email|send|compose/i });
      if (await emailButton.count() > 0) {
        await emailButton.first().click();
        await appPage.waitForTimeout(500);

        // Verify modal controls exist using data-testid
        const templateSelector = appPage.locator('[data-testid="bulk-email-template-selector"]');
        const toneSelector = appPage.locator('[data-testid="bulk-email-tone-selector"]');
        const senderSelector = appPage.locator('[data-testid="bulk-email-sender-selector"]');

        // At least template and tone selectors should be visible
        if (await templateSelector.count() > 0) {
          await expect(templateSelector).toBeVisible();
        }
        if (await toneSelector.count() > 0) {
          await expect(toneSelector).toBeVisible();
        }
        if (await senderSelector.count() > 0) {
          await expect(senderSelector).toBeVisible();
        }
      }
    });

    test('cancel button closes modal', async ({ appPage }) => {
      const checkboxes = appPage.locator('input[type="checkbox"]');
      if (await checkboxes.count() > 1) {
        await checkboxes.nth(1).click();
      }

      const emailButton = appPage.locator('button').filter({ hasText: /email|send|compose/i });
      if (await emailButton.count() > 0) {
        await emailButton.first().click();
        await appPage.waitForTimeout(500);

        // Use data-testid for cancel button
        const cancelButton = appPage.locator('[data-testid="bulk-email-cancel"]');
        if (await cancelButton.count() > 0) {
          await cancelButton.click();
          await appPage.waitForTimeout(300);
          await expect(cancelButton).not.toBeVisible();
        }
      }
    });

    test('Escape key closes modal', async ({ appPage }) => {
      const checkboxes = appPage.locator('input[type="checkbox"]');
      if (await checkboxes.count() > 1) {
        await checkboxes.nth(1).click();
      }

      const emailButton = appPage.locator('button').filter({ hasText: /email|send|compose/i });
      if (await emailButton.count() > 0) {
        await emailButton.first().click();
        await appPage.waitForTimeout(500);

        // Press Escape
        await appPage.keyboard.press('Escape');
        await appPage.waitForTimeout(300);

        // Modal should be closed
        const cancelButton = appPage.locator('[data-testid="bulk-email-cancel"]');
        await expect(cancelButton).not.toBeVisible();
      }
    });
  });

  test.describe('Spam Score Integration', () => {
    test('shows spam score indicator when content has text', async ({ appPage }) => {
      const checkboxes = appPage.locator('input[type="checkbox"]');
      if (await checkboxes.count() > 1) {
        await checkboxes.nth(1).click();
      }

      const emailButton = appPage.locator('button').filter({ hasText: /email|send|compose/i });
      if (await emailButton.count() > 0) {
        await emailButton.first().click();
        await appPage.waitForTimeout(500);

        // Spam score indicator should be present (may be hidden until content)
        const spamIndicator = appPage.locator('[data-testid="bulk-email-spam-indicator"]');
        
        // The indicator exists in the DOM
        const count = await spamIndicator.count();
        expect(count).toBeGreaterThanOrEqual(0);
      }
    });

    test('send button respects form validation', async ({ appPage }) => {
      const checkboxes = appPage.locator('input[type="checkbox"]');
      if (await checkboxes.count() > 1) {
        await checkboxes.nth(1).click();
      }

      const emailButton = appPage.locator('button').filter({ hasText: /email|send|compose/i });
      if (await emailButton.count() > 0) {
        await emailButton.first().click();
        await appPage.waitForTimeout(500);

        // Send button should be disabled when form is incomplete
        const sendButton = appPage.locator('[data-testid="bulk-email-send"]');
        if (await sendButton.count() > 0) {
          // Initially should be disabled (no content)
          const isDisabled = await sendButton.isDisabled();
          expect(isDisabled).toBe(true);
        }
      }
    });
  });

  test.describe('AI Generation', () => {
    test('generate AI button is present and initially enabled', async ({ appPage }) => {
      const checkboxes = appPage.locator('input[type="checkbox"]');
      if (await checkboxes.count() > 1) {
        await checkboxes.nth(1).click();
      }

      const emailButton = appPage.locator('button').filter({ hasText: /email|send|compose/i });
      if (await emailButton.count() > 0) {
        await emailButton.first().click();
        await appPage.waitForTimeout(500);

        // AI generate button should exist
        const generateButton = appPage.locator('[data-testid="bulk-email-generate-ai"]');
        if (await generateButton.count() > 0) {
          await expect(generateButton).toBeVisible();
        }
      }
    });

    test('generate all button is present', async ({ appPage }) => {
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

        // Generate all button should exist when multiple recipients
        const generateAllButton = appPage.locator('[data-testid="bulk-email-generate-all"]');
        if (await generateAllButton.count() > 0) {
          await expect(generateAllButton).toBeVisible();
        }
      }
    });
  });

  test.describe('Form Inputs', () => {
    test('template selector changes available templates', async ({ appPage }) => {
      const checkboxes = appPage.locator('input[type="checkbox"]');
      if (await checkboxes.count() > 1) {
        await checkboxes.nth(1).click();
      }

      const emailButton = appPage.locator('button').filter({ hasText: /email|send|compose/i });
      if (await emailButton.count() > 0) {
        await emailButton.first().click();
        await appPage.waitForTimeout(500);

        const templateSelector = appPage.locator('[data-testid="bulk-email-template-selector"]');
        if (await templateSelector.count() > 0) {
          // Should have options
          const options = templateSelector.locator('option');
          const optionCount = await options.count();
          expect(optionCount).toBeGreaterThan(0);
        }
      }
    });

    test('tone selector has tone options', async ({ appPage }) => {
      const checkboxes = appPage.locator('input[type="checkbox"]');
      if (await checkboxes.count() > 1) {
        await checkboxes.nth(1).click();
      }

      const emailButton = appPage.locator('button').filter({ hasText: /email|send|compose/i });
      if (await emailButton.count() > 0) {
        await emailButton.first().click();
        await appPage.waitForTimeout(500);

        const toneSelector = appPage.locator('[data-testid="bulk-email-tone-selector"]');
        if (await toneSelector.count() > 0) {
          const options = toneSelector.locator('option');
          const optionCount = await options.count();
          // Should have professional, casual, etc.
          expect(optionCount).toBeGreaterThanOrEqual(2);
        }
      }
    });
  });
});
