/**
 * BulkEmailModal Tests - Sprint 27: F5/F6
 * 
 * Tests for bulk email modal with template and AI modes
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BulkEmailModal, type BulkEmailModalProps } from '../../components/BulkEmailModal';
import type { Prospect } from '../../types';
import type { BulkRecipient, BulkSendProgress } from '../../hooks/useBulkEmailSend';

// Mock the icon component
vi.mock('../../components/icons', () => ({
  LazyIcon: ({ name, className }: { name: string; className?: string }) => (
    <span data-testid={`icon-${name}`} className={className}>{name}</span>
  ),
}));

// Mock useAIGenerate hook
vi.mock('../../hooks/useAIGenerate', () => ({
  useAIGenerate: () => ({
    generate: vi.fn().mockResolvedValue({ success: true, subject: 'AI Subject', content: 'AI Body' }),
    isGenerating: false,
    error: null,
    clearError: vi.fn(),
  }),
}));

// Mock useBulkEmailSend hook
const mockBulkSend: {
  recipients: BulkRecipient[];
  initRecipients: ReturnType<typeof vi.fn>;
  generateForRecipient: ReturnType<typeof vi.fn>;
  generateAll: ReturnType<typeof vi.fn>;
  sendRecipient: ReturnType<typeof vi.fn>;
  sendAll: ReturnType<typeof vi.fn>;
  updateRecipientContent: ReturnType<typeof vi.fn>;
  progress: BulkSendProgress;
  isProcessing: boolean;
  reset: ReturnType<typeof vi.fn>;
} = {
  recipients: [],
  initRecipients: vi.fn(),
  generateForRecipient: vi.fn(),
  generateAll: vi.fn(),
  sendRecipient: vi.fn(),
  sendAll: vi.fn(),
  updateRecipientContent: vi.fn(),
  progress: { total: 0, generated: 0, sent: 0, failed: 0 },
  isProcessing: false,
  reset: vi.fn(),
};

vi.mock('../../hooks/useBulkEmailSend', () => ({
  useBulkEmailSend: () => mockBulkSend,
}));

const mockProspects: Prospect[] = [
  {
    id: 'p1',
    name: 'John Doe',
    email: 'john@acme.com',
    company: 'Acme Corp',
    title: 'VP Operations',
    tier: 'T1',
    status: 'new',
    score: 85,
    isOps: true,
    isExec: true,
    createdAt: Date.now(),
  },
  {
    id: 'p2',
    name: 'Jane Smith',
    email: 'jane@logistics.com',
    company: 'Logistics Inc',
    title: 'Director',
    tier: 'T2',
    status: 'new',
    score: 70,
    isOps: false,
    isExec: false,
    createdAt: Date.now(),
  },
];

const defaultProps: BulkEmailModalProps = {
  isOpen: true,
  onClose: vi.fn(),
  onConfirm: vi.fn().mockResolvedValue(undefined),
  selectedProspects: mockProspects,
  isSending: false,
  progress: { sent: 0, total: 0, failed: 0 },
};

describe('BulkEmailModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBulkSend.recipients = [];
    mockBulkSend.progress = { total: 0, generated: 0, sent: 0, failed: 0 };
  });

  describe('Mode Toggle', () => {
    it('defaults to template mode', () => {
      render(<BulkEmailModal {...defaultProps} />);
      
      // Template mode button should be active (have blue bg)
      const templateBtn = screen.getByRole('button', { name: /same template/i });
      expect(templateBtn).toHaveClass('bg-blue-600');
    });

    it('shows subject and body fields in template mode', () => {
      render(<BulkEmailModal {...defaultProps} />);
      
      // Check for "Subject Line" label text
      expect(screen.getByText(/subject line/i)).toBeInTheDocument();
      expect(screen.getByText(/message body/i)).toBeInTheDocument();
    });

    it('can switch to AI mode', async () => {
      render(<BulkEmailModal {...defaultProps} />);
      
      const aiBtn = screen.getByRole('button', { name: /ai per-recipient/i });
      fireEvent.click(aiBtn);
      
      // AI mode button should now have gradient
      expect(aiBtn).toHaveClass('from-purple-600');
    });

    it('initializes recipients when switching to AI mode', async () => {
      render(<BulkEmailModal {...defaultProps} />);
      
      const aiBtn = screen.getByRole('button', { name: /ai per-recipient/i });
      fireEvent.click(aiBtn);
      
      await waitFor(() => {
        expect(mockBulkSend.initRecipients).toHaveBeenCalled();
      });
    });

    it('resets bulk state when switching back to template mode', async () => {
      render(<BulkEmailModal {...defaultProps} />);
      
      // Switch to AI mode first
      fireEvent.click(screen.getByRole('button', { name: /ai per-recipient/i }));
      
      // Switch back to template mode
      fireEvent.click(screen.getByRole('button', { name: /same template/i }));
      
      expect(mockBulkSend.reset).toHaveBeenCalled();
    });
  });

  describe('Template Mode', () => {
    it('shows prospect count in send button', () => {
      render(<BulkEmailModal {...defaultProps} />);
      
      expect(screen.getByRole('button', { name: /send to 2 prospects/i })).toBeInTheDocument();
    });

    it('calls onConfirm with subject and body on submit', async () => {
      const onConfirm = vi.fn().mockResolvedValue(undefined);
      render(<BulkEmailModal {...defaultProps} onConfirm={onConfirm} />);
      
      // Submit
      fireEvent.click(screen.getByRole('button', { name: /send to 2 prospects/i }));
      
      await waitFor(() => {
        expect(onConfirm).toHaveBeenCalled();
      });
    });
  });

  describe('AI Mode', () => {
    beforeEach(() => {
      mockBulkSend.recipients = [
        { 
          id: 'p1', 
          prospect: mockProspects[0], 
          status: 'pending' as const,
          subject: 'Template subject',
          body: 'Template body',
          idempotencyKey: 'key-1',
        },
        { 
          id: 'p2', 
          prospect: mockProspects[1], 
          status: 'pending' as const,
          subject: 'Template subject',
          body: 'Template body',
          idempotencyKey: 'key-2',
        },
      ];
      mockBulkSend.progress = { total: 2, generated: 0, sent: 0, failed: 0 };
    });

    it('shows Generate All button in AI mode', () => {
      render(<BulkEmailModal {...defaultProps} />);
      
      // Switch to AI mode
      fireEvent.click(screen.getByRole('button', { name: /ai per-recipient/i }));
      
      expect(screen.getByRole('button', { name: /generate all/i })).toBeInTheDocument();
    });

    it('calls generateAll when Generate All clicked', async () => {
      render(<BulkEmailModal {...defaultProps} />);
      
      // Switch to AI mode
      fireEvent.click(screen.getByRole('button', { name: /ai per-recipient/i }));
      
      // Click Generate All
      fireEvent.click(screen.getByRole('button', { name: /generate all/i }));
      
      await waitFor(() => {
        expect(mockBulkSend.generateAll).toHaveBeenCalled();
      });
    });

    it('shows ready count in footer when recipients are generated', () => {
      mockBulkSend.recipients = [
        { 
          id: 'p1', 
          prospect: mockProspects[0], 
          status: 'generated' as const,
          subject: 'AI Subject',
          body: 'AI Body',
          idempotencyKey: 'key-1',
        },
        { 
          id: 'p2', 
          prospect: mockProspects[1], 
          status: 'pending' as const,
          subject: '',
          body: '',
          idempotencyKey: 'key-2',
        },
      ];
      mockBulkSend.progress = { total: 2, generated: 1, sent: 0, failed: 0 };

      render(<BulkEmailModal {...defaultProps} />);
      
      // Switch to AI mode
      fireEvent.click(screen.getByRole('button', { name: /ai per-recipient/i }));
      
      // Should show "ready to send" text in footer
      expect(screen.getByText(/ready to send/i)).toBeInTheDocument();
      // And the send button should show "Send 1 personalized"
      expect(screen.getByRole('button', { name: /send 1 personalized/i })).toBeInTheDocument();
    });
  });

  describe('Skipped Prospects', () => {
    it('shows warning when some prospects have no email', () => {
      const prospectsWithMissing: Prospect[] = [
        ...mockProspects,
        {
          id: 'p3',
          name: 'No Email User',
          email: '',
          company: 'Test Corp',
          title: 'Manager',
          tier: 'T3',
          status: 'new',
          score: 50,
          isOps: false,
          isExec: false,
          createdAt: Date.now(),
        },
      ];
      
      render(<BulkEmailModal {...defaultProps} selectedProspects={prospectsWithMissing} />);
      
      expect(screen.getByText(/1 prospect.*will be skipped/i)).toBeInTheDocument();
    });
  });
});
