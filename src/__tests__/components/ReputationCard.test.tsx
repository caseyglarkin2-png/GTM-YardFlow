/**
 * ReputationCard Component Tests
 * 
 * Sprint 39A.4: Tests for reputation dashboard card
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { ReputationData } from '@/hooks/useEmailReputation';

// Mock the hook
const mockRefresh = vi.fn();
const mockUseEmailReputation = vi.fn();

vi.mock('@/hooks/useEmailReputation', () => ({
  useEmailReputation: (options: any) => mockUseEmailReputation(options),
}));

// Mock LazyIcon
vi.mock('@/components/icons', () => ({
  LazyIcon: ({ name, className }: { name: string; className?: string }) => (
    <span data-testid={`icon-${name}`} className={className}>{name}</span>
  ),
}));

import { ReputationCard } from '../../components/dashboard/ReputationCard';

describe('ReputationCard', () => {
  const mockHealthyData: ReputationData = {
    metrics: {
      period: '7d',
      sent: 100,
      delivered: 98,
      bounced: 2,
      complained: 0,
      opened: 35,
      clicked: 10,
      replied: 5,
      unsubscribed: 1,
      deliverabilityRate: 0.98,
      bounceRate: 0.02,
      spamRate: 0,
      openRate: 0.357,
      clickRate: 0.102,
      replyRate: 0.051,
      healthScore: 92,
      healthGrade: 'A',
    },
    trend: [],
    issues: [],
    recommendations: ['Your email reputation looks healthy! Keep it up.'],
    pauseRecommended: false,
  };

  const mockUnhealthyData: ReputationData = {
    metrics: {
      period: '7d',
      sent: 100,
      delivered: 85,
      bounced: 15,
      complained: 3,
      opened: 10,
      clicked: 2,
      replied: 1,
      unsubscribed: 5,
      deliverabilityRate: 0.85,
      bounceRate: 0.15,
      spamRate: 0.03,
      openRate: 0.118,
      clickRate: 0.024,
      replyRate: 0.012,
      healthScore: 45,
      healthGrade: 'F',
    },
    trend: [],
    issues: [
      {
        type: 'critical',
        metric: 'bounceRate',
        value: 0.15,
        threshold: 0.05,
        message: 'Bounce rate is critically high (15.00%). Sending should be paused.',
      },
      {
        type: 'critical',
        metric: 'spamRate',
        value: 0.03,
        threshold: 0.001,
        message: 'Spam rate is critically high (3.000%). Review email content.',
      },
    ],
    recommendations: [
      'Clean your email list by removing invalid addresses',
      'Review your email content for spam triggers',
    ],
    pauseRecommended: true,
    pauseReason: 'High bounce rate',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Loading state', () => {
    it('shows loading skeleton', () => {
      mockUseEmailReputation.mockReturnValue({
        data: null,
        isLoading: true,
        error: null,
        refresh: mockRefresh,
        gradeColor: 'text-slate-400',
        isHealthy: false,
        shouldPauseSending: false,
      });

      render(<ReputationCard />);

      // Check for pulsing animation class
      const card = document.querySelector('.animate-pulse');
      expect(card).toBeTruthy();
    });
  });

  describe('Error state', () => {
    it('shows error message with retry button', () => {
      mockUseEmailReputation.mockReturnValue({
        data: null,
        isLoading: false,
        error: 'Failed to fetch',
        refresh: mockRefresh,
        gradeColor: 'text-slate-400',
        isHealthy: false,
        shouldPauseSending: false,
      });

      render(<ReputationCard />);

      expect(screen.getByText('Failed to load reputation')).toBeInTheDocument();
      expect(screen.getByText('Try again')).toBeInTheDocument();
    });

    it('calls refresh when retry clicked', () => {
      mockUseEmailReputation.mockReturnValue({
        data: null,
        isLoading: false,
        error: 'Failed to fetch',
        refresh: mockRefresh,
        gradeColor: 'text-slate-400',
        isHealthy: false,
        shouldPauseSending: false,
      });

      render(<ReputationCard />);
      
      fireEvent.click(screen.getByText('Try again'));
      
      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  describe('Empty state', () => {
    it('shows message when no data', () => {
      mockUseEmailReputation.mockReturnValue({
        data: null,
        isLoading: false,
        error: null,
        refresh: mockRefresh,
        gradeColor: 'text-slate-400',
        isHealthy: false,
        shouldPauseSending: false,
      });

      render(<ReputationCard />);

      expect(screen.getByText('No email data yet')).toBeInTheDocument();
    });
  });

  describe('Healthy data display', () => {
    beforeEach(() => {
      mockUseEmailReputation.mockReturnValue({
        data: mockHealthyData,
        isLoading: false,
        error: null,
        refresh: mockRefresh,
        gradeColor: 'text-green-600',
        isHealthy: true,
        shouldPauseSending: false,
      });
    });

    it('shows health score', () => {
      render(<ReputationCard />);

      expect(screen.getByText('92')).toBeInTheDocument();
      expect(screen.getByText('A')).toBeInTheDocument();
    });

    it('shows key metrics', () => {
      render(<ReputationCard />);

      expect(screen.getByText('Deliverability')).toBeInTheDocument();
      expect(screen.getByText('Bounce Rate')).toBeInTheDocument();
      expect(screen.getByText('Spam Rate')).toBeInTheDocument();
      expect(screen.getByText('Open Rate')).toBeInTheDocument();
    });

    it('shows emails sent count', () => {
      render(<ReputationCard />);

      expect(screen.getByText('Emails Sent')).toBeInTheDocument();
      expect(screen.getByText('100')).toBeInTheDocument();
    });

    it('shows recommendations toggle', () => {
      render(<ReputationCard />);

      expect(screen.getByText(/Recommendations/)).toBeInTheDocument();
    });

    it('expands recommendations on click', () => {
      render(<ReputationCard />);

      const toggle = screen.getByText(/Recommendations/);
      fireEvent.click(toggle);

      expect(screen.getByText('Your email reputation looks healthy! Keep it up.')).toBeInTheDocument();
    });
  });

  describe('Unhealthy data display', () => {
    beforeEach(() => {
      mockUseEmailReputation.mockReturnValue({
        data: mockUnhealthyData,
        isLoading: false,
        error: null,
        refresh: mockRefresh,
        gradeColor: 'text-red-600',
        isHealthy: false,
        shouldPauseSending: true,
      });
    });

    it('shows F grade for poor health', () => {
      render(<ReputationCard />);

      expect(screen.getByText('45')).toBeInTheDocument();
      expect(screen.getByText('F')).toBeInTheDocument();
    });

    it('shows critical issue banner', () => {
      render(<ReputationCard />);

      expect(screen.getByText(/Bounce rate is critically high/)).toBeInTheDocument();
    });

    it('shows additional issues count', () => {
      render(<ReputationCard />);

      expect(screen.getByText(/\+1 more issue/)).toBeInTheDocument();
    });
  });

  describe('Compact mode', () => {
    it('renders compact version', () => {
      mockUseEmailReputation.mockReturnValue({
        data: mockHealthyData,
        isLoading: false,
        error: null,
        refresh: mockRefresh,
        gradeColor: 'text-green-600',
        isHealthy: true,
        shouldPauseSending: false,
      });

      render(<ReputationCard compact />);

      expect(screen.getByText('A')).toBeInTheDocument();
      expect(screen.getByText('Email Health')).toBeInTheDocument();
      expect(screen.getByText('92/100')).toBeInTheDocument();
    });

    it('shows pause warning in compact mode', () => {
      mockUseEmailReputation.mockReturnValue({
        data: mockUnhealthyData,
        isLoading: false,
        error: null,
        refresh: mockRefresh,
        gradeColor: 'text-red-600',
        isHealthy: false,
        shouldPauseSending: true,
      });

      render(<ReputationCard compact />);

      expect(screen.getByText('Pause sending')).toBeInTheDocument();
    });
  });

  describe('Hook options', () => {
    it('passes period to hook', () => {
      mockUseEmailReputation.mockReturnValue({
        data: mockHealthyData,
        isLoading: false,
        error: null,
        refresh: mockRefresh,
        gradeColor: 'text-green-600',
        isHealthy: true,
        shouldPauseSending: false,
      });

      render(<ReputationCard period="30d" />);

      expect(mockUseEmailReputation).toHaveBeenCalledWith(
        expect.objectContaining({ period: '30d' })
      );
    });

    it('sets refresh interval', () => {
      mockUseEmailReputation.mockReturnValue({
        data: mockHealthyData,
        isLoading: false,
        error: null,
        refresh: mockRefresh,
        gradeColor: 'text-green-600',
        isHealthy: true,
        shouldPauseSending: false,
      });

      render(<ReputationCard />);

      expect(mockUseEmailReputation).toHaveBeenCalledWith(
        expect.objectContaining({ refreshInterval: 5 * 60 * 1000 })
      );
    });
  });
});
