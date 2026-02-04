/**
 * T1.4: RailwayHealthCard Component Tests
 * Sprint S1: Health Dashboard Enhancement
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { RailwayHealthCard } from '@/components/RailwayHealthCard';
import { railwayClient } from '@/services/RailwayApiClient';
import type { RailwayHealthResponse, RailwayApiResult } from '@/types/railway';

// Mock the Railway client
vi.mock('@/services/RailwayApiClient', () => ({
  railwayClient: {
    health: {
      check: vi.fn(),
    },
  },
}));

const mockHealthResponse: RailwayHealthResponse = {
  status: 'healthy',
  timestamp: '2026-02-04T10:00:00Z',
  checks: {
    database: { status: 'ok', latencyMs: 5 },
    redis: { status: 'ok', latencyMs: 2 },
    queues: {
      enrichment: 'ready',
      outreach: 'ready',
      emails: 'ready',
      sequence: 'ready',
    },
    ai: {
      gemini: { status: 'ok', latencyMs: 150, quotaRemaining: 1000 },
      openai: { status: 'ok', latencyMs: 200 },
    },
  },
  version: '1.2.3',
  uptime: 86400,
};

describe('RailwayHealthCard', () => {
  beforeEach(() => {
    vi.mocked(railwayClient.health.check).mockReset();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  it('shows loading skeleton initially', async () => {
    let resolvePromise: (value: RailwayApiResult<RailwayHealthResponse>) => void;
    vi.mocked(railwayClient.health.check).mockImplementation(
      () => new Promise((resolve) => { resolvePromise = resolve; })
    );

    render(<RailwayHealthCard />);

    expect(screen.getByTestId('health-card-skeleton')).toBeInTheDocument();
    
    // Cleanup: resolve the promise
    await act(async () => {
      resolvePromise!({ ok: true, data: mockHealthResponse, statusCode: 200 });
    });
  });

  it('displays healthy status when Railway is healthy', async () => {
    vi.mocked(railwayClient.health.check).mockResolvedValue({
      ok: true,
      data: mockHealthResponse,
      statusCode: 200,
    });

    render(<RailwayHealthCard />);

    await waitFor(() => {
      expect(screen.getByTestId('railway-health-card')).toBeInTheDocument();
    });

    expect(screen.getByTestId('status-badge')).toHaveTextContent('healthy');
    expect(screen.getByTestId('health-row-database')).toHaveTextContent('5ms');
    expect(screen.getByTestId('health-row-redis')).toHaveTextContent('2ms');
  });

  it('displays AI provider status with quota remaining', async () => {
    vi.mocked(railwayClient.health.check).mockResolvedValue({
      ok: true,
      data: mockHealthResponse,
      statusCode: 200,
    });

    render(<RailwayHealthCard />);

    await waitFor(() => {
      expect(screen.getByTestId('ai-provider-gemini')).toBeInTheDocument();
    });

    expect(screen.getByTestId('ai-provider-gemini')).toHaveTextContent('1000 remaining');
    expect(screen.getByTestId('ai-provider-openai-(fallback)')).toBeInTheDocument();
  });

  it('shows error card when Railway is unreachable', async () => {
    vi.mocked(railwayClient.health.check).mockRejectedValue(new Error('Network error'));

    render(<RailwayHealthCard />);

    await waitFor(() => {
      expect(screen.getByTestId('health-card-error')).toBeInTheDocument();
    });

    expect(screen.getByText('Railway unreachable')).toBeInTheDocument();
  });

  it('shows error when health check fails', async () => {
    vi.mocked(railwayClient.health.check).mockResolvedValue({
      ok: false,
      data: undefined,
      error: 'Service unavailable',
      statusCode: 503,
    });

    render(<RailwayHealthCard />);

    await waitFor(() => {
      expect(screen.getByTestId('health-card-error')).toBeInTheDocument();
    });

    expect(screen.getByText('Service unavailable')).toBeInTheDocument();
  });

  it('displays degraded status badge correctly', async () => {
    const degradedResponse: RailwayHealthResponse = {
      ...mockHealthResponse,
      status: 'degraded',
      checks: {
        ...mockHealthResponse.checks,
        redis: { status: 'error', latencyMs: 0, message: 'Connection lost' },
      },
    };

    vi.mocked(railwayClient.health.check).mockResolvedValue({
      ok: true,
      data: degradedResponse,
      statusCode: 200,
    });

    render(<RailwayHealthCard />);

    await waitFor(() => {
      expect(screen.getByTestId('status-badge')).toHaveTextContent('degraded');
    });
  });

  it('displays queue status in full view', async () => {
    vi.mocked(railwayClient.health.check).mockResolvedValue({
      ok: true,
      data: mockHealthResponse,
      statusCode: 200,
    });

    render(<RailwayHealthCard compact={false} />);

    await waitFor(() => {
      expect(screen.getByText('Enrichment')).toBeInTheDocument();
    });

    expect(screen.getByText('Outreach')).toBeInTheDocument();
    expect(screen.getByText('Emails')).toBeInTheDocument();
    expect(screen.getByText('Sequence')).toBeInTheDocument();
  });

  it('hides queue status in compact view', async () => {
    vi.mocked(railwayClient.health.check).mockResolvedValue({
      ok: true,
      data: mockHealthResponse,
      statusCode: 200,
    });

    render(<RailwayHealthCard compact={true} />);

    await waitFor(() => {
      expect(screen.getByTestId('railway-health-card')).toBeInTheDocument();
    });

    expect(screen.queryByText('Enrichment')).not.toBeInTheDocument();
    expect(screen.queryByText('Queues')).not.toBeInTheDocument();
  });

  it('displays version number when available', async () => {
    vi.mocked(railwayClient.health.check).mockResolvedValue({
      ok: true,
      data: mockHealthResponse,
      statusCode: 200,
    });

    render(<RailwayHealthCard />);

    await waitFor(() => {
      expect(screen.getByText('v1.2.3')).toBeInTheDocument();
    });
  });

  it('allows manual refresh via button', async () => {
    vi.mocked(railwayClient.health.check).mockResolvedValue({
      ok: true,
      data: mockHealthResponse,
      statusCode: 200,
    });

    render(<RailwayHealthCard />);

    await waitFor(() => {
      expect(screen.getByTestId('railway-health-card')).toBeInTheDocument();
    });

    expect(vi.mocked(railwayClient.health.check)).toHaveBeenCalledTimes(1);

    // Click refresh button
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /refresh/i }));
    });

    await waitFor(() => {
      expect(vi.mocked(railwayClient.health.check)).toHaveBeenCalledTimes(2);
    });
  });

  it('auto-refreshes every 30 seconds', async () => {
    vi.useFakeTimers();
    
    try {
      vi.mocked(railwayClient.health.check).mockResolvedValue({
        ok: true,
        data: mockHealthResponse,
        statusCode: 200,
      });

      render(<RailwayHealthCard />);

      // Initial fetch triggers on mount
      await act(async () => {
        await vi.advanceTimersToNextTimerAsync();
      });

      const initialCallCount = vi.mocked(railwayClient.health.check).mock.calls.length;
      expect(initialCallCount).toBeGreaterThanOrEqual(1);

      // Advance time by 30 seconds (auto-refresh interval)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(30000);
      });

      // Should have one more call after 30 seconds
      expect(vi.mocked(railwayClient.health.check).mock.calls.length).toBe(initialCallCount + 1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('allows retry from error state', async () => {
    vi.mocked(railwayClient.health.check)
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({
        ok: true,
        data: mockHealthResponse,
        statusCode: 200,
      });

    render(<RailwayHealthCard />);

    await waitFor(() => {
      expect(screen.getByTestId('health-card-error')).toBeInTheDocument();
    });

    // Click retry
    await act(async () => {
      fireEvent.click(screen.getByText('Retry'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('railway-health-card')).toBeInTheDocument();
    });

    expect(screen.getByTestId('status-badge')).toHaveTextContent('healthy');
  });

  it('handles missing AI providers gracefully', async () => {
    const noAIResponse: RailwayHealthResponse = {
      ...mockHealthResponse,
      checks: {
        database: mockHealthResponse.checks.database,
        redis: mockHealthResponse.checks.redis,
        queues: mockHealthResponse.checks.queues,
        // ai is undefined
      },
    };

    vi.mocked(railwayClient.health.check).mockResolvedValue({
      ok: true,
      data: noAIResponse,
      statusCode: 200,
    });

    render(<RailwayHealthCard />);

    await waitFor(() => {
      expect(screen.getByTestId('railway-health-card')).toBeInTheDocument();
    });

    // Should not show AI providers section
    expect(screen.queryByText('AI Providers')).not.toBeInTheDocument();
    expect(screen.queryByTestId('ai-provider-gemini')).not.toBeInTheDocument();
  });

  it('applies custom className', async () => {
    vi.mocked(railwayClient.health.check).mockResolvedValue({
      ok: true,
      data: mockHealthResponse,
      statusCode: 200,
    });

    render(<RailwayHealthCard className="custom-class" />);

    await waitFor(() => {
      const card = screen.getByTestId('railway-health-card');
      expect(card).toHaveClass('custom-class');
    });
  });
});
