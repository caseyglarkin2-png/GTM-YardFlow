/**
 * Tests for MeetingAttributionDashboard Component
 * Sprint 204: Meeting Attribution Dashboard
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MeetingAttributionDashboard } from '@/components/analytics/MeetingAttributionDashboard';
import * as useMeetingStatsModule from '@/hooks/useMeetingStats';

// Mock the hooks
vi.mock('@/hooks/useMeetingStats', () => ({
  useMeetingStats: vi.fn(),
  useMeetingKPIs: vi.fn(),
}));

describe('MeetingAttributionDashboard', () => {
  const mockAnalytics = {
    bySequence: [
      { name: 'Q1 Outreach', sequenceId: 'seq1', count: 15 },
      { name: 'Cold Outreach', sequenceId: 'seq2', count: 10 },
      { name: 'Follow-up', sequenceId: 'seq3', count: 5 },
    ],
    byTemplate: [
      { name: 'Introduction', templateId: 'tpl1', count: 12 },
      { name: 'Value Prop', templateId: 'tpl2', count: 8 },
      { name: 'Case Study', templateId: 'tpl3', count: 6 },
    ],
    byDay: [
      { date: '2024-01-15', count: 5 },
      { date: '2024-01-16', count: 3 },
    ],
    total: 30,
    thisWeek: 10,
    lastWeek: 8,
    percentChange: 25,
  };

  const mockKPIs = {
    total: 30,
    thisWeek: 10,
    lastWeek: 8,
    percentChange: 25,
    trend: 'up' as const,
    topSequence: { id: 'seq1', name: 'Q1 Outreach', count: 15 },
    topTemplate: { id: 'tpl1', name: 'Introduction', count: 12 },
    isLoading: false,
    error: null,
  };

  const mockRefresh = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useMeetingStatsModule.useMeetingStats as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      analytics: mockAnalytics,
      isLoading: false,
      error: null,
      refresh: mockRefresh,
    });
    (useMeetingStatsModule.useMeetingKPIs as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockKPIs);
  });

  describe('Rendering', () => {
    it('renders the dashboard with header', () => {
      render(<MeetingAttributionDashboard />);
      expect(screen.getByText('Meeting Attribution')).toBeInTheDocument();
      expect(screen.getByTestId('meeting-dashboard')).toBeInTheDocument();
    });

    it('renders KPI cards with correct values', () => {
      render(<MeetingAttributionDashboard />);
      
      expect(screen.getByText('Total Meetings')).toBeInTheDocument();
      expect(screen.getByText('30')).toBeInTheDocument();
      expect(screen.getByText('This Week')).toBeInTheDocument();
      // '10' appears in multiple places, check for at least one
      expect(screen.getAllByText('10').length).toBeGreaterThanOrEqual(1);
    });

    it('renders top sequence and template KPI cards', () => {
      render(<MeetingAttributionDashboard />);
      
      expect(screen.getByText('Top Sequence')).toBeInTheDocument();
      // Q1 Outreach appears in both KPI and bar chart
      expect(screen.getAllByText('Q1 Outreach').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Top Template')).toBeInTheDocument();
      // Introduction appears in both KPI and bar chart  
      expect(screen.getAllByText('Introduction').length).toBeGreaterThanOrEqual(1);
    });

    it('renders bar charts for sequences and templates', () => {
      render(<MeetingAttributionDashboard />);
      
      expect(screen.getByText('Meetings by Sequence')).toBeInTheDocument();
      expect(screen.getByText('Meetings by Template')).toBeInTheDocument();
      expect(screen.getByText('Cold Outreach')).toBeInTheDocument();
      expect(screen.getByText('Value Prop')).toBeInTheDocument();
    });

    it('shows trend indicator when week-over-week change', () => {
      render(<MeetingAttributionDashboard />);
      expect(screen.getByText(/25% increase/)).toBeInTheDocument();
    });
  });

  describe('Date Range Selection', () => {
    it('renders date range buttons', () => {
      render(<MeetingAttributionDashboard />);
      
      expect(screen.getByText('7 Days')).toBeInTheDocument();
      expect(screen.getByText('30 Days')).toBeInTheDocument();
      expect(screen.getByText('90 Days')).toBeInTheDocument();
    });

    it('changes date range when button clicked', () => {
      render(<MeetingAttributionDashboard />);
      
      const sevenDaysBtn = screen.getByText('7 Days');
      fireEvent.click(sevenDaysBtn);
      
      // Should re-fetch with new range - verify hook was called
      expect(useMeetingStatsModule.useMeetingStats).toHaveBeenCalled();
    });
  });

  describe('Loading State', () => {
    it('shows loading skeleton when loading', () => {
      (useMeetingStatsModule.useMeetingStats as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        analytics: null,
        isLoading: true,
        error: null,
        refresh: mockRefresh,
      });

      render(<MeetingAttributionDashboard />);
      
      // Should show pulse animation placeholders
      const skeletons = document.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  describe('Error State', () => {
    it('shows error message when error occurs', () => {
      (useMeetingStatsModule.useMeetingStats as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        analytics: null,
        isLoading: false,
        error: new Error('Failed to load analytics'),
        refresh: mockRefresh,
      });

      render(<MeetingAttributionDashboard />);
      
      expect(screen.getByText('Failed to load analytics')).toBeInTheDocument();
      expect(screen.getByText('Retry')).toBeInTheDocument();
    });

    it('calls refresh when retry button clicked', () => {
      (useMeetingStatsModule.useMeetingStats as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        analytics: null,
        isLoading: false,
        error: new Error('Failed to load analytics'),
        refresh: mockRefresh,
      });

      render(<MeetingAttributionDashboard />);
      
      const retryBtn = screen.getByText('Retry');
      fireEvent.click(retryBtn);
      
      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  describe('Empty State', () => {
    it('shows empty state when no meetings', () => {
      (useMeetingStatsModule.useMeetingStats as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        analytics: {
          ...mockAnalytics,
          total: 0,
          thisWeek: 0,
          lastWeek: 0,
          percentChange: 0,
        },
        isLoading: false,
        error: null,
        refresh: mockRefresh,
      });
      (useMeetingStatsModule.useMeetingKPIs as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        ...mockKPIs,
        total: 0,
        thisWeek: 0,
        lastWeek: 0,
        trend: 'flat',
      });

      render(<MeetingAttributionDashboard />);
      
      expect(screen.getByText('No meetings yet')).toBeInTheDocument();
      expect(screen.getByText(/Meetings will appear here/)).toBeInTheDocument();
    });

    it('shows empty message in charts when no data', () => {
      (useMeetingStatsModule.useMeetingStats as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        analytics: {
          ...mockAnalytics,
          bySequence: [],
          byTemplate: [],
          total: 0,
        },
        isLoading: false,
        error: null,
        refresh: mockRefresh,
      });

      render(<MeetingAttributionDashboard />);
      
      expect(screen.getByText('No sequence attribution data')).toBeInTheDocument();
      expect(screen.getByText('No template attribution data')).toBeInTheDocument();
    });
  });

  describe('Refresh Functionality', () => {
    it('calls refresh when refresh button clicked', async () => {
      render(<MeetingAttributionDashboard />);
      
      const refreshBtn = screen.getByTitle('Refresh');
      fireEvent.click(refreshBtn);
      
      await waitFor(() => {
        expect(mockRefresh).toHaveBeenCalled();
      });
    });

    it('disables refresh button while loading', () => {
      (useMeetingStatsModule.useMeetingStats as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        analytics: mockAnalytics,
        isLoading: true,
        error: null,
        refresh: mockRefresh,
      });

      render(<MeetingAttributionDashboard />);
      
      const refreshBtn = screen.getByTitle('Refresh');
      expect(refreshBtn).toBeDisabled();
    });
  });

  describe('Trend Display', () => {
    it('shows increase trend correctly', () => {
      render(<MeetingAttributionDashboard />);
      expect(screen.getByText(/25% increase/)).toBeInTheDocument();
    });

    it('shows decrease trend correctly', () => {
      (useMeetingStatsModule.useMeetingStats as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        analytics: {
          ...mockAnalytics,
          percentChange: -15,
        },
        isLoading: false,
        error: null,
        refresh: mockRefresh,
      });
      (useMeetingStatsModule.useMeetingKPIs as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        ...mockKPIs,
        trend: 'down',
      });

      render(<MeetingAttributionDashboard />);
      expect(screen.getByText(/15% decrease/)).toBeInTheDocument();
    });

    it('hides trend when no change', () => {
      (useMeetingStatsModule.useMeetingStats as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        analytics: {
          ...mockAnalytics,
          percentChange: 0,
        },
        isLoading: false,
        error: null,
        refresh: mockRefresh,
      });

      render(<MeetingAttributionDashboard />);
      expect(screen.queryByText(/increase/)).not.toBeInTheDocument();
      expect(screen.queryByText(/decrease/)).not.toBeInTheDocument();
    });
  });
});
