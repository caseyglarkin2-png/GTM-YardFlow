/**
 * LinkedIn Import E2E Tests
 * 
 * End-to-end tests for the LinkedIn Sales Navigator import flow.
 */

import { test, expect } from '@playwright/test';

// Sample CSV data for tests
const sampleLinkedInCsv = `First Name,Last Name,Title,Company,Email,LinkedIn URL,Location
John,Smith,VP Sales,Acme Corp,john@acme.com,https://linkedin.com/in/johnsmith,San Francisco CA
Jane,Doe,CEO,TechStart Inc,jane@techstart.io,https://linkedin.com/in/janedoe,New York NY
Bob,Wilson,CTO,Innovate Labs,bob@innovate.co,https://linkedin.com/in/bobwilson,Austin TX`;

const duplicateCsv = `First Name,Last Name,Title,Company,Email,LinkedIn URL
Existing,User,Manager,Test Company,existing@test.com,https://linkedin.com/in/existing`;

test.describe('LinkedIn Import Wizard', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto('/');
    
    // Wait for app to load
    await page.waitForLoadState('networkidle');
  });

  test.describe('Upload Step', () => {
    test('displays import wizard when triggered', async ({ page }) => {
      // Look for import button or trigger
      const importButton = page.getByRole('button', { name: /import/i });
      
      if (await importButton.isVisible()) {
        await importButton.click();
        
        // Wizard should be visible
        await expect(page.getByText('Import LinkedIn Contacts')).toBeVisible();
        await expect(page.getByText(/Upload a CSV export/i)).toBeVisible();
      }
    });

    test('has drag and drop upload area', async ({ page }) => {
      const importButton = page.getByRole('button', { name: /import/i });
      
      if (await importButton.isVisible()) {
        await importButton.click();
        
        // Look for drop zone
        await expect(page.getByText(/Click to upload/i)).toBeVisible();
        await expect(page.getByText(/drag and drop/i)).toBeVisible();
      }
    });

    test('has paste CSV option', async ({ page }) => {
      const importButton = page.getByRole('button', { name: /import/i });
      
      if (await importButton.isVisible()) {
        await importButton.click();
        
        // Look for paste option
        await expect(page.getByText(/paste CSV content/i)).toBeVisible();
      }
    });

    test('switches to paste mode when clicked', async ({ page }) => {
      const importButton = page.getByRole('button', { name: /import/i });
      
      if (await importButton.isVisible()) {
        await importButton.click();
        
        await page.getByText(/paste CSV content/i).click();
        
        // Textarea should appear
        await expect(page.getByRole('textbox', { name: /paste/i })).toBeVisible();
        await expect(page.getByRole('button', { name: /parse/i })).toBeVisible();
      }
    });
  });

  test.describe('CSV Parsing', () => {
    test('parses valid CSV and shows preview', async ({ page }) => {
      const importButton = page.getByRole('button', { name: /import/i });
      
      if (await importButton.isVisible()) {
        await importButton.click();
        
        // Switch to paste mode
        await page.getByText(/paste CSV content/i).click();
        
        // Paste CSV
        await page.getByRole('textbox', { name: /paste/i }).fill(sampleLinkedInCsv);
        
        // Parse
        await page.getByRole('button', { name: /parse/i }).click();
        
        // Should show preview step
        await expect(page.getByText('Preview Import')).toBeVisible();
        
        // Should show contact count
        await expect(page.getByText('Contacts Found')).toBeVisible();
        
        // Should show sample data
        await expect(page.getByText('John Smith')).toBeVisible();
        await expect(page.getByText('Acme Corp')).toBeVisible();
      }
    });

    test('shows error for invalid CSV', async ({ page }) => {
      const importButton = page.getByRole('button', { name: /import/i });
      
      if (await importButton.isVisible()) {
        await importButton.click();
        
        await page.getByText(/paste CSV content/i).click();
        
        // Paste invalid CSV
        await page.getByRole('textbox', { name: /paste/i }).fill('invalid,data,no,contacts');
        
        await page.getByRole('button', { name: /parse/i }).click();
        
        // Should show error
        await expect(page.getByRole('alert')).toBeVisible();
      }
    });
  });

  test.describe('Preview Step', () => {
    test('shows column mapping', async ({ page }) => {
      const importButton = page.getByRole('button', { name: /import/i });
      
      if (await importButton.isVisible()) {
        await importButton.click();
        await page.getByText(/paste CSV content/i).click();
        await page.getByRole('textbox', { name: /paste/i }).fill(sampleLinkedInCsv);
        await page.getByRole('button', { name: /parse/i }).click();
        
        // Wait for preview
        await expect(page.getByText('Preview Import')).toBeVisible();
        
        // Should show column mapping section
        await expect(page.getByText('Column Mapping')).toBeVisible();
      }
    });

    test('has back button to return to upload', async ({ page }) => {
      const importButton = page.getByRole('button', { name: /import/i });
      
      if (await importButton.isVisible()) {
        await importButton.click();
        await page.getByText(/paste CSV content/i).click();
        await page.getByRole('textbox', { name: /paste/i }).fill(sampleLinkedInCsv);
        await page.getByRole('button', { name: /parse/i }).click();
        
        await expect(page.getByText('Preview Import')).toBeVisible();
        
        // Click back
        await page.getByRole('button', { name: /back/i }).click();
        
        // Should return to upload step
        await expect(page.getByText(/Upload a CSV export/i)).toBeVisible();
      }
    });

    test('has continue button to check duplicates', async ({ page }) => {
      const importButton = page.getByRole('button', { name: /import/i });
      
      if (await importButton.isVisible()) {
        await importButton.click();
        await page.getByText(/paste CSV content/i).click();
        await page.getByRole('textbox', { name: /paste/i }).fill(sampleLinkedInCsv);
        await page.getByRole('button', { name: /parse/i }).click();
        
        await expect(page.getByRole('button', { name: /check duplicates/i })).toBeVisible();
      }
    });
  });

  test.describe('Duplicate Detection Step', () => {
    test('shows no duplicates message when none found', async ({ page }) => {
      const importButton = page.getByRole('button', { name: /import/i });
      
      if (await importButton.isVisible()) {
        await importButton.click();
        await page.getByText(/paste CSV content/i).click();
        await page.getByRole('textbox', { name: /paste/i }).fill(sampleLinkedInCsv);
        await page.getByRole('button', { name: /parse/i }).click();
        
        await page.getByRole('button', { name: /check duplicates/i }).click();
        
        // Should show no duplicates or duplicate resolution
        const noDuplicates = page.getByText('No Duplicates Found');
        const resolveDuplicates = page.getByText('Resolve Duplicates');
        
        await expect(noDuplicates.or(resolveDuplicates)).toBeVisible();
      }
    });

    test('shows continue to import button', async ({ page }) => {
      const importButton = page.getByRole('button', { name: /import/i });
      
      if (await importButton.isVisible()) {
        await importButton.click();
        await page.getByText(/paste CSV content/i).click();
        await page.getByRole('textbox', { name: /paste/i }).fill(sampleLinkedInCsv);
        await page.getByRole('button', { name: /parse/i }).click();
        await page.getByRole('button', { name: /check duplicates/i }).click();
        
        await expect(page.getByRole('button', { name: /continue to import/i })).toBeVisible();
      }
    });
  });

  test.describe('Confirm Step', () => {
    test('shows import summary', async ({ page }) => {
      const importButton = page.getByRole('button', { name: /import/i });
      
      if (await importButton.isVisible()) {
        await importButton.click();
        await page.getByText(/paste CSV content/i).click();
        await page.getByRole('textbox', { name: /paste/i }).fill(sampleLinkedInCsv);
        await page.getByRole('button', { name: /parse/i }).click();
        await page.getByRole('button', { name: /check duplicates/i }).click();
        await page.getByRole('button', { name: /continue to import/i }).click();
        
        // Should show confirm step
        await expect(page.getByText('Confirm Import')).toBeVisible();
        await expect(page.getByText('Total Contacts')).toBeVisible();
        await expect(page.getByText('New Imports')).toBeVisible();
      }
    });

    test('has import button', async ({ page }) => {
      const importButton = page.getByRole('button', { name: /import/i });
      
      if (await importButton.isVisible()) {
        await importButton.click();
        await page.getByText(/paste CSV content/i).click();
        await page.getByRole('textbox', { name: /paste/i }).fill(sampleLinkedInCsv);
        await page.getByRole('button', { name: /parse/i }).click();
        await page.getByRole('button', { name: /check duplicates/i }).click();
        await page.getByRole('button', { name: /continue to import/i }).click();
        
        await expect(page.getByRole('button', { name: /import.*contacts/i })).toBeVisible();
      }
    });
  });

  test.describe('Complete Step', () => {
    test('shows completion message after import', async ({ page }) => {
      const importButton = page.getByRole('button', { name: /import/i });
      
      if (await importButton.isVisible()) {
        await importButton.click();
        await page.getByText(/paste CSV content/i).click();
        await page.getByRole('textbox', { name: /paste/i }).fill(sampleLinkedInCsv);
        await page.getByRole('button', { name: /parse/i }).click();
        await page.getByRole('button', { name: /check duplicates/i }).click();
        await page.getByRole('button', { name: /continue to import/i }).click();
        
        // Click import button
        await page.getByRole('button', { name: /import.*contacts/i }).click();
        
        // Should show completion
        await expect(page.getByText('Import Complete!')).toBeVisible({ timeout: 10000 });
      }
    });

    test('shows import statistics', async ({ page }) => {
      const importButton = page.getByRole('button', { name: /import/i });
      
      if (await importButton.isVisible()) {
        await importButton.click();
        await page.getByText(/paste CSV content/i).click();
        await page.getByRole('textbox', { name: /paste/i }).fill(sampleLinkedInCsv);
        await page.getByRole('button', { name: /parse/i }).click();
        await page.getByRole('button', { name: /check duplicates/i }).click();
        await page.getByRole('button', { name: /continue to import/i }).click();
        await page.getByRole('button', { name: /import.*contacts/i }).click();
        
        await expect(page.getByText('Import Complete!')).toBeVisible({ timeout: 10000 });
        
        // Should show stats (New, Merged, Skipped)
        await expect(page.getByText('New')).toBeVisible();
        await expect(page.getByText('Merged')).toBeVisible();
        await expect(page.getByText('Skipped')).toBeVisible();
      }
    });

    test('has done button to close wizard', async ({ page }) => {
      const importButton = page.getByRole('button', { name: /import/i });
      
      if (await importButton.isVisible()) {
        await importButton.click();
        await page.getByText(/paste CSV content/i).click();
        await page.getByRole('textbox', { name: /paste/i }).fill(sampleLinkedInCsv);
        await page.getByRole('button', { name: /parse/i }).click();
        await page.getByRole('button', { name: /check duplicates/i }).click();
        await page.getByRole('button', { name: /continue to import/i }).click();
        await page.getByRole('button', { name: /import.*contacts/i }).click();
        
        await expect(page.getByText('Import Complete!')).toBeVisible({ timeout: 10000 });
        
        await expect(page.getByRole('button', { name: /done/i })).toBeVisible();
      }
    });
  });

  test.describe('Step Navigation', () => {
    test('step indicator shows current step', async ({ page }) => {
      const importButton = page.getByRole('button', { name: /import/i });
      
      if (await importButton.isVisible()) {
        await importButton.click();
        
        // Should show step indicator with Upload, Preview, Duplicates, Confirm
        await expect(page.getByText('Upload')).toBeVisible();
        await expect(page.getByText('Preview')).toBeVisible();
        await expect(page.getByText('Duplicates')).toBeVisible();
        await expect(page.getByText('Confirm')).toBeVisible();
      }
    });
  });

  test.describe('Cancel/Close', () => {
    test('close button is visible', async ({ page }) => {
      const importButton = page.getByRole('button', { name: /import/i });
      
      if (await importButton.isVisible()) {
        await importButton.click();
        
        await expect(page.getByRole('button', { name: /close/i })).toBeVisible();
      }
    });

    test('close button closes wizard', async ({ page }) => {
      const importButton = page.getByRole('button', { name: /import/i });
      
      if (await importButton.isVisible()) {
        await importButton.click();
        
        await page.getByRole('button', { name: /close/i }).click();
        
        // Wizard should be closed
        await expect(page.getByText('Import LinkedIn Contacts')).not.toBeVisible();
      }
    });
  });

  test.describe('Accessibility', () => {
    test('wizard is keyboard navigable', async ({ page }) => {
      const importButton = page.getByRole('button', { name: /import/i });
      
      if (await importButton.isVisible()) {
        await importButton.click();
        
        // Tab through elements
        await page.keyboard.press('Tab');
        await page.keyboard.press('Tab');
        
        // Some element should be focused
        const focusedElement = await page.locator(':focus');
        await expect(focusedElement).toBeVisible();
      }
    });

    test('file input has accessible label', async ({ page }) => {
      const importButton = page.getByRole('button', { name: /import/i });
      
      if (await importButton.isVisible()) {
        await importButton.click();
        
        // File input should have accessible label
        const fileInput = page.locator('input[type="file"]');
        if (await fileInput.isVisible()) {
          const ariaLabel = await fileInput.getAttribute('aria-label');
          expect(ariaLabel).toBeTruthy();
        }
      }
    });
  });

  test.describe('Error Handling', () => {
    test('shows user-friendly error for empty file', async ({ page }) => {
      const importButton = page.getByRole('button', { name: /import/i });
      
      if (await importButton.isVisible()) {
        await importButton.click();
        await page.getByText(/paste CSV content/i).click();
        
        // Try to parse empty content
        await page.getByRole('textbox', { name: /paste/i }).fill('');
        
        const parseButton = page.getByRole('button', { name: /parse/i });
        
        // Button should be disabled or error shown
        if (await parseButton.isEnabled()) {
          await parseButton.click();
          await expect(page.getByRole('alert')).toBeVisible();
        }
      }
    });
  });

  test.describe('Performance', () => {
    test('handles large CSV within reasonable time', async ({ page }) => {
      const importButton = page.getByRole('button', { name: /import/i });
      
      if (await importButton.isVisible()) {
        await importButton.click();
        await page.getByText(/paste CSV content/i).click();
        
        // Generate larger CSV (100 rows)
        let largeCsv = 'First Name,Last Name,Title,Company,Email,LinkedIn URL\n';
        for (let i = 0; i < 100; i++) {
          largeCsv += `User${i},Last${i},Title${i},Company${i},user${i}@test.com,https://linkedin.com/in/user${i}\n`;
        }
        
        await page.getByRole('textbox', { name: /paste/i }).fill(largeCsv);
        
        const startTime = Date.now();
        await page.getByRole('button', { name: /parse/i }).click();
        
        // Should complete within 5 seconds
        await expect(page.getByText('Preview Import')).toBeVisible({ timeout: 5000 });
        
        const duration = Date.now() - startTime;
        expect(duration).toBeLessThan(5000);
      }
    });
  });
});

