import { test, expect } from '@playwright/test';

test.describe('Sequence Builder Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to local dev URL
    await page.goto('/');
    
    // Wait for app to be ready
    await page.waitForSelector('nav');
    
    // Navigate to Sequences tab
    await page.getByText('Sequences').click();
  });

  test('should create a new sequence from scratch', async ({ page }) => {
    // 1. Open Builder
    await page.getByText('New Sequence').click();
    await expect(page.getByText('Sequence Name')).toBeVisible();

    // 2. Name the sequence
    const sequenceName = `E2E Test Sequence ${Date.now()}`;
    const nameInput = page.getByPlaceholder('Sequence Name');
    await nameInput.fill(sequenceName);

    // 3. Edit initial step
    await page.getByPlaceholder('Enter subject line...').fill('Hello {{firstName}}');
    await page.getByPlaceholder('Write your email content...').fill('This is a test email.');

    // 4. Add a step
    await page.getByText('Add Step').click();
    
    // 5. Configure second step
    const steps = page.locator('.border.rounded-lg').filter({ hasText: 'Week' }); // Assuming some unique locator or index
    // Using simple indexing
    await page.locator('select').nth(1).selectOption('follow_up_1');
    await page.getByPlaceholder('Enter subject line...').nth(1).fill('Following up');
    await page.getByPlaceholder('Write your email content...').nth(1).fill('Any thoughts?');
    await page.locator('input[type="number"]').nth(0).fill('3'); // Delay

    // 6. Save
    await page.getByText('Save Sequence').click();
    
    // 7. Verify Toast
    await expect(page.getByText('Sequence created successfully')).toBeVisible();
    
    // 8. Verify in list
    await page.getByText('Cancel').click(); // Or wait for auto-close if implemented
    await expect(page.getByText(sequenceName)).toBeVisible();
  });

  test('should create from template', async ({ page }) => {
    await page.getByText('New Sequence').click();
    
    // Open Template Library
    await page.getByText('Templates').click();
    
    // Select a template
    await page.getByText('3-Touch Quick').click();
    
    // Click "Use Template" (assuming it appears on hover, or click the card itself)
    // The component implementation uses card click -> onSelect
    // We might need to handle the hover state or just click the card container
    
    // Verify steps populated
    await expect(page.locator('input[value="Quick question for {{company}}"]')).toBeVisible();
    
    // Save
    const sequenceName = `Template Test ${Date.now()}`;
    await page.getByPlaceholder('Sequence Name').fill(sequenceName);
    await page.getByText('Save Sequence').click();
    
    await expect(page.getByText('Sequence created successfully')).toBeVisible();
  });
});
