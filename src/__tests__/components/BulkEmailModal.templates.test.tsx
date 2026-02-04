/**
 * T2.5: BulkEmailModal Template CRUD Tests
 * Sprint S2: Template UI Integration
 * 
 * Tests for:
 * - Template loading from Railway hook
 * - Save as Template functionality
 * - Edit template functionality  
 * - Delete template with confirmation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BulkEmailModal } from '@/components/BulkEmailModal';
import type { Prospect } from '@/types';
import type { EmailTemplateRecord } from '@/types/railway';

import { useTemplates } from '@/hooks/useTemplates';

// Mock dependencies
vi.mock('@/hooks/useTemplates', () => ({
  useTemplates: vi.fn(),
}));

vi.mock('@/hooks/useAIGenerate', () => ({
  useAIGenerate: () => ({
    generate: vi.fn().mockResolvedValue({ ok: true, data: { subject: 'AI Subject', body: 'AI Body' } }),
    isGenerating: false,
    error: null,
    clearError: vi.fn(),
    result: null,
    rateLimit: null,
    provider: null,
  }),
}));

vi.mock('@/hooks/useBulkEmailSend', () => ({
  useBulkEmailSend: () => ({
    recipients: [],
    progress: { sent: 0, failed: 0, total: 0 },
    isProcessing: false,
    initializeRecipients: vi.fn(),
    sendAll: vi.fn(),
    reset: vi.fn(),
  }),
}));

vi.mock('@/config/featureFlags', () => ({
  shouldUseRailwayTemplates: () => true,
  featureFlags: { RAILWAY_TEMPLATES_ENABLED: true },
}));

const mockTemplates: EmailTemplateRecord[] = [
  {
    id: 'template-1',
    name: 'Welcome Email',
    subject: 'Welcome to YardFlow',
    body: 'Hello {name}, welcome!',
    category: 'outreach',
    tone: 'professional',
    isDefault: true,
    createdBy: 'system',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'template-2',
    name: 'Custom Template',
    subject: 'Custom Subject',
    body: 'Custom body content',
    category: 'followup',
    tone: 'friendly',
    isDefault: false,
    createdBy: 'user-1',
    createdAt: '2026-02-01T00:00:00Z',
    updatedAt: '2026-02-01T00:00:00Z',
  },
];

const mockProspects: Prospect[] = [
  {
    id: 'prospect-1',
    name: 'John Doe',
    email: 'john@example.com',
    company: 'Acme Inc',
    title: 'CEO',
    tier: 'T1',
    status: 'new',
    score: 85,
    isOps: false,
    isExec: true,
    createdAt: 1704067200000, // 2026-01-01T00:00:00Z as timestamp
  },
];

describe('BulkEmailModal - Template CRUD', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup useTemplates mock
    vi.mocked(useTemplates).mockReturnValue({
      templates: mockTemplates,
      isLoading: false,
      error: null,
      isRailwaySource: true,
      reload: vi.fn(),
      create: vi.fn().mockResolvedValue({ ok: true, template: { id: 'new-1', name: 'New Template' } }),
      update: vi.fn().mockResolvedValue({ ok: true }),
      deleteTemplate: vi.fn().mockResolvedValue({ ok: true }),
      filterByCategory: vi.fn().mockReturnValue([]),
      filterByTone: vi.fn().mockReturnValue([]),
    });
  });

  const renderModal = (props = {}) => {
    const defaultProps = {
      isOpen: true,
      onClose: vi.fn(),
      onConfirm: vi.fn(),
      selectedProspects: mockProspects,
      isSending: false,
      progress: { sent: 0, total: 0, failed: 0 },
      onUpdateProspect: vi.fn(),
    };
    return render(<BulkEmailModal {...defaultProps} {...props} />);
  };

  describe('Template Loading', () => {
    it('shows templates from Railway hook in dropdown', async () => {
      renderModal();

      // Check that templates from hook are displayed
      const select = screen.getByLabelText(/template/i);
      expect(select).toBeInTheDocument();
      
      // Check options
      const options = screen.getAllByRole('option');
      expect(options.some(o => o.textContent?.includes('Welcome Email'))).toBe(true);
      expect(options.some(o => o.textContent?.includes('Custom Template'))).toBe(true);
    });

    it('shows loading state while templates fetch', async () => {
      vi.mocked(useTemplates).mockReturnValue({
        templates: [],
        isLoading: true,
        error: null,
        isRailwaySource: false,
        reload: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        deleteTemplate: vi.fn(),
        filterByCategory: vi.fn(),
        filterByTone: vi.fn(),
      });

      renderModal();

      expect(screen.getByText('Loading templates...')).toBeInTheDocument();
    });

    it('shows Railway indicator when using Railway templates', async () => {
      renderModal();

      expect(screen.getByText('(Railway)')).toBeInTheDocument();
    });

    it('shows fallback warning when templates error occurs', async () => {
      vi.mocked(useTemplates).mockReturnValue({
        templates: mockTemplates,
        isLoading: false,
        error: 'Failed to fetch',
        isRailwaySource: false,
        reload: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        deleteTemplate: vi.fn(),
        filterByCategory: vi.fn(),
        filterByTone: vi.fn(),
      });

      renderModal();

      expect(screen.getByText('Using fallback templates')).toBeInTheDocument();
    });
  });

  describe('Template Edit (T2.3)', () => {
    it('shows edit button only for custom templates', async () => {
      renderModal();

      // Select the custom (non-default) template
      const select = screen.getByLabelText(/template/i);
      await userEvent.selectOptions(select, 'template-2');

      // Edit button should appear
      expect(screen.getByTitle('Edit template')).toBeInTheDocument();
    });

    it('hides edit button for default templates', async () => {
      // Only default template
      vi.mocked(useTemplates).mockReturnValue({
        templates: [mockTemplates[0]], // Only the default one
        isLoading: false,
        error: null,
        isRailwaySource: true,
        reload: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        deleteTemplate: vi.fn(),
        filterByCategory: vi.fn(),
        filterByTone: vi.fn(),
      });

      renderModal();

      expect(screen.queryByTitle('Edit template')).not.toBeInTheDocument();
    });

    it('enters edit mode when edit button clicked', async () => {
      renderModal();

      // Select custom template
      const select = screen.getByLabelText(/template/i);
      await userEvent.selectOptions(select, 'template-2');

      // Click edit
      fireEvent.click(screen.getByTitle('Edit template'));

      // Should show save/cancel buttons and hint
      expect(screen.getByTitle('Save changes')).toBeInTheDocument();
      expect(screen.getByTitle('Cancel edit')).toBeInTheDocument();
      expect(screen.getByText(/Editing: modify subject/)).toBeInTheDocument();
    });

    it('calls update API on save changes', async () => {
      const mockUpdate = vi.fn().mockResolvedValue({ ok: true });
      vi.mocked(useTemplates).mockReturnValue({
        templates: mockTemplates,
        isLoading: false,
        error: null,
        isRailwaySource: true,
        reload: vi.fn(),
        create: vi.fn(),
        update: mockUpdate,
        deleteTemplate: vi.fn(),
        filterByCategory: vi.fn(),
        filterByTone: vi.fn(),
      });

      renderModal();

      // Select custom template
      const select = screen.getByLabelText(/template/i);
      await userEvent.selectOptions(select, 'template-2');

      // Enter edit mode
      fireEvent.click(screen.getByTitle('Edit template'));

      // Fill in subject and body (required for save)
      const subjectInput = screen.getByLabelText(/subject/i);
      const bodyInput = screen.getByLabelText(/message/i) || screen.getByPlaceholderText(/message/i);
      
      await userEvent.clear(subjectInput);
      await userEvent.type(subjectInput, 'Updated Subject');
      await userEvent.clear(bodyInput);
      await userEvent.type(bodyInput, 'Updated Body');

      // Click save
      fireEvent.click(screen.getByTitle('Save changes'));

      await waitFor(() => {
        expect(mockUpdate).toHaveBeenCalledWith('template-2', expect.objectContaining({
          subject: 'Updated Subject',
          body: 'Updated Body',
        }));
      });
    });
  });

  describe('Template Delete (T2.4)', () => {
    it('shows delete button only for custom templates', async () => {
      renderModal();

      // Select the custom template
      const select = screen.getByLabelText(/template/i);
      await userEvent.selectOptions(select, 'template-2');

      expect(screen.getByTitle('Delete template')).toBeInTheDocument();
    });

    it('shows confirmation dialog when delete clicked', async () => {
      renderModal();

      // Select custom template
      const select = screen.getByLabelText(/template/i);
      await userEvent.selectOptions(select, 'template-2');

      // Click delete
      fireEvent.click(screen.getByTitle('Delete template'));

      // Confirmation dialog should appear
      expect(screen.getByText('Delete Template?')).toBeInTheDocument();
      expect(screen.getByText(/permanently delete/)).toBeInTheDocument();
    });

    it('cancels delete on cancel button', async () => {
      renderModal();

      // Select custom template and trigger delete
      const select = screen.getByLabelText(/template/i);
      await userEvent.selectOptions(select, 'template-2');
      fireEvent.click(screen.getByTitle('Delete template'));

      // Wait for dialog to appear
      expect(screen.getByText('Delete Template?')).toBeInTheDocument();

      // Find all Cancel buttons - the dialog Cancel is the one with higher z-index (rendered later in DOM)
      const cancelButtons = screen.getAllByText('Cancel');
      // The dialog Cancel button is the last one (rendered after modal footer Cancel)
      fireEvent.click(cancelButtons[cancelButtons.length - 1]);

      // Dialog should close
      await waitFor(() => {
        expect(screen.queryByText('Delete Template?')).not.toBeInTheDocument();
      });
    });

    it('calls delete API on confirm', async () => {
      const mockDelete = vi.fn().mockResolvedValue({ ok: true });
      const mockReload = vi.fn();
      vi.mocked(useTemplates).mockReturnValue({
        templates: mockTemplates,
        isLoading: false,
        error: null,
        isRailwaySource: true,
        reload: mockReload,
        create: vi.fn(),
        update: vi.fn(),
        deleteTemplate: mockDelete,
        filterByCategory: vi.fn(),
        filterByTone: vi.fn(),
      });

      renderModal();

      // Select custom template and trigger delete
      const select = screen.getByLabelText(/template/i);
      await userEvent.selectOptions(select, 'template-2');
      fireEvent.click(screen.getByTitle('Delete template'));

      // Click delete in confirmation
      fireEvent.click(screen.getByRole('button', { name: /^Delete$/i }));

      await waitFor(() => {
        expect(mockDelete).toHaveBeenCalledWith('template-2');
      });
    });

    it('shows error when template in use', async () => {
      const mockDelete = vi.fn().mockResolvedValue({ ok: false, error: 'template_in_use' });
      vi.mocked(useTemplates).mockReturnValue({
        templates: mockTemplates,
        isLoading: false,
        error: null,
        isRailwaySource: true,
        reload: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        deleteTemplate: mockDelete,
        filterByCategory: vi.fn(),
        filterByTone: vi.fn(),
      });

      renderModal();

      // Select custom template and trigger delete
      const select = screen.getByLabelText(/template/i);
      await userEvent.selectOptions(select, 'template-2');
      fireEvent.click(screen.getByTitle('Delete template'));

      // Wait for dialog and find Delete buttons
      await waitFor(() => {
        expect(screen.getByText('Delete Template?')).toBeInTheDocument();
      });

      // Find the Delete button (there should be only one Delete button in dialog)
      const deleteButtons = screen.getAllByRole('button', { name: /^Delete$/i });
      // Click the dialog's Delete button (last one in DOM)
      fireEvent.click(deleteButtons[deleteButtons.length - 1]);

      // Error message should appear (dialog closes, error shown in template section)
      await waitFor(() => {
        expect(screen.getByText(/used in active sequences/i)).toBeInTheDocument();
      });
    });
  });

  describe('Template Name Uniqueness (T2.6)', () => {
    it('prevents saving template with duplicate name', async () => {
      const mockCreate = vi.fn();
      vi.mocked(useTemplates).mockReturnValue({
        templates: mockTemplates,
        isLoading: false,
        error: null,
        isRailwaySource: true,
        reload: vi.fn(),
        create: mockCreate,
        update: vi.fn(),
        deleteTemplate: vi.fn(),
        filterByCategory: vi.fn(),
        filterByTone: vi.fn(),
      });

      renderModal();

      // Fill in subject and body first
      const subjectInput = screen.getByLabelText(/subject/i);
      const bodyInput = screen.getByLabelText(/message/i);
      await userEvent.type(subjectInput, 'Test Subject');
      await userEvent.type(bodyInput, 'Test body content');

      // Expand save as template section
      fireEvent.click(screen.getByText(/save as template/i));

      // Try to save with a name that already exists
      const nameInput = screen.getByPlaceholderText(/Q1 Outreach/i);
      await userEvent.type(nameInput, 'Welcome Email'); // Same as mockTemplates[0].name

      // Click save
      fireEvent.click(screen.getByText('Save Template'));

      // Should show duplicate error
      await waitFor(() => {
        expect(screen.getByText(/already exists/i)).toBeInTheDocument();
      });

      // Create should NOT have been called
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('prevents saving template with case-insensitive duplicate name', async () => {
      const mockCreate = vi.fn();
      vi.mocked(useTemplates).mockReturnValue({
        templates: mockTemplates,
        isLoading: false,
        error: null,
        isRailwaySource: true,
        reload: vi.fn(),
        create: mockCreate,
        update: vi.fn(),
        deleteTemplate: vi.fn(),
        filterByCategory: vi.fn(),
        filterByTone: vi.fn(),
      });

      renderModal();

      // Fill in subject and body
      const subjectInput = screen.getByLabelText(/subject/i);
      const bodyInput = screen.getByLabelText(/message/i);
      await userEvent.type(subjectInput, 'Test Subject');
      await userEvent.type(bodyInput, 'Test body content');

      // Expand save as template section
      fireEvent.click(screen.getByText(/save as template/i));

      // Try to save with a different case version of existing name
      const nameInput = screen.getByPlaceholderText(/Q1 Outreach/i);
      await userEvent.type(nameInput, 'WELCOME EMAIL'); // Case-insensitive match

      fireEvent.click(screen.getByText('Save Template'));

      await waitFor(() => {
        expect(screen.getByText(/already exists/i)).toBeInTheDocument();
      });

      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('allows saving template with unique name', async () => {
      const mockCreate = vi.fn().mockResolvedValue({ ok: true, template: { id: 'new-1', name: 'Unique Template' } });
      vi.mocked(useTemplates).mockReturnValue({
        templates: mockTemplates,
        isLoading: false,
        error: null,
        isRailwaySource: true,
        reload: vi.fn(),
        create: mockCreate,
        update: vi.fn(),
        deleteTemplate: vi.fn(),
        filterByCategory: vi.fn(),
        filterByTone: vi.fn(),
      });

      renderModal();

      // Fill in subject and body
      const subjectInput = screen.getByLabelText(/subject/i);
      const bodyInput = screen.getByLabelText(/message/i);
      await userEvent.type(subjectInput, 'Test Subject');
      await userEvent.type(bodyInput, 'Test body content');

      // Expand save as template section
      fireEvent.click(screen.getByText(/save as template/i));

      // Save with a unique name
      const nameInput = screen.getByPlaceholderText(/Q1 Outreach/i);
      await userEvent.type(nameInput, 'Unique Template Name');

      fireEvent.click(screen.getByText('Save Template'));

      await waitFor(() => {
        expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
          name: 'Unique Template Name',
        }));
      });
    });
  });
});
