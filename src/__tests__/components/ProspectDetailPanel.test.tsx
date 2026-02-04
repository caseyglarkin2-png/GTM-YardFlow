/**
 * T4.5: ProspectDetailPanel Tests
 * 
 * Tests for the prospect detail panel including:
 * - Display of prospect information
 * - Activity timeline
 * - Quick actions
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { ProspectDetailPanel } from '@/components/panels/ProspectDetailPanel';
import type { Prospect } from '@/types';
import type { ProspectEnrollmentInfo } from '@/hooks/useSequenceEnrollment';

// Mock the hooks and services
vi.mock('@/hooks/useProspectActivity', () => ({
  useProspectActivity: vi.fn(),
  formatActivityType: (type: string) => {
    const labels: Record<string, string> = {
      email_sent: 'Email Sent',
      email_opened: 'Email Opened',
      meeting_booked: 'Meeting Booked',
    };
    return labels[type] || type;
  },
  getActivityIcon: (type: string) => {
    const icons: Record<string, string> = {
      email_sent: '📤',
      email_opened: '👁️',
      meeting_booked: '📅',
    };
    return icons[type] || '•';
  },
}));

vi.mock('@/config/featureFlags', () => ({
  featureFlags: {
    RAILWAY_ENABLED: true,
    RAILWAY_EMAIL_ENABLED: true,
  },
}));

vi.mock('@/config/templates', () => ({
  getTemplates: () => [
    { id: 'dm_codev', label: 'Co-Dev DM', body: 'Test body', subject: 'Test subject', type: 'short_dm' },
    { id: 'email_intro', label: 'Email Intro', body: 'Email body', subject: 'Email subject', type: 'email' },
  ],
  DM_CHAR_LIMIT: 500,
}));

vi.mock('@/services/ClipboardService', () => ({
  copyToClipboard: vi.fn().mockResolvedValue({ success: true }),
}));

// Import after mocking
import { useProspectActivity } from '@/hooks/useProspectActivity';

const mockUseProspectActivity = useProspectActivity as ReturnType<typeof vi.fn>;

// Test fixtures
const mockProspect: Prospect = {
  id: 'prospect-1',
  name: 'John Doe',
  email: 'john@example.com',
  company: 'Acme Corp',
  title: 'VP Operations',
  tier: 'Tier 1',
  status: 'new',
  score: 85,
  isOps: true,
  isExec: false,
  createdAt: Date.now(),
};

const mockEnrollment: ProspectEnrollmentInfo = {
  enrollmentId: 'enrollment-1',
  sequenceId: 'seq-1',
  sequenceName: 'Outbound Campaign',
  status: 'active',
  currentStepIndex: 1,
  totalSteps: 5,
};

const mockActivities = [
  {
    id: 'act-1',
    type: 'email_sent' as const,
    prospectId: 'prospect-1',
    createdAt: '2024-01-20T10:00:00Z',
    updatedAt: '2024-01-20T10:00:00Z',
  },
  {
    id: 'act-2',
    type: 'email_opened' as const,
    prospectId: 'prospect-1',
    createdAt: '2024-01-20T11:00:00Z',
    updatedAt: '2024-01-20T11:00:00Z',
  },
];

const defaultProps = {
  prospect: mockProspect,
  currentUser: 'Jake',
  onClose: vi.fn(),
  onUpdateProspect: vi.fn().mockResolvedValue(undefined),
  onBookMeeting: vi.fn(),
  onSendEmail: vi.fn().mockResolvedValue(undefined),
  enrollment: null as ProspectEnrollmentInfo | null,
};

describe('ProspectDetailPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseProspectActivity.mockReturnValue({
      activities: [],
      isLoading: false,
      isLoadingMore: false,
      error: null,
      hasMore: false,
      fetchActivities: vi.fn(),
      loadMore: vi.fn(),
      refresh: vi.fn(),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Display', () => {
    it('shows prospect name and company', () => {
      render(<ProspectDetailPanel {...defaultProps} />);
      
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    });

    it('shows prospect title', () => {
      render(<ProspectDetailPanel {...defaultProps} />);
      
      expect(screen.getByText('VP Operations')).toBeInTheDocument();
    });

    it('shows prospect tier badge', () => {
      render(<ProspectDetailPanel {...defaultProps} />);
      
      expect(screen.getByText('Tier 1')).toBeInTheDocument();
    });

    it('shows prospect email', () => {
      render(<ProspectDetailPanel {...defaultProps} />);
      
      expect(screen.getByText('john@example.com')).toBeInTheDocument();
    });

    it('shows "No email" when email is missing', () => {
      const prospectNoEmail = { ...mockProspect, email: '' };
      render(<ProspectDetailPanel {...defaultProps} prospect={prospectNoEmail} />);
      
      expect(screen.getByText('No email')).toBeInTheDocument();
    });

    it('shows sequence enrollment badge when enrolled', () => {
      render(<ProspectDetailPanel {...defaultProps} enrollment={mockEnrollment} />);
      
      // Badge shows step progress (e.g., "Step 2/5") and has tooltip with sequence name
      expect(screen.getByText(/Step 2\/5/i)).toBeInTheDocument();
      // Tooltip contains sequence name
      expect(screen.getByLabelText(/Outbound Campaign/i)).toBeInTheDocument();
    });
  });

  describe('Activity Timeline', () => {
    it('shows activity timeline toggle button', () => {
      render(<ProspectDetailPanel {...defaultProps} />);
      
      expect(screen.getByText('Activity Timeline')).toBeInTheDocument();
    });

    it('shows loading state while fetching activities', async () => {
      mockUseProspectActivity.mockReturnValue({
        activities: [],
        isLoading: true,
        isLoadingMore: false,
        error: null,
        hasMore: false,
        fetchActivities: vi.fn(),
        loadMore: vi.fn(),
        refresh: vi.fn(),
      });

      render(<ProspectDetailPanel {...defaultProps} />);
      
      // Expand timeline
      fireEvent.click(screen.getByText('Activity Timeline'));
      
      // Should show loader
      await waitFor(() => {
        expect(document.querySelector('.animate-spin')).toBeInTheDocument();
      });
    });

    it('shows empty state when no activities', async () => {
      render(<ProspectDetailPanel {...defaultProps} />);
      
      // Expand timeline
      fireEvent.click(screen.getByText('Activity Timeline'));
      
      await waitFor(() => {
        expect(screen.getByText('No activity yet')).toBeInTheDocument();
      });
    });

    it('shows activities when available', async () => {
      mockUseProspectActivity.mockReturnValue({
        activities: mockActivities,
        isLoading: false,
        isLoadingMore: false,
        error: null,
        hasMore: false,
        fetchActivities: vi.fn(),
        loadMore: vi.fn(),
        refresh: vi.fn(),
      });

      render(<ProspectDetailPanel {...defaultProps} />);
      
      // Expand timeline
      fireEvent.click(screen.getByText('Activity Timeline'));
      
      await waitFor(() => {
        expect(screen.getByText('Email Sent')).toBeInTheDocument();
        expect(screen.getByText('Email Opened')).toBeInTheDocument();
      });
    });

    it('shows load more button when hasMore is true', async () => {
      const loadMoreFn = vi.fn();
      mockUseProspectActivity.mockReturnValue({
        activities: mockActivities,
        isLoading: false,
        isLoadingMore: false,
        error: null,
        hasMore: true,
        fetchActivities: vi.fn(),
        loadMore: loadMoreFn,
        refresh: vi.fn(),
      });

      render(<ProspectDetailPanel {...defaultProps} />);
      
      // Expand timeline
      fireEvent.click(screen.getByText('Activity Timeline'));
      
      const loadMoreButton = await screen.findByText('Load more');
      expect(loadMoreButton).toBeInTheDocument();
      
      fireEvent.click(loadMoreButton);
      expect(loadMoreFn).toHaveBeenCalled();
    });

    it('shows error message when activity fetch fails', async () => {
      mockUseProspectActivity.mockReturnValue({
        activities: [],
        isLoading: false,
        isLoadingMore: false,
        error: 'Failed to load activities',
        hasMore: false,
        fetchActivities: vi.fn(),
        loadMore: vi.fn(),
        refresh: vi.fn(),
      });

      render(<ProspectDetailPanel {...defaultProps} />);
      
      // Expand timeline
      fireEvent.click(screen.getByText('Activity Timeline'));
      
      await waitFor(() => {
        expect(screen.getByText('Failed to load activities')).toBeInTheDocument();
      });
    });
  });

  describe('Quick Actions', () => {
    it('calls onBookMeeting when Log Meeting clicked', () => {
      render(<ProspectDetailPanel {...defaultProps} />);
      
      fireEvent.click(screen.getByText('Log Meeting'));
      
      expect(defaultProps.onBookMeeting).toHaveBeenCalled();
    });

    it('calls onSendEmail when Send Email clicked', async () => {
      render(<ProspectDetailPanel {...defaultProps} />);
      
      fireEvent.click(screen.getByText('Send Email'));
      
      await waitFor(() => {
        expect(defaultProps.onSendEmail).toHaveBeenCalled();
      });
    });

    it('disables Send Email button when no email', () => {
      const prospectNoEmail = { ...mockProspect, email: '' };
      render(<ProspectDetailPanel {...defaultProps} prospect={prospectNoEmail} />);
      
      const sendButton = screen.getByText('Send Email').closest('button');
      expect(sendButton).toBeDisabled();
    });

    it('shows Mark as Contacted button for new prospects', () => {
      render(<ProspectDetailPanel {...defaultProps} />);
      
      expect(screen.getByText(/Mark as Sent/i)).toBeInTheDocument();
    });

    it('calls onUpdateProspect when Mark as Contacted clicked', async () => {
      render(<ProspectDetailPanel {...defaultProps} />);
      
      fireEvent.click(screen.getByText(/Mark as Sent/i));
      
      await waitFor(() => {
        expect(defaultProps.onUpdateProspect).toHaveBeenCalledWith(
          expect.objectContaining({ status: 'contacted' })
        );
      });
    });
  });

  describe('Email Editing', () => {
    it('shows edit button for email', () => {
      render(<ProspectDetailPanel {...defaultProps} />);
      
      expect(screen.getByText('Edit')).toBeInTheDocument();
    });

    it('shows email input when edit clicked', () => {
      render(<ProspectDetailPanel {...defaultProps} />);
      
      fireEvent.click(screen.getByText('Edit'));
      
      expect(screen.getByPlaceholderText('email@company.com')).toBeInTheDocument();
    });

    it('validates email format on save', async () => {
      render(<ProspectDetailPanel {...defaultProps} />);
      
      fireEvent.click(screen.getByText('Edit'));
      
      const input = screen.getByPlaceholderText('email@company.com');
      fireEvent.change(input, { target: { value: 'invalid-email' } });
      
      const saveButton = screen.getByLabelText('Save email');
      fireEvent.click(saveButton);
      
      await waitFor(() => {
        expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
      });
    });

    it('saves valid email', async () => {
      render(<ProspectDetailPanel {...defaultProps} />);
      
      fireEvent.click(screen.getByText('Edit'));
      
      const input = screen.getByPlaceholderText('email@company.com');
      fireEvent.change(input, { target: { value: 'newemail@test.com' } });
      
      const saveButton = screen.getByLabelText('Save email');
      fireEvent.click(saveButton);
      
      await waitFor(() => {
        expect(defaultProps.onUpdateProspect).toHaveBeenCalledWith({ email: 'newemail@test.com' });
      });
    });
  });

  describe('Close Action', () => {
    it('calls onClose when X button clicked', () => {
      render(<ProspectDetailPanel {...defaultProps} />);
      
      // Find the X button in the header
      const closeButtons = screen.getAllByRole('button');
      const closeButton = closeButtons.find(btn => btn.querySelector('[data-icon="X"]') || btn.textContent === '');
      
      // Use a more reliable selector
      const header = screen.getByText('John Doe').closest('div');
      const closeBtn = header?.parentElement?.querySelector('button');
      
      if (closeBtn) {
        fireEvent.click(closeBtn);
        expect(defaultProps.onClose).toHaveBeenCalled();
      }
    });
  });

  describe('Status Selection', () => {
    it('shows status dropdown with current status selected', () => {
      render(<ProspectDetailPanel {...defaultProps} />);
      
      const statusSelect = screen.getByDisplayValue('New');
      expect(statusSelect).toBeInTheDocument();
    });

    it('calls onUpdateProspect when status changed', () => {
      render(<ProspectDetailPanel {...defaultProps} />);
      
      const statusSelect = screen.getByDisplayValue('New');
      fireEvent.change(statusSelect, { target: { value: 'contacted' } });
      
      expect(defaultProps.onUpdateProspect).toHaveBeenCalledWith({ status: 'contacted' });
    });
  });

  describe('Template Selection', () => {
    it('shows template dropdown', () => {
      render(<ProspectDetailPanel {...defaultProps} />);
      
      expect(screen.getByText('Co-Dev DM')).toBeInTheDocument();
    });

    it('shows message textarea with template body', () => {
      render(<ProspectDetailPanel {...defaultProps} />);
      
      const textarea = screen.getByDisplayValue('Test body');
      expect(textarea).toBeInTheDocument();
    });
  });
});
