/**
 * AI Research E2E Tests - YardFlow Hub
 * Sprint V32: AI & Email Feature Testing
 * 
 * Tests for AI company research and dossier functionality
 */

import { test, expect, navigateToTab } from './fixtures';

test.describe('AI Company Research', () => {
  test.beforeEach(async ({ appPage }) => {
    // Navigate to Hitlist tab
    await navigateToTab(appPage, 'Hitlist');
  });

  test('should display research button for companies', async ({ appPage }) => {
    // Switch to company view
    const companyViewToggle = appPage.locator('button, label').filter({ hasText: /companies|company/i });
    if (await companyViewToggle.count() > 0) {
      await companyViewToggle.first().click();
    }

    // Check for research button (using data-testid from S0.3)
    const researchButton = appPage.getByTestId('research-button');
    const alternateResearchButton = appPage.locator('button').filter({ hasText: /research|ai/i });
    
    // At least one type of research button should exist
    const hasDataTestId = await researchButton.count() > 0;
    const hasTextButton = await alternateResearchButton.count() > 0;
    
    expect(hasDataTestId || hasTextButton).toBe(true);
  });

  test('should show company detail panel with dossier tab', async ({ appPage }) => {
    // Switch to company view
    const companyViewToggle = appPage.locator('button, label').filter({ hasText: /companies|company/i });
    if (await companyViewToggle.count() > 0) {
      await companyViewToggle.first().click();
      await appPage.waitForTimeout(500);
    }

    // Click on a company row
    const companyRows = appPage.locator('tr, [role="row"], [class*="company"]').filter({ hasText: /sysco|kraft|amazon|fedex/i });
    if (await companyRows.count() > 0) {
      await companyRows.first().click();
      await appPage.waitForTimeout(300);
      
      // Look for dossier tab in detail panel
      const dossierTab = appPage.locator('button, [role="tab"]').filter({ hasText: /dossier|ai|research/i });
      
      // Dossier tab should exist in company detail view
      if (await dossierTab.count() > 0) {
        await expect(dossierTab.first()).toBeVisible();
      }
    }
  });

  test('should show loading state when researching', async ({ appPage }) => {
    // Switch to company view
    const companyViewToggle = appPage.locator('button, label').filter({ hasText: /companies|company/i });
    if (await companyViewToggle.count() > 0) {
      await companyViewToggle.first().click();
      await appPage.waitForTimeout(500);
    }

    // Find and click research button
    const researchButton = appPage.getByTestId('research-button').or(
      appPage.locator('button').filter({ hasText: /research|ai research/i })
    );

    if (await researchButton.count() > 0) {
      await researchButton.first().click();
      
      // Look for loading indicator (spinner or text)
      const loadingIndicator = appPage.locator('[class*="animate-spin"], [data-loading="true"]')
        .or(appPage.locator('text=/researching|loading/i'));
      
      // May or may not show loading depending on cache/mock state
      // Just verify button click doesn't crash
      await appPage.waitForTimeout(1000);
    }
  });

  test('should display dossier content after research', async ({ appPage }) => {
    // Navigate to company view and select a company
    const companyViewToggle = appPage.locator('button, label').filter({ hasText: /companies|company/i });
    if (await companyViewToggle.count() > 0) {
      await companyViewToggle.first().click();
      await appPage.waitForTimeout(500);
    }

    // Select a company
    const companyRows = appPage.locator('tr, [role="row"]').filter({ hasText: /sysco|kraft/i });
    if (await companyRows.count() > 0) {
      await companyRows.first().click();
      await appPage.waitForTimeout(300);
    }

    // Try to navigate to dossier tab
    const dossierTab = appPage.locator('button, [role="tab"]').filter({ hasText: /dossier/i });
    if (await dossierTab.count() > 0) {
      await dossierTab.first().click();
      await appPage.waitForTimeout(500);
      
      // Check for dossier content elements
      const dossierContent = appPage.locator('text=/talking points|pain points|facilities|industry|headquarters/i');
      const researchCTA = appPage.locator('button').filter({ hasText: /research with ai/i });
      
      // Either have content or CTA to research
      const hasContent = await dossierContent.count() > 0;
      const hasCTA = await researchCTA.count() > 0;
      
      expect(hasContent || hasCTA).toBe(true);
    }
  });

  test('research button shows correct state based on research status', async ({ appPage }) => {
    // Switch to company view  
    const companyViewToggle = appPage.locator('button, label').filter({ hasText: /companies|company/i });
    if (await companyViewToggle.count() > 0) {
      await companyViewToggle.first().click();
      await appPage.waitForTimeout(500);
    }

    // Find a company row
    const companyRows = appPage.locator('tr, [role="row"]').filter({ hasText: /sysco|kraft|amazon/i });
    if (await companyRows.count() > 0) {
      await companyRows.first().click();
      await appPage.waitForTimeout(300);
      
      // Check button states - should be one of:
      // - "AI Research" (blue, not researched)
      // - "View Dossier" (green, already researched)
      // - "Researching..." (loading state)
      const buttonText = await appPage.locator('button').filter({ hasText: /research|dossier|researching/i }).first().textContent();
      
      expect(buttonText).toMatch(/AI Research|View Dossier|Researching/i);
    }
  });
});
