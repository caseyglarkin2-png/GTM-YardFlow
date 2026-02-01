/**
 * Bulk Operations E2E Tests - YardFlow Hub
 *
 * Focused coverage for selection, toolbar actions, modals, export, delete/undo, and keyboard a11y.
 */

import { test, expect, navigateToTab } from './fixtures';
import type { Page } from '@playwright/test';

const rowCheckboxes = (page: Page) => page.locator('[data-testid^="row-checkbox-"]');

test.describe('Bulk Operations', () => {
  test.beforeEach(async ({ appPage }) => {
    await navigateToTab(appPage, 'Hitlist');
  });

  test('single select surfaces toolbar', async ({ appPage }) => {
    const first = rowCheckboxes(appPage).first();
    await first.click();

    await expect(appPage.getByTestId('bulk-actions-toolbar')).toBeVisible();
    await expect(appPage.getByTestId('selection-count')).toContainText('1');
  });

  test('select all and clear selection', async ({ appPage }) => {
    const headerCheckbox = appPage.getByTestId('select-all-checkbox');
    const rows = rowCheckboxes(appPage);
    const total = await rows.count();

    await headerCheckbox.click();
    if (total > 0) {
      await expect(appPage.getByTestId('selection-count')).toContainText(String(total));
    }

    await appPage.getByTestId('bulk-clear-selection').click();
    await expect(appPage.getByTestId('bulk-actions-toolbar')).toBeHidden();
  });

  test('shift+click selects a range', async ({ appPage }) => {
    const rows = rowCheckboxes(appPage);
    const count = await rows.count();
    expect(count).toBeGreaterThanOrEqual(3);

    await rows.first().click();
    await rows.nth(2).click({ modifiers: ['Shift'] });

    await expect(rows.locator(':checked')).toHaveCount(3);
  });

  test('assign sequence through modal', async ({ appPage }) => {
    await rowCheckboxes(appPage).first().click();
    await appPage.getByTestId('bulk-assign-sequence').click();

    const option = appPage.getByTestId('sequence-option-seq-1');
    await option.click();
    await appPage.getByTestId('sequence-modal-confirm').click();

    await expect(appPage.getByTestId('bulk-actions-toolbar')).toBeHidden();
  });

  test('add tag to selection', async ({ appPage }) => {
    await rowCheckboxes(appPage).first().click();
    await appPage.getByTestId('bulk-add-tag').click();

    await appPage.getByTestId('tag-option-manifest-2026').click();
    await appPage.getByTestId('tag-modal-confirm').click();

    await expect(appPage.getByTestId('bulk-actions-toolbar')).toBeHidden();
  });

  test('export downloads CSV', async ({ appPage }) => {
    await rowCheckboxes(appPage).first().click();

    const downloadPromise = appPage.waitForEvent('download');
    await appPage.getByTestId('bulk-export').click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toContain('yardflow-prospects');
  });

  test('delete selection and undo restores', async ({ appPage }) => {
    const rows = rowCheckboxes(appPage);
    await rows.first().click();
    await rows.nth(1).click();

    await appPage.getByTestId('bulk-delete').click();
    await appPage.getByTestId('delete-modal-confirm').click();

    await expect(appPage.getByTestId('undo-toast')).toBeVisible();
    await appPage.getByTestId('undo-button').click();
    await expect(appPage.getByTestId('undo-toast')).toBeHidden();
  });

  test('keyboard space toggles selection on focused row', async ({ appPage }) => {
    const firstRow = appPage.locator('[role="row"]').nth(1); // skip header row
    await firstRow.focus();
    await appPage.keyboard.press('Space');

    await expect(appPage.getByTestId('bulk-actions-toolbar')).toBeVisible();
    await expect(rowCheckboxes(appPage).first()).toBeChecked();
  });
});