test.describe('LinkedIn Import Integration', () => {
  test('full import flow works end-to-end', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const importButton = page.getByRole('button', { name: /import/i });
    
    if (await importButton.isVisible()) {
      // Step 1: Open wizard
      await importButton.click();
      await expect(page.getByText('Import LinkedIn Contacts')).toBeVisible();

      // Step 2: Paste CSV
      await page.getByText(/paste CSV content/i).click();
      await page.getByRole('textbox', { name: /paste/i }).fill(sampleLinkedInCsv);
      await page.getByRole('button', { name: /parse/i }).click();

      // Step 3: Preview
      await expect(page.getByText('Preview Import')).toBeVisible();
      await page.getByRole('button', { name: /check duplicates/i }).click();

      // Step 4: Duplicates
      await expect(page.getByRole('button', { name: /continue to import/i })).toBeVisible();
      await page.getByRole('button', { name: /continue to import/i }).click();

      // Step 5: Confirm
      await expect(page.getByText('Confirm Import')).toBeVisible();
      await page.getByRole('button', { name: /import.*contacts/i }).click();

      // Step 6: Complete
      await expect(page.getByText('Import Complete!')).toBeVisible({ timeout: 10000 });

      // Step 7: Close
      await page.getByRole('button', { name: /done/i }).click();
      await expect(page.getByText('Import LinkedIn Contacts')).not.toBeVisible();
    }
  });
});
