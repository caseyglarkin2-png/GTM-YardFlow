/**
 * Dashboard States Component Tests
 * Sprint 28B - T28B.6
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  Skeleton,
  KPICardSkeleton,
  KPIGridSkeleton,
  ChartSkeleton,
  LeaderboardSkeleton,
  TableSkeleton,
  ErrorState,
  EmptyState,
  LoadingOverlay,
  type SkeletonProps,
  type ErrorStateProps,
  type EmptyStateProps,
  type LoadingOverlayProps,
} from '../../components/DashboardStates';

describe('Skeleton', () => {
  const defaultProps: SkeletonProps = {};

  describe('rendering', () => {
    it('renders skeleton element', () => {
      render(<Skeleton {...defaultProps} />);
      expect(screen.getByTestId('skeleton')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(<Skeleton className="custom-skeleton" />);
      expect(screen.getByTestId('skeleton')).toHaveClass('custom-skeleton');
    });

    it('is hidden from screen readers', () => {
      render(<Skeleton />);
      expect(screen.getByTestId('skeleton')).toHaveAttribute('aria-hidden', 'true');
    });
  });

  describe('variants', () => {
    it('applies text variant by default', () => {
      render(<Skeleton />);
      expect(screen.getByTestId('skeleton')).toHaveClass('rounded', 'h-4');
    });

    it('applies circular variant', () => {
      render(<Skeleton variant="circular" />);
      expect(screen.getByTestId('skeleton')).toHaveClass('rounded-full');
    });

    it('applies rectangular variant', () => {
      render(<Skeleton variant="rectangular" />);
      expect(screen.getByTestId('skeleton')).toHaveClass('rounded-lg');
    });
  });

  describe('dimensions', () => {
    it('applies width as number (px)', () => {
      render(<Skeleton width={100} />);
      expect(screen.getByTestId('skeleton')).toHaveStyle({ width: '100px' });
    });

    it('applies width as string', () => {
      render(<Skeleton width="50%" />);
      expect(screen.getByTestId('skeleton')).toHaveStyle({ width: '50%' });
    });

    it('applies height as number (px)', () => {
      render(<Skeleton height={24} />);
      expect(screen.getByTestId('skeleton')).toHaveStyle({ height: '24px' });
    });

    it('applies height as string', () => {
      render(<Skeleton height="2rem" />);
      expect(screen.getByTestId('skeleton')).toHaveStyle({ height: '2rem' });
    });
  });

  describe('animations', () => {
    it('uses pulse animation by default', () => {
      render(<Skeleton />);
      expect(screen.getByTestId('skeleton')).toHaveClass('animate-pulse');
    });

    it('uses wave animation when specified', () => {
      render(<Skeleton animation="wave" />);
      expect(screen.getByTestId('skeleton')).toHaveClass('animate-shimmer');
    });

    it('has no animation when set to none', () => {
      render(<Skeleton animation="none" />);
      const skeleton = screen.getByTestId('skeleton');
      expect(skeleton).not.toHaveClass('animate-pulse');
      expect(skeleton).not.toHaveClass('animate-shimmer');
    });
  });
});

describe('KPICardSkeleton', () => {
  it('renders KPI card skeleton', () => {
    render(<KPICardSkeleton />);
    expect(screen.getByTestId('kpi-card-skeleton')).toBeInTheDocument();
  });

  it('contains skeleton elements', () => {
    render(<KPICardSkeleton />);
    const skeletons = screen.getAllByTestId('skeleton');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('applies custom className', () => {
    render(<KPICardSkeleton className="custom-kpi" />);
    expect(screen.getByTestId('kpi-card-skeleton')).toHaveClass('custom-kpi');
  });
});

describe('KPIGridSkeleton', () => {
  it('renders KPI grid skeleton', () => {
    render(<KPIGridSkeleton />);
    expect(screen.getByTestId('kpi-grid-skeleton')).toBeInTheDocument();
  });

  it('renders 4 cards by default', () => {
    render(<KPIGridSkeleton />);
    const cards = screen.getAllByTestId('kpi-card-skeleton');
    expect(cards).toHaveLength(4);
  });

  it('renders specified number of cards', () => {
    render(<KPIGridSkeleton count={6} />);
    const cards = screen.getAllByTestId('kpi-card-skeleton');
    expect(cards).toHaveLength(6);
  });

  it('uses 4 columns by default', () => {
    render(<KPIGridSkeleton />);
    expect(screen.getByTestId('kpi-grid-skeleton')).toHaveClass('lg:grid-cols-4');
  });

  it('uses specified column count', () => {
    render(<KPIGridSkeleton columns={3} />);
    expect(screen.getByTestId('kpi-grid-skeleton')).toHaveClass('lg:grid-cols-3');
  });

  it('applies custom className', () => {
    render(<KPIGridSkeleton className="custom-grid" />);
    expect(screen.getByTestId('kpi-grid-skeleton')).toHaveClass('custom-grid');
  });
});

describe('ChartSkeleton', () => {
  it('renders chart skeleton', () => {
    render(<ChartSkeleton />);
    expect(screen.getByTestId('chart-skeleton')).toBeInTheDocument();
  });

  it('contains skeleton elements', () => {
    render(<ChartSkeleton />);
    const skeletons = screen.getAllByTestId('skeleton');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('applies custom className', () => {
    render(<ChartSkeleton className="custom-chart" />);
    expect(screen.getByTestId('chart-skeleton')).toHaveClass('custom-chart');
  });
});

describe('LeaderboardSkeleton', () => {
  it('renders leaderboard skeleton', () => {
    render(<LeaderboardSkeleton />);
    expect(screen.getByTestId('leaderboard-skeleton')).toBeInTheDocument();
  });

  it('renders 5 rows by default', () => {
    render(<LeaderboardSkeleton />);
    // Count circular skeletons (2 per row: rank + avatar)
    const circularSkeletons = screen.getAllByTestId('skeleton').filter(
      el => el.classList.contains('rounded-full')
    );
    expect(circularSkeletons).toHaveLength(10); // 5 rows * 2 circular
  });

  it('renders specified number of rows', () => {
    render(<LeaderboardSkeleton rows={3} />);
    const circularSkeletons = screen.getAllByTestId('skeleton').filter(
      el => el.classList.contains('rounded-full')
    );
    expect(circularSkeletons).toHaveLength(6); // 3 rows * 2 circular
  });

  it('applies custom className', () => {
    render(<LeaderboardSkeleton className="custom-leaderboard" />);
    expect(screen.getByTestId('leaderboard-skeleton')).toHaveClass('custom-leaderboard');
  });
});

describe('TableSkeleton', () => {
  it('renders table skeleton', () => {
    render(<TableSkeleton />);
    expect(screen.getByTestId('table-skeleton')).toBeInTheDocument();
  });

  it('renders correct number of row skeletons', () => {
    render(<TableSkeleton rows={3} columns={2} />);
    const skeletons = screen.getAllByTestId('skeleton');
    // 2 columns in header + 3 rows * 2 columns = 8
    expect(skeletons).toHaveLength(8);
  });

  it('applies custom className', () => {
    render(<TableSkeleton className="custom-table" />);
    expect(screen.getByTestId('table-skeleton')).toHaveClass('custom-table');
  });
});

describe('ErrorState', () => {
  const defaultProps: ErrorStateProps = {};

  it('renders error state', () => {
    render(<ErrorState {...defaultProps} />);
    expect(screen.getByTestId('error-state')).toBeInTheDocument();
  });

  it('has alert role', () => {
    render(<ErrorState />);
    expect(screen.getByTestId('error-state')).toHaveAttribute('role', 'alert');
  });

  it('shows default title', () => {
    render(<ErrorState />);
    expect(screen.getByTestId('error-title')).toHaveTextContent('Something went wrong');
  });

  it('shows custom title', () => {
    render(<ErrorState title="Data loading failed" />);
    expect(screen.getByTestId('error-title')).toHaveTextContent('Data loading failed');
  });

  it('shows default message', () => {
    render(<ErrorState />);
    expect(screen.getByTestId('error-message')).toHaveTextContent('We encountered an error');
  });

  it('shows custom message', () => {
    render(<ErrorState message="Network connection lost" />);
    expect(screen.getByTestId('error-message')).toHaveTextContent('Network connection lost');
  });

  it('shows retry button when onRetry is provided', () => {
    render(<ErrorState onRetry={() => {}} />);
    expect(screen.getByTestId('error-retry')).toBeInTheDocument();
    expect(screen.getByTestId('error-retry')).toHaveTextContent('Try Again');
  });

  it('does not show retry button when onRetry is not provided', () => {
    render(<ErrorState />);
    expect(screen.queryByTestId('error-retry')).not.toBeInTheDocument();
  });

  it('calls onRetry when button is clicked', () => {
    const onRetry = vi.fn();
    render(<ErrorState onRetry={onRetry} />);
    
    fireEvent.click(screen.getByTestId('error-retry'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('applies custom className', () => {
    render(<ErrorState className="custom-error" />);
    expect(screen.getByTestId('error-state')).toHaveClass('custom-error');
  });
});

describe('EmptyState', () => {
  const defaultProps: EmptyStateProps = {};

  it('renders empty state', () => {
    render(<EmptyState {...defaultProps} />);
    expect(screen.getByTestId('empty-state')).toBeInTheDocument();
  });

  it('shows default title', () => {
    render(<EmptyState />);
    expect(screen.getByTestId('empty-title')).toHaveTextContent('No data available');
  });

  it('shows custom title', () => {
    render(<EmptyState title="No results found" />);
    expect(screen.getByTestId('empty-title')).toHaveTextContent('No results found');
  });

  it('shows default message', () => {
    render(<EmptyState />);
    expect(screen.getByTestId('empty-message')).toHaveTextContent('There is no data to display');
  });

  it('shows custom message', () => {
    render(<EmptyState message="Try adjusting your filters" />);
    expect(screen.getByTestId('empty-message')).toHaveTextContent('Try adjusting your filters');
  });

  it('shows custom icon when provided', () => {
    render(<EmptyState icon={<span>🔍</span>} />);
    expect(screen.getByTestId('empty-icon')).toHaveTextContent('🔍');
  });

  it('shows action when provided', () => {
    render(<EmptyState action={<button>Add Item</button>} />);
    expect(screen.getByTestId('empty-action')).toBeInTheDocument();
    expect(screen.getByText('Add Item')).toBeInTheDocument();
  });

  it('does not show action container when not provided', () => {
    render(<EmptyState />);
    expect(screen.queryByTestId('empty-action')).not.toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(<EmptyState className="custom-empty" />);
    expect(screen.getByTestId('empty-state')).toHaveClass('custom-empty');
  });
});

describe('LoadingOverlay', () => {
  const defaultProps: LoadingOverlayProps = {
    isLoading: false,
    children: <div>Content</div>,
  };

  it('renders container', () => {
    render(<LoadingOverlay {...defaultProps} />);
    expect(screen.getByTestId('loading-overlay-container')).toBeInTheDocument();
  });

  it('renders children', () => {
    render(<LoadingOverlay {...defaultProps} />);
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('shows overlay when loading', () => {
    render(<LoadingOverlay {...defaultProps} isLoading />);
    expect(screen.getByTestId('loading-overlay-active')).toBeInTheDocument();
  });

  it('hides overlay when not loading', () => {
    render(<LoadingOverlay {...defaultProps} isLoading={false} />);
    expect(screen.queryByTestId('loading-overlay-active')).not.toBeInTheDocument();
  });

  it('shows default message', () => {
    render(<LoadingOverlay {...defaultProps} isLoading />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('shows custom message', () => {
    render(<LoadingOverlay {...defaultProps} isLoading message="Fetching data..." />);
    expect(screen.getByText('Fetching data...')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(<LoadingOverlay {...defaultProps} className="custom-overlay" />);
    expect(screen.getByTestId('loading-overlay-container')).toHaveClass('custom-overlay');
  });

  it('children are still visible when loading (just dimmed)', () => {
    render(<LoadingOverlay {...defaultProps} isLoading />);
    expect(screen.getByText('Content')).toBeInTheDocument();
  });
});
