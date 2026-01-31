/**
 * HealthDashboard Component Tests
 * Sprint 200 - Production Hardening
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { HealthDashboard } from '../../components/HealthDashboard';
import { railwayClient } from '../../services/RailwayApiClient';

// Mock feature flags
vi.mock('../../config/featureFlags', () => ({
  featureFlags: {
    RAILWAY_ENABLED: true,
  },
}));

// Mock Railway client
vi.mock('../../services/RailwayApiClient', () => ({
  railwayClient: {
    health: {
      check: vi.fn(),
    },
  },
}));

// Get typed mock reference
const mockRailwayClient = railwayClient as { health: { check: ReturnType<typeof vi.fn> } };

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('HealthDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
    mockRailwayClient.health.check.mockReset();
  });

  it('should render loading state initially', () => {
    // Set up pending promises
    mockFetch.mockImplementation(() => new Promise(() => {}));
    mockRailwayClient.health.check.mockImplementation(() => new Promise(() => {}));

    render(<HealthDashboard />);

    expect(screen.getByText('System Health')).toBeInTheDocument();
    expect(screen.getByText('Checking...')).toBeInTheDocument();
  });

  it('should show healthy status when all services are healthy', async () => {
    mockRailwayClient.health.check.mockResolvedValue({ ok: true });
    
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/email/health')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ healthy: true, message: 'Operational' }),
        });
      }
      if (url.includes('/api/dashboard/stats')) {
        return Promise.resolve({ ok: true });
      }
      return Promise.resolve({ ok: false });
    });

    render(<HealthDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Railway Backend')).toBeInTheDocument();
    });

    expect(screen.getByText('Email Service')).toBeInTheDocument();
    expect(screen.getByText('Firestore Database')).toBeInTheDocument();
  });

  it('should show unhealthy status when Railway fails', async () => {
    mockRailwayClient.health.check.mockResolvedValue({ ok: false, error: 'Connection refused' });
    
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ healthy: true }),
    });

    render(<HealthDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Railway Backend')).toBeInTheDocument();
    });

    // Should show unhealthy indicator - check for the status badge or error message
    const unhealthyElements = screen.queryAllByText(/Unhealthy|Connection refused/i);
    expect(unhealthyElements.length).toBeGreaterThan(0);
  });

  it('should refresh health on button click', async () => {
    mockRailwayClient.health.check.mockResolvedValue({ ok: true });
    
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ healthy: true }),
    });

    render(<HealthDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Railway Backend')).toBeInTheDocument();
    });

    const refreshButton = screen.getByText('Refresh');
    fireEvent.click(refreshButton);

    // Should trigger another health check
    await waitFor(() => {
      expect(mockRailwayClient.health.check).toHaveBeenCalledTimes(2);
    });
  });

  it('should display cron job status', async () => {
    mockRailwayClient.health.check.mockResolvedValue({ ok: true });
    
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ healthy: true }),
    });

    render(<HealthDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Scheduled Jobs')).toBeInTheDocument();
    });

    expect(screen.getByText('Email Sequence Executor')).toBeInTheDocument();
    expect(screen.getByText('Email Queue Processor')).toBeInTheDocument();
  });

  it('should handle fetch errors gracefully', async () => {
    mockRailwayClient.health.check.mockRejectedValue(new Error('Network error'));
    
    mockFetch.mockRejectedValue(new Error('Network error'));

    render(<HealthDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Railway Backend')).toBeInTheDocument();
    });

    // Should still render with error states - use getAllByText since multiple services may fail
    const errorMessages = screen.getAllByText(/Connection failed|Network error/i);
    expect(errorMessages.length).toBeGreaterThan(0);
  });

  it('should show latency when available', async () => {
    mockRailwayClient.health.check.mockResolvedValue({ ok: true });
    
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ healthy: true }),
    });

    render(<HealthDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Railway Backend')).toBeInTheDocument();
    });

    // Should show latency in format "Xms latency" - use getAllByText since multiple services show latency
    const latencyElements = screen.getAllByText(/\d+ms latency/);
    expect(latencyElements.length).toBeGreaterThan(0);
  });
});
