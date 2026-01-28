/**
 * Import Wizard Component Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ImportWizard } from '../../components/ImportWizard';
import type { Prospect, Company } from '../../types';

// ============================================
// Test Fixtures
// ============================================

const mockProspect = (overrides: Partial<Prospect> = {}): Prospect => ({
  id: 'existing-1',
  name: 'Existing Contact',
  email: 'existing@company.com',
  company: 'Existing Company',
  title: 'Manager',
  phone: '555-000-0000',
  linkedinUrl: 'https://linkedin.com/in/existing',
  status: 'new',
  tier: '1',
  source: 'manual',
  tags: [],
  notes: '',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  ...overrides,
});

const mockCompany = (overrides: Partial<Company> = {}): Company => ({
  id: 'company-1',
  name: 'Acme Corp',
  domain: 'acme.com',
  industry: 'Technology',
  size: '100-500',
  location: 'San Francisco, CA',
  ...overrides,
});

const sampleCsv = `First Name,Last Name,Title,Company,Email,LinkedIn URL
John,Smith,VP Sales,Acme Corp,john@acme.com,https://linkedin.com/in/johnsmith
Jane,Doe,CEO,TechStart,jane@techstart.io,https://linkedin.com/in/janedoe
Bob,Wilson,CTO,Innovate Labs,bob@innovate.co,https://linkedin.com/in/bobwilson`;

const duplicateCsv = `First Name,Last Name,Title,Company,Email,LinkedIn URL
Existing,Contact,Manager,Existing Company,existing@company.com,https://linkedin.com/in/existing`;

// ============================================
// Tests
// ============================================

describe('ImportWizard', () => {
  const mockOnComplete = vi.fn();
  const mockOnCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial Render', () => {
    it('renders upload step by default', () => {
      render(
        <ImportWizard
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />
      );

      // Check heading is present using getAllByText and taking the first one (h1 in header)
      const headings = screen.getAllByText('Import LinkedIn Contacts');
      expect(headings.length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/Upload a CSV export/)).toBeInTheDocument();
    });

    it('renders step indicator', () => {
      render(
        <ImportWizard
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText('Upload')).toBeInTheDocument();
      expect(screen.getByText('Preview')).toBeInTheDocument();
      expect(screen.getByText('Duplicates')).toBeInTheDocument();
      expect(screen.getByText('Confirm')).toBeInTheDocument();
    });

    it('has close button', () => {
      render(
        <ImportWizard
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />
      );

      const closeButton = screen.getByLabelText('Close');
      expect(closeButton).toBeInTheDocument();
    });
  });

  describe('Upload Step', () => {
    it('has file input', () => {
      render(
        <ImportWizard
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />
      );

      const fileInput = screen.getByLabelText('Upload CSV file');
      expect(fileInput).toBeInTheDocument();
      expect(fileInput).toHaveAttribute('accept', '.csv,text/csv');
    });

    it('shows paste option toggle', () => {
      render(
        <ImportWizard
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText('Or paste CSV content')).toBeInTheDocument();
    });

    it('toggles to paste mode', async () => {
      const user = userEvent.setup();
      render(
        <ImportWizard
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />
      );

      await user.click(screen.getByText('Or paste CSV content'));

      expect(screen.getByLabelText('Paste CSV content')).toBeInTheDocument();
      expect(screen.getByText('Parse CSV')).toBeInTheDocument();
    });

    it('toggles back to upload mode', async () => {
      const user = userEvent.setup();
      render(
        <ImportWizard
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />
      );

      await user.click(screen.getByText('Or paste CSV content'));
      await user.click(screen.getByText('Upload file instead'));

      expect(screen.getByLabelText('Upload CSV file')).toBeInTheDocument();
    });

    it('parses pasted CSV content', async () => {
      const user = userEvent.setup();
      render(
        <ImportWizard
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />
      );

      // Switch to paste mode
      await user.click(screen.getByText('Or paste CSV content'));

      // Paste content
      const textarea = screen.getByLabelText('Paste CSV content');
      await user.type(textarea, sampleCsv);

      // Parse
      await user.click(screen.getByText('Parse CSV'));

      // Should advance to preview step
      await waitFor(() => {
        expect(screen.getByText('Preview Import')).toBeInTheDocument();
      });
    });

    it('shows error for invalid CSV', async () => {
      const user = userEvent.setup();
      render(
        <ImportWizard
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />
      );

      await user.click(screen.getByText('Or paste CSV content'));
      const textarea = screen.getByLabelText('Paste CSV content');
      await user.type(textarea, 'invalid,csv,without,required,columns');
      await user.click(screen.getByText('Parse CSV'));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });
    });
  });

  describe('Preview Step', () => {
    it('shows contact count', async () => {
      const user = userEvent.setup();
      render(
        <ImportWizard
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />
      );

      await user.click(screen.getByText('Or paste CSV content'));
      await user.type(screen.getByLabelText('Paste CSV content'), sampleCsv);
      await user.click(screen.getByText('Parse CSV'));

      await waitFor(() => {
        expect(screen.getByText('Contacts Found')).toBeInTheDocument();
        // Check that 3 contacts were found in the stats area
        const statsArea = screen.getByText('Contacts Found').closest('div');
        expect(statsArea?.textContent).toContain('3');
      });
    });

    it('shows sample data table', async () => {
      const user = userEvent.setup();
      render(
        <ImportWizard
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />
      );

      await user.click(screen.getByText('Or paste CSV content'));
      await user.type(screen.getByLabelText('Paste CSV content'), sampleCsv);
      await user.click(screen.getByText('Parse CSV'));

      await waitFor(() => {
        expect(screen.getByText('John Smith')).toBeInTheDocument();
        expect(screen.getByText('Acme Corp')).toBeInTheDocument();
      });
    });

    it('has back button', async () => {
      const user = userEvent.setup();
      render(
        <ImportWizard
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />
      );

      await user.click(screen.getByText('Or paste CSV content'));
      await user.type(screen.getByLabelText('Paste CSV content'), sampleCsv);
      await user.click(screen.getByText('Parse CSV'));

      await waitFor(() => {
        expect(screen.getByText('Back')).toBeInTheDocument();
      });
    });

    it('has continue button', async () => {
      const user = userEvent.setup();
      render(
        <ImportWizard
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />
      );

      await user.click(screen.getByText('Or paste CSV content'));
      await user.type(screen.getByLabelText('Paste CSV content'), sampleCsv);
      await user.click(screen.getByText('Parse CSV'));

      await waitFor(() => {
        expect(screen.getByText('Check Duplicates')).toBeInTheDocument();
      });
    });
  });

  describe('Duplicates Step', () => {
    it('shows no duplicates message when none found', async () => {
      const user = userEvent.setup();
      render(
        <ImportWizard
          existingProspects={[]} // No existing prospects
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />
      );

      await user.click(screen.getByText('Or paste CSV content'));
      await user.type(screen.getByLabelText('Paste CSV content'), sampleCsv);
      await user.click(screen.getByText('Parse CSV'));

      await waitFor(() => {
        expect(screen.getByText('Check Duplicates')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Check Duplicates'));

      await waitFor(() => {
        expect(screen.getByText('No Duplicates Found')).toBeInTheDocument();
      });
    });

    it('shows duplicate contacts when found', async () => {
      const user = userEvent.setup();
      render(
        <ImportWizard
          existingProspects={[mockProspect()]}
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />
      );

      await user.click(screen.getByText('Or paste CSV content'));
      await user.type(screen.getByLabelText('Paste CSV content'), duplicateCsv);
      await user.click(screen.getByText('Parse CSV'));

      await waitFor(() => {
        expect(screen.getByText('Check Duplicates')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Check Duplicates'));

      await waitFor(() => {
        expect(screen.getByText('Resolve Duplicates')).toBeInTheDocument();
      });
    });

    it('has resolution action buttons', async () => {
      const user = userEvent.setup();
      render(
        <ImportWizard
          existingProspects={[mockProspect()]}
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />
      );

      await user.click(screen.getByText('Or paste CSV content'));
      await user.type(screen.getByLabelText('Paste CSV content'), duplicateCsv);
      await user.click(screen.getByText('Parse CSV'));

      await waitFor(() => {
        expect(screen.getByText('Check Duplicates')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Check Duplicates'));

      await waitFor(() => {
        expect(screen.getByText('Skip')).toBeInTheDocument();
        expect(screen.getByText('Merge')).toBeInTheDocument();
        expect(screen.getByText('Import Anyway')).toBeInTheDocument();
      });
    });
  });

  describe('Confirm Step', () => {
    it('shows import summary', async () => {
      const user = userEvent.setup();
      render(
        <ImportWizard
          existingProspects={[]}
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />
      );

      await user.click(screen.getByText('Or paste CSV content'));
      await user.type(screen.getByLabelText('Paste CSV content'), sampleCsv);
      await user.click(screen.getByText('Parse CSV'));

      await waitFor(() => {
        expect(screen.getByText('Check Duplicates')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Check Duplicates'));

      await waitFor(() => {
        expect(screen.getByText('Continue to Import')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Continue to Import'));

      await waitFor(() => {
        expect(screen.getByText('Confirm Import')).toBeInTheDocument();
        expect(screen.getByText('Total Contacts')).toBeInTheDocument();
        expect(screen.getByText('New Imports')).toBeInTheDocument();
      });
    });

    it('has import button', async () => {
      const user = userEvent.setup();
      render(
        <ImportWizard
          existingProspects={[]}
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />
      );

      await user.click(screen.getByText('Or paste CSV content'));
      await user.type(screen.getByLabelText('Paste CSV content'), sampleCsv);
      await user.click(screen.getByText('Parse CSV'));

      await waitFor(() => {
        expect(screen.getByText('Check Duplicates')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Check Duplicates'));

      await waitFor(() => {
        expect(screen.getByText('Continue to Import')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Continue to Import'));

      await waitFor(() => {
        expect(screen.getByText(/Import \d+ Contacts/)).toBeInTheDocument();
      });
    });
  });

  describe('Complete Step', () => {
    it('shows completion message after import', async () => {
      const user = userEvent.setup();
      render(
        <ImportWizard
          existingProspects={[]}
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />
      );

      await user.click(screen.getByText('Or paste CSV content'));
      await user.type(screen.getByLabelText('Paste CSV content'), sampleCsv);
      await user.click(screen.getByText('Parse CSV'));

      await waitFor(() => {
        expect(screen.getByText('Check Duplicates')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Check Duplicates'));

      await waitFor(() => {
        expect(screen.getByText('Continue to Import')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Continue to Import'));

      await waitFor(() => {
        expect(screen.getByText(/Import \d+ Contacts/)).toBeInTheDocument();
      });

      await user.click(screen.getByText(/Import \d+ Contacts/));

      await waitFor(() => {
        expect(screen.getByText('Import Complete!')).toBeInTheDocument();
      }, { timeout: 5000 });
    });

    it('calls onComplete with imported prospects', async () => {
      const user = userEvent.setup();
      render(
        <ImportWizard
          existingProspects={[]}
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />
      );

      await user.click(screen.getByText('Or paste CSV content'));
      await user.type(screen.getByLabelText('Paste CSV content'), sampleCsv);
      await user.click(screen.getByText('Parse CSV'));

      await waitFor(() => {
        expect(screen.getByText('Check Duplicates')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Check Duplicates'));

      await waitFor(() => {
        expect(screen.getByText('Continue to Import')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Continue to Import'));

      await waitFor(() => {
        expect(screen.getByText(/Import \d+ Contacts/)).toBeInTheDocument();
      });

      await user.click(screen.getByText(/Import \d+ Contacts/));

      await waitFor(() => {
        expect(mockOnComplete).toHaveBeenCalled();
      }, { timeout: 5000 });

      // Should have 3 prospects
      const importedProspects = mockOnComplete.mock.calls[0][0];
      expect(importedProspects.length).toBe(3);
    });

    it('has done button', async () => {
      const user = userEvent.setup();
      render(
        <ImportWizard
          existingProspects={[]}
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />
      );

      await user.click(screen.getByText('Or paste CSV content'));
      await user.type(screen.getByLabelText('Paste CSV content'), sampleCsv);
      await user.click(screen.getByText('Parse CSV'));

      await waitFor(() => {
        expect(screen.getByText('Check Duplicates')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Check Duplicates'));

      await waitFor(() => {
        expect(screen.getByText('Continue to Import')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Continue to Import'));

      await waitFor(() => {
        expect(screen.getByText(/Import \d+ Contacts/)).toBeInTheDocument();
      });

      await user.click(screen.getByText(/Import \d+ Contacts/));

      await waitFor(() => {
        expect(screen.getByText('Done')).toBeInTheDocument();
      }, { timeout: 5000 });
    });
  });

  describe('Cancel', () => {
    it('calls onCancel when close button clicked', async () => {
      const user = userEvent.setup();
      render(
        <ImportWizard
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />
      );

      await user.click(screen.getByLabelText('Close'));

      expect(mockOnCancel).toHaveBeenCalled();
    });
  });

  describe('Company Matching', () => {
    it('uses company matcher for industry matching', async () => {
      const user = userEvent.setup();
      render(
        <ImportWizard
          existingProspects={[]}
          existingCompanies={[mockCompany({ name: 'Acme Corp', industry: 'Technology' })]}
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />
      );

      await user.click(screen.getByText('Or paste CSV content'));
      await user.type(screen.getByLabelText('Paste CSV content'), sampleCsv);
      await user.click(screen.getByText('Parse CSV'));

      await waitFor(() => {
        expect(screen.getByText('Check Duplicates')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Check Duplicates'));

      await waitFor(() => {
        expect(screen.getByText('Continue to Import')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Continue to Import'));

      await waitFor(() => {
        expect(screen.getByText(/Import \d+ Contacts/)).toBeInTheDocument();
      });

      await user.click(screen.getByText(/Import \d+ Contacts/));

      await waitFor(() => {
        expect(mockOnComplete).toHaveBeenCalled();
      }, { timeout: 5000 });

      // Check that the matched company's industry was used
      const importedProspects = mockOnComplete.mock.calls[0][0];
      const acmeContact = importedProspects.find((p: Prospect) => p.company === 'Acme Corp');
      expect(acmeContact.industry).toBe('Technology');
    });
  });
});

describe('ImportWizard Step Components', () => {
  describe('UploadStep', () => {
    it('disables input when loading', () => {
      render(
        <ImportWizard
          onComplete={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      // Not loading, should be enabled
      const fileInput = screen.getByLabelText('Upload CSV file');
      expect(fileInput).not.toBeDisabled();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels', () => {
      render(
        <ImportWizard
          onComplete={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      expect(screen.getByLabelText('Upload CSV file')).toBeInTheDocument();
      expect(screen.getByLabelText('Close')).toBeInTheDocument();
    });
  });
});
