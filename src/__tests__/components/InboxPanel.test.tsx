/**
 * Tests for InboxPanel component
 * Sprint 201: Reply Inbox Feature
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { InboxPanel } from '@/components/InboxPanel';
import type { UseInboxRepliesReturn, InboxReply } from '@/hooks/useInboxReplies';

// Mock the hook
const mockMarkAsHandled = vi.fn();
const mockMarkAllAsHandled = vi.fn();
const mockRefresh = vi.fn();

const mockHookReturn: UseInboxRepliesReturn = {
  replies: [],
  unhandledCount: 0,
  isLoading: false,
  error: null,
  markAsHandled: mockMarkAsHandled,
  markAllAsHandled: mockMarkAllAsHandled,
  refresh: mockRefresh,
};

vi.mock('@/hooks/useInboxReplies', () => ({
  useInboxReplies: () => mockHookReturn,
}));

describe('InboxPanel', () => {
  const createMockReplies = (): InboxReply[] => [
    {
      id: 'reply-1',
      prospectId: 'prospect-1',
      prospectName: 'John Doe',
      prospectEmail: 'john@example.com',
      company: 'Acme Inc',
      lastReplyAt: Date.now() - 3600000,
      lastReplyType: 'human_reply',
      lastReplyId: 'msg-1',
      prospect: {} as InboxReply['prospect'],
    },
    {
      id: 'reply-2',
      prospectId: 'prospect-2',
      prospectName: 'Jane Smith',
      prospectEmail: 'jane@example.com',
      company: 'Tech Corp',
      lastReplyAt: Date.now() - 7200000,
      lastReplyType: 'out_of_office',
      lastReplyId: 'msg-2',
      prospect: {} as InboxReply['prospect'],
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock return values
    Object.assign(mockHookReturn, {
      replies: [],
      unhandledCount: 0,
      isLoading: false,
      error: null,
    });
    mockMarkAsHandled.mockResolvedValue(true);
    mockMarkAllAsHandled.mockResolvedValue(true);
    mockRefresh.mockResolvedValue(undefined);
  });

  it('should render loading state', () => {
    mockHookReturn.isLoading = true;
    
    render(<InboxPanel />);
    
    expect(screen.getByText('Reply Inbox')).toBeInTheDocument();
    // Should show skeleton loading
    const panel = screen.getByText('Reply Inbox').closest('div');
    expect(panel).toBeInTheDocument();
  });

  it('should render empty state when no replies', () => {
    render(<InboxPanel />);
    
    expect(screen.getByText('All caught up!')).toBeInTheDocument();
    expect(screen.getByText('No replies need your attention right now.')).toBeInTheDocument();
  });

  it('should render list of replies', () => {
    const replies = createMockReplies();
    mockHookReturn.replies = replies;
    mockHookReturn.unhandledCount = 2;

    render(<InboxPanel />);

    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    expect(screen.getByText('john@example.com')).toBeInTheDocument();
    expect(screen.getByText('Acme Inc')).toBeInTheDocument();
  });

  it('should show badge count', () => {
    mockHookReturn.replies = createMockReplies();
    mockHookReturn.unhandledCount = 2;

    render(<InboxPanel />);

    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('should show reply type badges', () => {
    mockHookReturn.replies = createMockReplies();
    mockHookReturn.unhandledCount = 2;

    render(<InboxPanel />);

    expect(screen.getByText('Reply')).toBeInTheDocument();
    expect(screen.getByText('OOO')).toBeInTheDocument();
  });

  it('should call markAsHandled when clicking handled button', async () => {
    mockHookReturn.replies = createMockReplies();
    mockHookReturn.unhandledCount = 2;

    render(<InboxPanel />);

    const handledButtons = screen.getAllByText('Handled');
    fireEvent.click(handledButtons[0]);

    await waitFor(() => {
      expect(mockMarkAsHandled).toHaveBeenCalledWith('prospect-1');
    });
  });

  it('should call markAllAsHandled when clicking mark all button', async () => {
    mockHookReturn.replies = createMockReplies();
    mockHookReturn.unhandledCount = 2;

    render(<InboxPanel />);

    const markAllButton = screen.getByText('Mark all handled');
    fireEvent.click(markAllButton);

    await waitFor(() => {
      expect(mockMarkAllAsHandled).toHaveBeenCalled();
    });
  });

  it('should call refresh when clicking refresh button', async () => {
    mockHookReturn.replies = createMockReplies();
    mockHookReturn.unhandledCount = 2;

    render(<InboxPanel />);

    const refreshButton = screen.getByTitle('Refresh');
    fireEvent.click(refreshButton);

    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  it('should call onProspectClick when clicking prospect name', () => {
    const onProspectClick = vi.fn();
    mockHookReturn.replies = createMockReplies();
    mockHookReturn.unhandledCount = 2;

    render(<InboxPanel onProspectClick={onProspectClick} />);

    fireEvent.click(screen.getByText('John Doe'));

    expect(onProspectClick).toHaveBeenCalledWith('prospect-1');
  });

  it('should render error state', () => {
    mockHookReturn.error = new Error('Failed to load');

    render(<InboxPanel />);

    expect(screen.getByText('Failed to load')).toBeInTheDocument();
    expect(screen.getByText('Retry')).toBeInTheDocument();
  });

  it('should retry on error', async () => {
    mockHookReturn.error = new Error('Failed to load');

    render(<InboxPanel />);

    fireEvent.click(screen.getByText('Retry'));

    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  it('should show footer with count', () => {
    mockHookReturn.replies = createMockReplies();
    mockHookReturn.unhandledCount = 2;

    render(<InboxPanel />);

    expect(screen.getByText('2 replies awaiting response')).toBeInTheDocument();
  });

  it('should show singular text for single reply', () => {
    mockHookReturn.replies = [createMockReplies()[0]];
    mockHookReturn.unhandledCount = 1;

    render(<InboxPanel />);

    expect(screen.getByText('1 reply awaiting response')).toBeInTheDocument();
  });
});
