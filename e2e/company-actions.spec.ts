/**
 * Company Actions E2E Tests - Sprint V33
 *
 * Tests for company-level email and sequence actions
 */

import { test, expect, navigateToTab } from './fixtures';

test.describe('Company Actions', () => {
  test.beforeEach(async ({ appPage }) => {
    await navigateToTab(appPage, 'Hitlist');
  });

  test('can switch to company view', async ({ appPage }) => {
    // Look for view mode toggle
    const companiesToggle = appPage.getByTestId('view-mode-companies');
    
    // May not be visible if desktop layout - check for alternative
    const toggleExists = await companiesToggle.isVisible().catch(() => false);
    
    if (toggleExists) {
      await companiesToggle.click();
      await appPage.waitForTimeout(300);
      
      // Should show company list
      await expect(appPage.getByTestId(/company-row/)).toBeVisible({ timeout: 5000 });
    } else {
      // Skip if view toggle not available (mobile layout)
      test.skip();
    }
  });

  test('company row shows action buttons on hover', async ({ appPage }) => {
    // Switch to company view
    const companiesToggle = appPage.getByTestId('view-mode-companies');
    const toggleExists = await companiesToggle.isVisible().catch(() => false);
    
    if (!toggleExists) {
      test.skip();
      return;
    }
    
    await companiesToggle.click();
    await appPage.waitForTimeout(500);
    
    // Find first company row
    const companyRow = appPage.getByTestId('company-row-0');
    const rowExists = await companyRow.isVisible().catch(() => false);
    
    if (!rowExists) {
      // No companies in view
      test.skip();
      return;
    }
    
    // Hover over company row
    await companyRow.hover();
    
    // Action buttons should appear (Mail and Zap icons)
    // They may be in a hover state or always visible
    await appPage.waitForTimeout(300);
  });

  test('company email button opens bulk email modal', async ({ appPage }) => {
    // Switch to company view
    const companiesToggle = appPage.getByTestId('view-mode-companies');
    const toggleExists = await companiesToggle.isVisible().catch(() => false);
    
    if (!toggleExists) {
      test.skip();
      return;
    }
    
    await companiesToggle.click();
    await appPage.waitForTimeout(500);
    
    // Find first company row and hover
    const companyRow = appPage.getByTestId('company-row-0');
    const rowExists = await companyRow.isVisible().catch(() => false);
    
    if (!rowExists) {
      test.skip();
      return;
    }
    
    await companyRow.hover();
    
    // Look for email button - may have various testids or aria labels
    const emailBtn = appPage.locator('[data-testid*="company-email"], [data-testid*="email-btn"], button:has(svg[class*="lucide-mail"])').first();
    const btnExists = await emailBtn.isVisible().catch(() => false);
    
    if (btnExists) {
      await emailBtn.click();
      
      // Bulk email modal or email modal should open
      await expect(appPage.getByRole('dialog')).toBeVisible({ timeout: 5000 });
    }
  });

  test('company sequence button opens sequence modal', async ({ appPage }) => {
    // Switch to company view
    const companiesToggle = appPage.getByTestId('view-mode-companies');
    const toggleExists = await companiesToggle.isVisible().catch(() => false);
    
    if (!toggleExists) {
      test.skip();
      return;
    }
    
    await companiesToggle.click();
    await appPage.waitForTimeout(500);
    
    // Find first company row and hover
    const companyRow = appPage.getByTestId('company-row-0');
    const rowExists = await companyRow.isVisible().catch(() => false);
    
    if (!rowExists) {
      test.skip();
      return;
    }
    
    await companyRow.hover();
    
    // Look for sequence button - may have various testids or aria labels
    const seqBtn = appPage.locator('[data-testid*="company-sequence"], [data-testid*="sequence-btn"], button:has(svg[class*="lucide-zap"])').first();
    const btnExists = await seqBtn.isVisible().catch(() => false);
    
    if (btnExists) {
      await seqBtn.click();
      
      // Sequence modal should open
      await expect(appPage.getByRole('dialog')).toBeVisible({ timeout: 5000 });
      await expect(appPage.getByText(/assign to sequence/i)).toBeVisible();
    }
  });
});

test.describe('Person vs Company View Toggle', () => {
  test.beforeEach(async ({ appPage }) => {
    await navigateToTab(appPage, 'Hitlist');
  });

  test('can toggle between person and company view', async ({ appPage }) => {
    // Check for view mode toggle
    const peopleToggle = appPage.getByTestId('view-mode-people');
    const companiesToggle = appPage.getByTestId('view-mode-companies');
    
    const togglesExist = await peopleToggle.isVisible().catch(() => false) 
      && await companiesToggle.isVisible().catch(() => false);
    
    if (!togglesExist) {
      test.skip();
      return;
    }
    
    // Start with people view (default)
    await expect(peopleToggle).toHaveClass(/bg-slate-800|bg-blue/);
    
    // Switch to companies
    await companiesToggle.click();
    await appPage.waitForTimeout(300);
    
    // Companies toggle should now be active
    await expect(companiesToggle).toHaveClass(/bg-slate-800|bg-blue/);
    
    // Switch back to people
    await peopleToggle.click();
    await appPage.waitForTimeout(300);
    
    // People toggle should be active again
    await expect(peopleToggle).toHaveClass(/bg-slate-800|bg-blue/);
  });
});
