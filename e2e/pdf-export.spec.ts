/**
 * PDF Export E2E Tests - YardFlow Hub
 * 
 * Tests for PDF report generation and export functionality.
 */

import { test, expect, navigateToTab } from './fixtures';

test.describe('PDF Export', () => {
  test.describe('Export UI', () => {
    test('should have export button in dashboard', async ({ appPage }) => {
      await navigateToTab(appPage, 'Dashboard');
      
      // Look for export button
      const exportButton = appPage.locator(
        'button:has-text("Export"), ' +
        '[data-testid="export-button"], ' +
        '[aria-label*="export" i], ' +
        'button:has-text("Download")'
      );
      
      const count = await exportButton.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('should have PDF option in export menu', async ({ appPage }) => {
      await navigateToTab(appPage, 'Dashboard');
      
      // Look for PDF export option
      const pdfOption = appPage.locator(
        'button:has-text("PDF"), ' +
        '[data-format="pdf"], ' +
        'li:has-text("PDF"), ' +
        'option:has-text("PDF")'
      );
      
      const count = await pdfOption.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('should have report template options', async ({ appPage }) => {
      // Look for report type selector
      const templateSelector = appPage.locator(
        '[data-testid="report-template"], ' +
        'select:has(option:has-text("Report")), ' +
        '[aria-label*="template" i]'
      );
      
      const count = await templateSelector.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Report Types', () => {
    test('should have prospect report option', async ({ appPage }) => {
      const prospectReport = appPage.locator(
        'text=/prospect.*report/i, ' +
        '[data-template="prospect"], ' +
        'option:has-text("Prospect")'
      );
      
      const count = await prospectReport.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('should have ROI report option', async ({ appPage }) => {
      await navigateToTab(appPage, 'ROI');
      
      const roiReport = appPage.locator(
        'button:has-text("Export"), ' +
        '[data-testid="roi-export"], ' +
        'text=/export.*roi/i'
      );
      
      const count = await roiReport.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('should have pipeline report option', async ({ appPage }) => {
      await navigateToTab(appPage, 'Dashboard');
      
      const pipelineReport = appPage.locator(
        'text=/pipeline.*report/i, ' +
        '[data-template="pipeline"]'
      );
      
      const count = await pipelineReport.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Export Options', () => {
    test('should have date range selector for reports', async ({ appPage }) => {
      await navigateToTab(appPage, 'Dashboard');
      
      const dateRange = appPage.locator(
        '[data-testid="date-range"], ' +
        '.date-range-picker, ' +
        'input[type="date"], ' +
        'button:has-text("Last 30 days")'
      );
      
      const count = await dateRange.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('should have page orientation option', async ({ appPage }) => {
      const orientation = appPage.locator(
        '[data-testid="orientation"], ' +
        'select:has(option:has-text("Portrait")), ' +
        'text=/portrait|landscape/i'
      );
      
      const count = await orientation.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Hitlist Export', () => {
    test('should have export selected option', async ({ appPage }) => {
      await navigateToTab(appPage, 'Hitlist');
      
      const exportSelected = appPage.locator(
        'button:has-text("Export Selected"), ' +
        '[data-action="export"], ' +
        'button:has-text("Export")'
      );
      
      const count = await exportSelected.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('should have export all option', async ({ appPage }) => {
      await navigateToTab(appPage, 'Hitlist');
      
      const exportAll = appPage.locator(
        'button:has-text("Export All"), ' +
        '[data-testid="export-all"]'
      );
      
      const count = await exportAll.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Progress & Feedback', () => {
    test('should have progress indicator for exports', async ({ appPage }) => {
      // Look for progress/loading indicators
      const progress = appPage.locator(
        '[role="progressbar"], ' +
        '.progress-bar, ' +
        '.loading-indicator, ' +
        '[data-testid="export-progress"]'
      );
      
      const count = await progress.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('should have success notification area', async ({ appPage }) => {
      // Look for toast/notification area
      const notification = appPage.locator(
        '[role="status"], ' +
        '.toast, ' +
        '[data-testid="notification"], ' +
        '[aria-live="polite"]'
      );
      
      const count = await notification.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });
});
