/**
 * DomainHealthCard Component Tests
 * 
 * Sprint 39B.4: Tests for domain health dashboard card
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DomainHealthCard } from '@/components/dashboard/DomainHealthCard';

// Mock LazyIcon
vi.mock('@/components/icons', () => ({
  LazyIcon: ({ name, className }: { name: string; className?: string }) => (
    <span data-testid={`icon-${name}`} className={className}>{name}</span>
  ),
}));

// Mock useDomainHealth hook
const mockRefresh = vi.fn();
const mockGetStatusColor = vi.fn((status: string) => {
  if (status === 'valid') return 'text-green-600';
  if (status === 'warning') return 'text-yellow-600';
  if (status === 'invalid') return 'text-red-600';
  return 'text-slate-500';
});

const mockUseDomainHealth = vi.fn();
vi.mock('@/hooks/useDomainHealth', () => ({
  useDomainHealth: (opts: unknown) => mockUseDomainHealth(opts),
}));

describe('DomainHealthCard', () => {
  const mockHealthyData = {
    domain: 'example.com',
    isHealthy: true,
    score: 100,
    records: {
      spf: {
        type: 'SPF',
        status: 'valid' as const,
        value: 'v=spf1 include:_spf.google.com ~all',
        message: 'SPF properly configured',
        details: [],
      },
      dkim: {
        type: 'DKIM',
        status: 'valid' as const,
        value: 'google._domainkey.example.com',
        message: 'DKIM properly configured',
        details: [],
      },
      dmarc: {
        type: 'DMARC',
        status: 'valid' as const,
        value: 'v=DMARC1; p=reject; rua=mailto:dmarc@example.com',
        message: 'DMARC properly configured',
        details: [],
      },
    },
    recommendations: [],
    lastChecked: '2025-01-15T12:00:00.000Z',
    cacheExpiry: '2025-01-15T13:00:00.000Z',
  };

  const mockUnhealthyData = {
    domain: 'bad.com',
    isHealthy: false,
    score: 35,
    records: {
      spf: {
        type: 'SPF',
        status: 'valid' as const,
        message: 'SPF configured',
      },
      dkim: {
        type: 'DKIM',
        status: 'missing' as const,
        message: 'No DKIM record found',
        details: ['Configure DKIM in your email provider'],
      },
      dmarc: {
        type: 'DMARC',
        status: 'invalid' as const,
        message: 'DMARC policy is too permissive',
        details: ['Change policy from p=none to p=quarantine or p=reject'],
      },
    },
    recommendations: ['Configure DKIM', 'Fix DMARC policy'],
    lastChecked: '2025-01-15T12:00:00.000Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockRefresh.mockClear();
  });

  describe('Loading state', () => {
    it('shows loading spinner', () => {
      mockUseDomainHealth.mockReturnValue({
        data: null,
        isLoading: true,
        error: null,
        refresh: mockRefresh,
        getStatusColor: mockGetStatusColor,
        isFullyConfigured: false,
      });

      render(<DomainHealthCard domain="example.com" />);

      expect(screen.getByText('Checking domain authentication...')).toBeInTheDocument();
    });
  });

  describe('Error state', () => {
    it('shows error message', () => {
      mockUseDomainHealth.mockReturnValue({
        data: null,
        isLoading: false,
        error: 'DNS lookup failed',
        refresh: mockRefresh,
        getStatusColor: mockGetStatusColor,
        isFullyConfigured: false,
      });

      render(<DomainHealthCard domain="bad-domain" />);

      expect(screen.getByText('Domain Check Failed')).toBeInTheDocument();
      expect(screen.getByText('DNS lookup failed')).toBeInTheDocument();
    });

    it('shows retry button on error', async () => {
      mockUseDomainHealth.mockReturnValue({
        data: null,
        isLoading: false,
        error: 'DNS lookup failed',
        refresh: mockRefresh,
        getStatusColor: mockGetStatusColor,
        isFullyConfigured: false,
      });

      render(<DomainHealthCard domain="bad-domain" />);

      const retryButton = screen.getByText('Try again');
      fireEvent.click(retryButton);

      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  describe('Empty domain', () => {
    it('shows prompt when no domain specified', () => {
      mockUseDomainHealth.mockReturnValue({
        data: null,
        isLoading: false,
        error: null,
        refresh: mockRefresh,
        getStatusColor: mockGetStatusColor,
        isFullyConfigured: false,
      });

      render(<DomainHealthCard domain="" />);

      expect(screen.getByText('Enter a domain to check authentication status')).toBeInTheDocument();
    });
  });

  describe('Healthy domain (full view)', () => {
    beforeEach(() => {
      mockUseDomainHealth.mockReturnValue({
        data: mockHealthyData,
        isLoading: false,
        error: null,
        refresh: mockRefresh,
        getStatusColor: mockGetStatusColor,
        isFullyConfigured: true,
      });
    });

    it('shows domain name', () => {
      render(<DomainHealthCard domain="example.com" />);
      expect(screen.getByText('example.com')).toBeInTheDocument();
    });

    it('shows score', () => {
      render(<DomainHealthCard domain="example.com" />);
      expect(screen.getByText('100')).toBeInTheDocument();
    });

    it('shows healthy status', () => {
      render(<DomainHealthCard domain="example.com" />);
      expect(screen.getByText('Healthy')).toBeInTheDocument();
    });

    it('shows all three record badges', () => {
      render(<DomainHealthCard domain="example.com" />);
      
      // StatusBadges render record names
      const spfBadges = screen.getAllByText('SPF');
      const dkimBadges = screen.getAllByText('DKIM');
      const dmarcBadges = screen.getAllByText('DMARC');
      
      expect(spfBadges.length).toBeGreaterThan(0);
      expect(dkimBadges.length).toBeGreaterThan(0);
      expect(dmarcBadges.length).toBeGreaterThan(0);
    });

    it('shows success message when fully configured', () => {
      render(<DomainHealthCard domain="example.com" />);
      expect(screen.getByText('Domain authentication is fully configured')).toBeInTheDocument();
    });

    it('shows last checked timestamp', () => {
      render(<DomainHealthCard domain="example.com" />);
      expect(screen.getByText(/Last checked:/)).toBeInTheDocument();
    });

    it('refresh button triggers refresh', () => {
      render(<DomainHealthCard domain="example.com" />);
      
      const refreshButton = screen.getByTitle('Refresh');
      fireEvent.click(refreshButton);
      
      expect(mockRefresh).toHaveBeenCalledWith(true);
    });
  });

  describe('Unhealthy domain', () => {
    beforeEach(() => {
      mockUseDomainHealth.mockReturnValue({
        data: mockUnhealthyData,
        isLoading: false,
        error: null,
        refresh: mockRefresh,
        getStatusColor: mockGetStatusColor,
        isFullyConfigured: false,
      });
    });

    it('shows low score', () => {
      render(<DomainHealthCard domain="bad.com" />);
      expect(screen.getByText('35')).toBeInTheDocument();
    });

    it('shows issues found status', () => {
      render(<DomainHealthCard domain="bad.com" />);
      expect(screen.getByText('Issues Found')).toBeInTheDocument();
    });

    it('shows recommendations when not fully configured', () => {
      render(<DomainHealthCard domain="bad.com" />);
      expect(screen.getByText('Recommendations')).toBeInTheDocument();
      expect(screen.getByText('Configure DKIM')).toBeInTheDocument();
    });

    it('expands record details on click', async () => {
      render(<DomainHealthCard domain="bad.com" />);
      
      // Find the DKIM row and click it
      const dkimRow = screen.getByText('No DKIM record found').closest('div[role="button"]');
      if (dkimRow) {
        fireEvent.click(dkimRow);
        
        await waitFor(() => {
          expect(screen.getByText('Configure DKIM in your email provider')).toBeInTheDocument();
        });
      }
    });
  });

  describe('Compact view', () => {
    beforeEach(() => {
      mockUseDomainHealth.mockReturnValue({
        data: mockHealthyData,
        isLoading: false,
        error: null,
        refresh: mockRefresh,
        getStatusColor: mockGetStatusColor,
        isFullyConfigured: true,
      });
    });

    it('renders compact version', () => {
      render(<DomainHealthCard domain="example.com" compact />);
      
      // Should show domain and score
      expect(screen.getByText('example.com')).toBeInTheDocument();
      expect(screen.getByText('100')).toBeInTheDocument();
      
      // Should show badges
      const spfBadges = screen.getAllByText('SPF');
      expect(spfBadges.length).toBeGreaterThan(0);
    });

    it('compact view is more condensed', () => {
      const { container: fullContainer } = render(<DomainHealthCard domain="example.com" />);
      const { container: compactContainer } = render(<DomainHealthCard domain="example.com" compact />);
      
      // Compact should have fewer elements (no detailed record rows, no recommendations section)
      const fullDivs = fullContainer.querySelectorAll('div');
      const compactDivs = compactContainer.querySelectorAll('div');
      
      expect(compactDivs.length).toBeLessThan(fullDivs.length);
    });
  });

  describe('Accessibility', () => {
    beforeEach(() => {
      mockUseDomainHealth.mockReturnValue({
        data: mockUnhealthyData,
        isLoading: false,
        error: null,
        refresh: mockRefresh,
        getStatusColor: mockGetStatusColor,
        isFullyConfigured: false,
      });
    });

    it('expandable rows are keyboard accessible', async () => {
      render(<DomainHealthCard domain="bad.com" />);
      
      // Find the DKIM row (has details so should be expandable)
      const dkimRow = screen.getByText('No DKIM record found').closest('div[role="button"]');
      
      expect(dkimRow).toHaveAttribute('tabIndex', '0');
      expect(dkimRow).toHaveAttribute('aria-expanded', 'false');
      
      // Trigger with keyboard
      if (dkimRow) {
        fireEvent.keyDown(dkimRow, { key: 'Enter' });
        
        await waitFor(() => {
          expect(dkimRow).toHaveAttribute('aria-expanded', 'true');
        });
      }
    });
  });

  describe('Custom className', () => {
    beforeEach(() => {
      mockUseDomainHealth.mockReturnValue({
        data: mockHealthyData,
        isLoading: false,
        error: null,
        refresh: mockRefresh,
        getStatusColor: mockGetStatusColor,
        isFullyConfigured: true,
      });
    });

    it('applies custom className', () => {
      const { container } = render(
        <DomainHealthCard domain="example.com" className="custom-class" />
      );
      
      expect(container.firstChild).toHaveClass('custom-class');
    });
  });

  describe('Hook integration', () => {
    it('passes domain to hook', () => {
      mockUseDomainHealth.mockReturnValue({
        data: null,
        isLoading: true,
        error: null,
        refresh: mockRefresh,
        getStatusColor: mockGetStatusColor,
        isFullyConfigured: false,
      });

      render(<DomainHealthCard domain="test.example.com" />);
      
      expect(mockUseDomainHealth).toHaveBeenCalledWith(
        expect.objectContaining({
          domain: 'test.example.com',
          enabled: true,
        })
      );
    });

    it('passes dkimSelector to hook', () => {
      mockUseDomainHealth.mockReturnValue({
        data: null,
        isLoading: true,
        error: null,
        refresh: mockRefresh,
        getStatusColor: mockGetStatusColor,
        isFullyConfigured: false,
      });

      render(<DomainHealthCard domain="test.example.com" dkimSelector="sendgrid" />);
      
      expect(mockUseDomainHealth).toHaveBeenCalledWith(
        expect.objectContaining({
          dkimSelector: 'sendgrid',
        })
      );
    });

    it('disables hook when no domain', () => {
      mockUseDomainHealth.mockReturnValue({
        data: null,
        isLoading: false,
        error: null,
        refresh: mockRefresh,
        getStatusColor: mockGetStatusColor,
        isFullyConfigured: false,
      });

      render(<DomainHealthCard domain="" />);
      
      expect(mockUseDomainHealth).toHaveBeenCalledWith(
        expect.objectContaining({
          enabled: false,
        })
      );
    });
  });
});
