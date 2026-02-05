/**
 * T3.5: BulkEmailModal Compose Flow Integration Tests
 * Sprint S3: Email Compose Flow
 * 
 * Tests for:
 * - AI Generation with tone selection
 * - Live Preview with personalization
 * - Character count validation
 * - Send confirmation flow
 * - Debounce on AI generate
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BulkEmailModal } from '@/components/BulkEmailModal';
import type { Prospect } from '@/types';
import type { EmailTemplateRecord, TemplateCategory, TemplateTone } from '@/types/railway';

import type { GenerateParams, GenerateResult } from '@/hooks/useAIGenerate';

import { useTemplates } from '@/hooks/useTemplates';
import { useAIGenerate } from '@/hooks/useAIGenerate';
import { useBulkEmailSend } from '@/hooks/useBulkEmailSend';

// Mock dependencies
vi.mock('@/hooks/useTemplates', () => ({
  useTemplates: vi.fn(),
}));

vi.mock('@/hooks/useAIGenerate', () => ({
  useAIGenerate: vi.fn(),
}));

vi.mock('@/hooks/useBulkEmailSend', () => ({
  useBulkEmailSend: vi.fn(),
}));

vi.mock('@/config/featureFlags', () => ({
  shouldUseRailwayTemplates: () => true,
  featureFlags: { RAILWAY_TEMPLATES_ENABLED: true },
}));

const mockTemplates: EmailTemplateRecord[] = [
  {
    id: 'template-1',
    name: 'Default Template',
    subject: 'Hello {name}',
    body: 'Hi {first_name}, this is a test for {company}.',
    category: 'outreach' as TemplateCategory,
    tone: 'professional' as TemplateTone,
    isDefault: true,
    createdBy: 'system',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
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
    createdAt: 1704067200000,
  },
  {
    id: 'prospect-2',
    name: 'Jane Smith',
    email: 'jane@widgets.com',
    company: 'Widgets LLC',
    title: 'CFO',
    tier: 'T2',
    status: 'new',
    score: 70,
    isOps: true,
    isExec: false,
    createdAt: 1704067200000,
  },
];

const mockProspectNoEmail: Prospect = {
  id: 'prospect-3',
  name: 'Bob NoEmail',
  email: undefined as unknown as string, // No email - should be skipped
  company: 'NoMail Corp',
  title: 'Director',
  tier: 'T3',
  status: 'new',
  score: 50,
  isOps: false,
  isExec: false,
  createdAt: 1704067200000,
};

describe('BulkEmailModal - Compose Flow', () => {
  let mockGenerate: Mock<(params: GenerateParams) => Promise<GenerateResult>>;
  let mockClearError: Mock<() => void>;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockGenerate = vi.fn().mockResolvedValue({
      success: true,
      subject: 'AI Generated Subject',
      content: 'AI Generated Body',
    });
    mockClearError = vi.fn();

    // Setup useTemplates mock
    vi.mocked(useTemplates).mockReturnValue({
      templates: mockTemplates,
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

    // Setup useAIGenerate mock
    vi.mocked(useAIGenerate).mockReturnValue({
      generate: mockGenerate,
      isGenerating: false,
      error: null,
      clearError: mockClearError,
    });

    // Setup useBulkEmailSend mock
    vi.mocked(useBulkEmailSend).mockReturnValue({
      recipients: [],
      progress: { sent: 0, failed: 0, total: 0, generated: 0 },
      isProcessing: false,
      initRecipients: vi.fn(),
      generateForRecipient: vi.fn(),
      generateAll: vi.fn(),
      sendRecipient: vi.fn(),
      sendAll: vi.fn(),
      updateRecipientContent: vi.fn(),
      approveRecipient: vi.fn(),
      approveAll: vi.fn(),
      reset: vi.fn(),
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

  describe('AI Generation (T3.1)', () => {
    it('shows tone selector with options', () => {
      renderModal();

      const toneSelect = screen.getByLabelText(/tone/i);
      expect(toneSelect).toBeInTheDocument();
      
      // Check available options
      const options = screen.getAllByRole('option');
      const toneOptionNames = options.map(o => o.textContent?.toLowerCase());
      expect(toneOptionNames.some(t => t?.includes('professional'))).toBe(true);
      expect(toneOptionNames.some(t => t?.includes('freightroll'))).toBe(true);
    });

    it('shows generate AI button', () => {
      renderModal();

      // Button text is "Generate ✨"
      expect(screen.getByRole('button', { name: /generate/i })).toBeInTheDocument();
    });

    it('generates content with selected tone', async () => {
      renderModal();

      // Change tone to 'freightroll'
      const toneSelect = screen.getByLabelText(/tone/i);
      await userEvent.selectOptions(toneSelect, 'freightroll');

      // Click generate
      const generateBtn = screen.getByRole('button', { name: /generate/i });
      fireEvent.click(generateBtn);

      await waitFor(() => {
        expect(mockGenerate).toHaveBeenCalledWith(
          expect.objectContaining({
            tone: 'freightroll',
          })
        );
      });
    });

    it('shows loading state during generation', async () => {
      vi.mocked(useAIGenerate).mockReturnValue({
        generate: mockGenerate,
        isGenerating: true,
        error: null,
        clearError: mockClearError,
      });

      renderModal();

      expect(screen.getByText(/generating/i)).toBeInTheDocument();
    });
  });

  describe('Preview (T3.2)', () => {
    it('shows preview panel with prospect data', async () => {
      renderModal();

      // Type subject with token
      const subjectInput = screen.getByLabelText(/subject/i);
      await userEvent.clear(subjectInput);
      await userEvent.type(subjectInput, 'Hello {name}');

      // Click Preview button
      fireEvent.click(screen.getByText(/preview/i));

      // Should show personalized content for first prospect
      await waitFor(() => {
        expect(screen.getByText(/preview for/i)).toBeInTheDocument();
      });
    });

    it('shows recipient count in header', () => {
      renderModal();

      // The header should show how many will receive the email
      // Text might be "2 prospects will receive this email"
      expect(screen.getByText(/\d+ prospects will receive/i)).toBeInTheDocument();
    });
  });

  describe('Character Count Validation (T3.3)', () => {
    it('displays character count for body when tone has limit', async () => {
      renderModal();

      // Select 'freightroll' tone which has a character limit
      const toneSelect = screen.getByLabelText(/tone/i);
      await userEvent.selectOptions(toneSelect, 'freightroll');

      const bodyInput = screen.getByLabelText(/message/i);
      await userEvent.clear(bodyInput);
      await userEvent.type(bodyInput, 'Test content');

      // Wait for the character count to appear (format: N/250 for freightroll)
      await waitFor(() => {
        expect(screen.getByText(/\d+\/250/)).toBeInTheDocument();
      });
    });
  });

  describe('Skipped Recipients (T3.4)', () => {
    it('shows warning for prospects without email', async () => {
      renderModal({
        selectedProspects: [...mockProspects, mockProspectNoEmail],
      });

      // The skipped warning should be visible - may take a moment to render
      await waitFor(() => {
        // Use queryByText first to check what's there
        const warning = screen.queryByText(/will be skipped/i);
        expect(warning).toBeInTheDocument();
      }, { timeout: 2000 });
    });

    it('shows missing email reason', async () => {
      renderModal({
        selectedProspects: [...mockProspects, mockProspectNoEmail],
      });

      // Should explain why prospects are skipped
      await waitFor(() => {
        expect(screen.getByText(/add missing emails/i)).toBeInTheDocument();
      });
    });
  });

  describe('Debounce (T3.6)', () => {
    it('debounces rapid AI generate clicks', async () => {
      renderModal();

      const generateBtn = screen.getByRole('button', { name: /generate/i });
      
      // Click twice rapidly
      fireEvent.click(generateBtn);
      
      // Wait a tiny bit then click again
      await new Promise(r => setTimeout(r, 100));
      fireEvent.click(generateBtn);

      // Should only call once (or show debounce message)
      // Due to 3 second debounce, second click should be blocked
      expect(mockGenerate).toHaveBeenCalledTimes(1);
    });
  });

  describe('Send Flow', () => {
    it('shows send button with recipient count', async () => {
      renderModal();

      // Fill required fields
      const subjectInput = screen.getByLabelText(/subject/i);
      const bodyInput = screen.getByLabelText(/message/i);
      await userEvent.type(subjectInput, 'Test Subject');
      await userEvent.type(bodyInput, 'Test Body');

      // Should show send button
      expect(screen.getByRole('button', { name: /send/i })).toBeInTheDocument();
    });

    it('disables send when subject is empty', async () => {
      renderModal();

      const bodyInput = screen.getByLabelText(/message/i);
      await userEvent.type(bodyInput, 'Test Body');

      // Clear subject
      const subjectInput = screen.getByLabelText(/subject/i);
      await userEvent.clear(subjectInput);

      // Send should be disabled (either via disabled prop or validation message)
      const sendBtn = screen.getByRole('button', { name: /send/i });
      expect(sendBtn).toBeDisabled();
    });

    it('disables send when body is empty', async () => {
      renderModal();

      // Type subject only
      const subjectInput = screen.getByLabelText(/subject/i);
      await userEvent.type(subjectInput, 'Test Subject');

      // Ensure body is empty
      const bodyInput = screen.getByLabelText(/message/i);
      await userEvent.clear(bodyInput);

      // Send should be disabled
      const sendBtn = screen.getByRole('button', { name: /send/i });
      expect(sendBtn).toBeDisabled();
    });
  });
});
