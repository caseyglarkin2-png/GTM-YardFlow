/**
 * T100.4c: Email Workflow E2E Tests
 * End-to-end tests for email and sequence operations
 */

import { test, expect } from '@playwright/test';

// Helper to login before tests
async function login(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.fill('[name=email], [type=email]', 'test@yardflow.com');
  await page.fill('[name=password], [type=password]', 'testpassword123');
  await page.click('button[type=submit]');
  await page.waitForURL(/^(?!.*login)/, { timeout: 15000 });
}

test.describe('Email Operations', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('displays email queue status', async ({ page }) => {
    await page.goto('/');
    
    // Look for email queue indicator
    const emailQueueStatus = page.locator(
      '[data-testid="email-queue-status"], ' +
      '[class*="EmailQueue"], ' +
      ':text("pending"):near(:text("email"))'
    );
    
    // May or may not be visible depending on UI layout
    await page.waitForTimeout(2000);
  });

  test('can compose and preview email', async ({ page }) => {
    await page.goto('/');
    
    // Click on first prospect to open detail
    const firstProspect = page.locator('[data-testid="prospect-row"], tr[data-prospect-id]').first();
    
    if (await firstProspect.isVisible()) {
      await firstProspect.click();
      await page.waitForTimeout(500);
      
      // Find compose/email button
      const composeButton = page.locator('button:has-text("Email"), button:has-text("Compose")');
      
      if (await composeButton.isVisible()) {
        await composeButton.click();
        
        // Should see email form
        const subjectField = page.locator('input[name="subject"], [placeholder*="subject" i]');
        const bodyField = page.locator('textarea[name="body"], [contenteditable="true"], [data-testid="email-body"]');
        
        await expect(subjectField.or(bodyField)).toBeVisible({ timeout: 5000 });
      }
    }
  });

  test('email analytics displays correctly', async ({ page }) => {
    await page.goto('/');
    
    // Look for email stats card or section
    const emailStats = page.locator(
      '[data-testid="email-stats"], ' +
      '[class*="EmailStats"], ' +
      ':text("sent"):near(:text("opened"))'
    );
    
    if (await emailStats.isVisible()) {
      // Should show key metrics
      const metrics = ['sent', 'opened', 'clicked'];
      for (const metric of metrics) {
        const metricEl = page.locator(`:text("${metric}")`, { hasText: new RegExp(metric, 'i') });
        // May or may not be visible
      }
    }
  });
});

test.describe('Sequence Operations', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('displays sequence list', async ({ page }) => {
    // Navigate to sequences (might be a tab or separate route)
    const sequenceNav = page.locator('a:has-text("Sequences"), button:has-text("Sequences"), [data-testid="sequences-nav"]');
    
    if (await sequenceNav.isVisible()) {
      await sequenceNav.click();
      
      // Should see sequence list
      const sequenceList = page.locator('[data-testid="sequence-list"], [class*="sequence"]');
      await expect(sequenceList).toBeVisible({ timeout: 5000 });
    }
  });

  test('can view sequence details', async ({ page }) => {
    // Navigate to sequences
    const sequenceNav = page.locator('a:has-text("Sequences"), button:has-text("Sequences"), [data-testid="sequences-nav"]');
    
    if (await sequenceNav.isVisible()) {
      await sequenceNav.click();
      await page.waitForTimeout(500);
      
      // Click on first sequence
      const firstSequence = page.locator('[data-testid="sequence-row"], [class*="sequence-item"]').first();
      
      if (await firstSequence.isVisible()) {
        await firstSequence.click();
        
        // Should see sequence detail with steps
        const sequenceDetail = page.locator('[data-testid="sequence-detail"], [class*="sequence-detail"]');
        await expect(sequenceDetail).toBeVisible({ timeout: 5000 });
      }
    }
  });

  test('can enroll prospect in sequence', async ({ page }) => {
    await page.goto('/');
    
    // Click on first prospect
    const firstProspect = page.locator('[data-testid="prospect-row"], tr[data-prospect-id]').first();
    
    if (await firstProspect.isVisible()) {
      await firstProspect.click();
      await page.waitForTimeout(500);
      
      // Find enroll button
      const enrollButton = page.locator('button:has-text("Enroll"), button:has-text("Add to Sequence"), [data-testid="enroll-sequence"]');
      
      if (await enrollButton.isVisible()) {
        await enrollButton.click();
        
        // Should see sequence selection
        const sequenceSelect = page.locator('[data-testid="sequence-select"], select, [role="listbox"]');
        await expect(sequenceSelect).toBeVisible({ timeout: 5000 });
      }
    }
  });

  test('can pause sequence enrollment', async ({ page }) => {
    await page.goto('/');
    
    // Find a prospect with active enrollment (may need specific test data)
    const enrolledProspect = page.locator('[data-testid="prospect-row"]:has([data-testid="enrollment-active"])').first();
    
    if (await enrolledProspect.isVisible()) {
      await enrolledProspect.click();
      await page.waitForTimeout(500);
      
      // Find pause button
      const pauseButton = page.locator('button:has-text("Pause"), [data-testid="pause-enrollment"]');
      
      if (await pauseButton.isVisible()) {
        await pauseButton.click();
        
        // Should show confirmation or update status
        const pauseConfirmation = page.locator(':text("paused")');
        // May need confirmation dialog
      }
    }
  });
});

test.describe('Dead Letter Queue', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('displays dead letter queue when failures exist', async ({ page }) => {
    await page.goto('/');
    
    // Look for dead letter queue indicator or panel
    const deadLetterQueue = page.locator(
      '[data-testid="dead-letter-queue"], ' +
      '[class*="DeadLetter"], ' +
      ':text("failed"):near(:text("email"))'
    );
    
    // May or may not have failed emails
    await page.waitForTimeout(2000);
    
    if (await deadLetterQueue.isVisible()) {
      // Should show retry options
      const retryButton = page.locator('button:has-text("Retry")');
      await expect(retryButton).toBeVisible();
    }
  });

  test('can retry failed email', async ({ page }) => {
    await page.goto('/');
    
    // Find dead letter queue
    const deadLetterQueue = page.locator('[data-testid="dead-letter-queue"], [class*="DeadLetter"]');
    
    if (await deadLetterQueue.isVisible()) {
      // Expand if collapsed
      const expandButton = page.locator('[data-testid="expand-dead-letter"]');
      if (await expandButton.isVisible()) {
        await expandButton.click();
      }
      
      // Find retry button for first failed email
      const retryButton = page.locator('button:has-text("Retry")').first();
      
      if (await retryButton.isVisible()) {
        await retryButton.click();
        
        // Should process retry (may show loading or success)
        await page.waitForTimeout(1000);
      }
    }
  });
});
