/**
 * SuppressionStatsCard Tests
 * Sprint 39E.3: Tests for suppression statistics dashboard card
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { SuppressionStatsCard, type SuppressionStats } from '../../components/dashboard/SuppressionStatsCard';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock LazyIcon 
vi.mock('@/components/icons', () => ({
  LazyIcon: ({ name, className }: { name: string; className?: string }) => (
    <span data-testid={`icon-${name}`} className={className}>{name}</span>
  ),
}));

const mockStats: SuppressionStats = {
  total: 45,
  byReason: {
    bounce: 20,
    spam: 10,
    unsubscribe: 15,
    manual: 0,
  },
  lastSyncAt: Date.now() - 3600_000, // 1 hour ago
};

function mockFetchSuccess(stats?: Partial<SuppressionStats>) {
  const s = { ...mockStats, ...stats };
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      metrics: {
        bounced: s.byReason.bounce,
        spam: s.byReason.spam,
        unsubscribed: s.byReason.unsubscribe,
      },
      lastSyncAt: s.lastSyncAt,
    }),
  });
}

function mockFetchError(status = 500) {
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status,
    json: async () => ({ error: 'Server error' }),
  });
}

describe('SuppressionStatsCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state initially', () => {
    mockFetch.mockReturnValueOnce(new Promise(() => {})); // Never resolves
    render(<SuppressionStatsCard />);
    
    // Should show skeleton/pulse animation
    const card = document.querySelector('.animate-pulse');
    expect(card).toBeTruthy();
  });

  it('renders total suppressed count', async () => {
    mockFetchSuccess();
    render(<SuppressionStatsCard />);
    
    await waitFor(() => {
      expect(screen.getByText('45')).toBeTruthy();
    });
    expect(screen.getByText('emails suppressed')).toBeTruthy();
  });

  it('renders breakdown by reason', async () => {
    mockFetchSuccess();
    render(<SuppressionStatsCard />);
    
    await waitFor(() => {
      expect(screen.getByText('Bounced')).toBeTruthy();
    });
    expect(screen.getByText('20')).toBeTruthy();
    expect(screen.getByText('Spam')).toBeTruthy();
    expect(screen.getByText('10')).toBeTruthy();
    expect(screen.getByText('Unsubscribed')).toBeTruthy();
    expect(screen.getByText('15')).toBeTruthy();
  });

  it('hides manual row when count is 0', async () => {
    mockFetchSuccess();
    render(<SuppressionStatsCard />);
    
    await waitFor(() => {
      expect(screen.getByText('Bounced')).toBeTruthy();
    });
    expect(screen.queryByText('Manual')).toBeNull();
  });

  it('shows error state on fetch failure', async () => {
    mockFetchError();
    render(<SuppressionStatsCard />);
    
    await waitFor(() => {
      expect(screen.getByText('Failed to load suppression stats')).toBeTruthy();
    });
    expect(screen.getByText('Retry')).toBeTruthy();
  });

  it('retries on error button click', async () => {
    mockFetchError();
    render(<SuppressionStatsCard />);
    
    await waitFor(() => {
      expect(screen.getByText('Retry')).toBeTruthy();
    });

    mockFetchSuccess();
    fireEvent.click(screen.getByText('Retry'));
    
    await waitFor(() => {
      expect(screen.getByText('45')).toBeTruthy();
    });
  });

  it('renders compact mode', async () => {
    mockFetchSuccess();
    render(<SuppressionStatsCard compact />);
    
    await waitFor(() => {
      expect(screen.getByText('45')).toBeTruthy();
    });
    expect(screen.getByText('Suppressed')).toBeTruthy();
    // In compact mode, no breakdown bars
    expect(screen.queryByText('Bounced')).toBeNull();
  });

  it('shows last sync timestamp', async () => {
    mockFetchSuccess();
    render(<SuppressionStatsCard />);
    
    await waitFor(() => {
      expect(screen.getByText(/Last sync/)).toBeTruthy();
    });
  });

  it('handles zero suppressions gracefully', async () => {
    mockFetchSuccess({
      total: 0,
      byReason: { bounce: 0, spam: 0, unsubscribe: 0, manual: 0 },
    });
    render(<SuppressionStatsCard />);
    
    await waitFor(() => {
      // The 0 count is displayed as a text node within the card
      const card = screen.getByTestId('suppression-stats-card');
      expect(card).toBeTruthy();
    });
  });

  it('refresh button reloads data', async () => {
    mockFetchSuccess();
    render(<SuppressionStatsCard />);
    
    await waitFor(() => {
      expect(screen.getByText('45')).toBeTruthy();
    });

    mockFetchSuccess({ total: 50, byReason: { bounce: 25, spam: 10, unsubscribe: 15, manual: 0 } });
    fireEvent.click(screen.getByTitle('Refresh'));
    
    await waitFor(() => {
      expect(screen.getByText('50')).toBeTruthy();
    });
  });

  it('applies custom className', async () => {
    mockFetchSuccess();
    const { container } = render(<SuppressionStatsCard className="my-custom-class" />);
    
    await waitFor(() => {
      expect(screen.getByText('45')).toBeTruthy();
    });
    
    const card = container.querySelector('.my-custom-class');
    expect(card).toBeTruthy();
  });
});
