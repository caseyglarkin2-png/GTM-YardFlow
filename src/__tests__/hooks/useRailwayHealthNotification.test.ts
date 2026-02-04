/**
 * useRailwayHealthNotification Hook Tests - Sprint V34 P1.1
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useRailwayHealthNotification } from '../../hooks/useRailwayHealthNotification';

// Mock useRailwayHealth
const mockStatus = { current: 'checking' as 'checking' | 'healthy' | 'unhealthy' };
vi.mock('../../hooks/useRailwayHealth', () => ({
  useRailwayHealth: () => ({
    status: mockStatus.current,
    lastCheck: Date.now(),
    isHealthy: mockStatus.current === 'healthy',
    refresh: vi.fn(),
  }),
}));

// Mock feature flags
const mockRailwayEnabled = { current: true };
vi.mock('@/config/featureFlags', () => ({
  shouldUseRailwayEmail: () => mockRailwayEnabled.current,
}));

describe('useRailwayHealthNotification', () => {
  const showWarning = vi.fn();
  const showInfo = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockStatus.current = 'checking';
    mockRailwayEnabled.current = true;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('does not show notification on initial checking state', () => {
    renderHook(() => useRailwayHealthNotification({ showWarning, showInfo }));
    expect(showWarning).not.toHaveBeenCalled();
    expect(showInfo).not.toHaveBeenCalled();
  });

  it('does not show notification when Railway email is disabled', () => {
    mockRailwayEnabled.current = false;
    mockStatus.current = 'unhealthy';

    const { rerender } = renderHook(() =>
      useRailwayHealthNotification({ showWarning, showInfo })
    );

    // Simulate transition
    mockStatus.current = 'healthy';
    rerender();

    expect(showWarning).not.toHaveBeenCalled();
    expect(showInfo).not.toHaveBeenCalled();
  });

  it('shows warning when Railway becomes unhealthy', async () => {
    mockStatus.current = 'healthy';
    const { rerender } = renderHook(() =>
      useRailwayHealthNotification({ showWarning, showInfo })
    );

    // Transition to unhealthy
    mockStatus.current = 'unhealthy';
    rerender();

    await waitFor(() => {
      expect(showWarning).toHaveBeenCalledWith(
        'Railway Offline',
        'Using local fallback mode. Email features may be limited.'
      );
    });
  });

  it('shows info when Railway recovers from unhealthy', async () => {
    mockStatus.current = 'healthy';
    const { rerender } = renderHook(() =>
      useRailwayHealthNotification({ showWarning, showInfo })
    );

    // Go unhealthy first
    mockStatus.current = 'unhealthy';
    rerender();

    // Then recover
    mockStatus.current = 'healthy';
    rerender();

    await waitFor(() => {
      expect(showInfo).toHaveBeenCalledWith(
        'Railway Connected',
        'Full email functionality restored.'
      );
    });
  });

  it('does not spam notifications for repeated unhealthy status', async () => {
    mockStatus.current = 'healthy';
    const { rerender } = renderHook(() =>
      useRailwayHealthNotification({ showWarning, showInfo })
    );

    // Go unhealthy
    mockStatus.current = 'unhealthy';
    rerender();

    // Rerender while still unhealthy (e.g., from parent re-render)
    rerender();
    rerender();

    await waitFor(() => {
      expect(showWarning).toHaveBeenCalledTimes(1);
    });
  });

  it('does not show recovery notification if never went unhealthy', () => {
    mockStatus.current = 'checking';
    const { rerender } = renderHook(() =>
      useRailwayHealthNotification({ showWarning, showInfo })
    );

    // Go directly to healthy without ever being unhealthy
    mockStatus.current = 'healthy';
    rerender();

    expect(showInfo).not.toHaveBeenCalled();
    expect(showWarning).not.toHaveBeenCalled();
  });
});
