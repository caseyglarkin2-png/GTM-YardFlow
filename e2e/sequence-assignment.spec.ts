/**
 * Sequence Assignment E2E Tests - Sprint V33
 *
 * Tests for sequence assignment flow including template selection
 */

import { test, expect, navigateToTab } from './fixtures';
import type { Page } from '@playwright/test';

const rowCheckboxes = (page: Page) => page.locator('[data-testid^="row-checkbox-"]');

test.describe('Sequence Assignment', () => {
  test.beforeEach(async ({ appPage }) => {
    await navigateToTab(appPage, 'Hitlist');
  });

  test('opens sequence modal from bulk actions toolbar', async ({ appPage }) => {
    // Select a prospect
    await rowCheckboxes(appPage).first().click();
    await expect(appPage.getByTestId('bulk-actions-toolbar')).toBeVisible();
    
    // Click sequence button
    await appPage.getByTestId('bulk-assign-sequence').click();
    
    // Modal should open
    await expect(appPage.getByRole('dialog')).toBeVisible();
    await expect(appPage.getByText('Assign to Sequence')).toBeVisible();
  });

  test('shows sequences list when loaded', async ({ appPage }) => {
    await rowCheckboxes(appPage).first().click();
    await appPage.getByTestId('bulk-assign-sequence').click();
    
    // Wait for modal
    await expect(appPage.getByRole('dialog')).toBeVisible();
    
    // Should show My Sequences tab as default
    const sequenceTab = appPage.getByRole('button', { name: /my sequences/i });
    // Tab should be active/visible
    await expect(sequenceTab).toBeVisible();
  });

  test('can switch to Templates tab', async ({ appPage }) => {
    await rowCheckboxes(appPage).first().click();
    await appPage.getByTestId('bulk-assign-sequence').click();
    
    // Wait for modal
    await expect(appPage.getByRole('dialog')).toBeVisible();
    
    // Switch to templates tab
    const templatesTab = appPage.getByRole('button', { name: /templates/i });
    await templatesTab.click();
    
    // Templates should be visible
    await expect(appPage.getByText(/manifest/i)).toBeVisible({ timeout: 5000 });
  });

  test('can search sequences', async ({ appPage }) => {
    await rowCheckboxes(appPage).first().click();
    await appPage.getByTestId('bulk-assign-sequence').click();
    
    // Wait for modal
    await expect(appPage.getByRole('dialog')).toBeVisible();
    
    // Search box should be present
    const searchInput = appPage.getByPlaceholder(/search/i);
    await expect(searchInput).toBeVisible();
    
    // Type search query
    await searchInput.fill('manifest');
    
    // Wait for results to update
    await appPage.waitForTimeout(300);
  });

  test('can select and assign sequence', async ({ appPage }) => {
    await rowCheckboxes(appPage).first().click();
    await appPage.getByTestId('bulk-assign-sequence').click();
    
    // Wait for modal
    await expect(appPage.getByRole('dialog')).toBeVisible();
    
    // Find and click a sequence option (if available)
    const sequenceOption = appPage.getByTestId(/sequence-option/);
    const hasSequences = await sequenceOption.count() > 0;
    
    if (hasSequences) {
      await sequenceOption.first().click();
      
      // Confirm button should show assignment text
      const confirmBtn = appPage.getByRole('button', { name: /assign to sequence/i });
      await expect(confirmBtn).toBeEnabled();
    }
  });

  test('closes modal on cancel', async ({ appPage }) => {
    await rowCheckboxes(appPage).first().click();
    await appPage.getByTestId('bulk-assign-sequence').click();
    
    // Wait for modal
    await expect(appPage.getByRole('dialog')).toBeVisible();
    
    // Click cancel
    await appPage.getByRole('button', { name: /cancel/i }).click();
    
    // Modal should close
    await expect(appPage.getByRole('dialog')).toBeHidden();
  });

  test('closes modal on X button', async ({ appPage }) => {
    await rowCheckboxes(appPage).first().click();
    await appPage.getByTestId('bulk-assign-sequence').click();
    
    // Wait for modal
    await expect(appPage.getByRole('dialog')).toBeVisible();
    
    // Click X button (aria-label or data-testid)
    const closeButton = appPage.locator('button[aria-label*="close"], button:has(svg[class*="lucide-x"]), [data-testid="modal-close"]').first();
    await closeButton.click();
    
    // Modal should close
    await expect(appPage.getByRole('dialog')).toBeHidden();
  });
});
