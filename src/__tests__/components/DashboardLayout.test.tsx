/**
 * DashboardLayout Component Tests
 * Sprint 28B - T28B.4
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { 
  DashboardLayout, 
  DashboardSection, 
  DashboardCard, 
  DashboardGrid,
  type DashboardLayoutProps,
  type DashboardSectionProps,
  type DashboardCardProps,
  type DashboardGridProps,
} from '../../components/DashboardLayout';

describe('DashboardLayout', () => {
  const defaultProps: DashboardLayoutProps = {
    selectedPeriod: 'month',
    onPeriodChange: vi.fn(),
    children: <div>Dashboard Content</div>,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders the dashboard layout', () => {
      render(<DashboardLayout {...defaultProps} />);
      expect(screen.getByTestId('dashboard-layout')).toBeInTheDocument();
    });

    it('displays the default title', () => {
      render(<DashboardLayout {...defaultProps} />);
      expect(screen.getByTestId('dashboard-title')).toHaveTextContent('Analytics Dashboard');
    });

    it('displays custom title', () => {
      render(<DashboardLayout {...defaultProps} title="Sales Dashboard" />);
      expect(screen.getByTestId('dashboard-title')).toHaveTextContent('Sales Dashboard');
    });

    it('displays subtitle when provided', () => {
      render(<DashboardLayout {...defaultProps} subtitle="Q1 2025 Performance" />);
      expect(screen.getByTestId('dashboard-subtitle')).toHaveTextContent('Q1 2025 Performance');
    });

    it('does not display subtitle when not provided', () => {
      render(<DashboardLayout {...defaultProps} />);
      expect(screen.queryByTestId('dashboard-subtitle')).not.toBeInTheDocument();
    });

    it('renders children in content area', () => {
      render(<DashboardLayout {...defaultProps} />);
      expect(screen.getByTestId('dashboard-content')).toHaveTextContent('Dashboard Content');
    });

    it('includes date range picker', () => {
      render(<DashboardLayout {...defaultProps} />);
      expect(screen.getByTestId('date-range-picker')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(<DashboardLayout {...defaultProps} className="custom-class" />);
      expect(screen.getByTestId('dashboard-layout')).toHaveClass('custom-class');
    });
  });

  describe('refresh button', () => {
    it('shows refresh button when onRefresh is provided', () => {
      const onRefresh = vi.fn();
      render(<DashboardLayout {...defaultProps} onRefresh={onRefresh} />);
      expect(screen.getByTestId('refresh-button')).toBeInTheDocument();
    });

    it('does not show refresh button when onRefresh is not provided', () => {
      render(<DashboardLayout {...defaultProps} />);
      expect(screen.queryByTestId('refresh-button')).not.toBeInTheDocument();
    });

    it('calls onRefresh when clicked', () => {
      const onRefresh = vi.fn();
      render(<DashboardLayout {...defaultProps} onRefresh={onRefresh} />);
      
      fireEvent.click(screen.getByTestId('refresh-button'));
      expect(onRefresh).toHaveBeenCalledTimes(1);
    });

    it('disables refresh button when loading', () => {
      const onRefresh = vi.fn();
      render(<DashboardLayout {...defaultProps} onRefresh={onRefresh} isLoading />);
      
      expect(screen.getByTestId('refresh-button')).toBeDisabled();
    });
  });

  describe('export button', () => {
    it('shows export button when onExport is provided', () => {
      const onExport = vi.fn();
      render(<DashboardLayout {...defaultProps} onExport={onExport} />);
      expect(screen.getByTestId('export-button')).toBeInTheDocument();
    });

    it('does not show export button when onExport is not provided', () => {
      render(<DashboardLayout {...defaultProps} />);
      expect(screen.queryByTestId('export-button')).not.toBeInTheDocument();
    });

    it('calls onExport when clicked', () => {
      const onExport = vi.fn();
      render(<DashboardLayout {...defaultProps} onExport={onExport} />);
      
      fireEvent.click(screen.getByTestId('export-button'));
      expect(onExport).toHaveBeenCalledTimes(1);
    });

    it('disables export button when loading', () => {
      const onExport = vi.fn();
      render(<DashboardLayout {...defaultProps} onExport={onExport} isLoading />);
      
      expect(screen.getByTestId('export-button')).toBeDisabled();
    });
  });

  describe('loading state', () => {
    it('shows loading overlay when isLoading is true', () => {
      render(<DashboardLayout {...defaultProps} isLoading />);
      expect(screen.getByTestId('loading-overlay')).toBeInTheDocument();
    });

    it('does not show loading overlay when isLoading is false', () => {
      render(<DashboardLayout {...defaultProps} isLoading={false} />);
      expect(screen.queryByTestId('loading-overlay')).not.toBeInTheDocument();
    });

    it('shows loading text', () => {
      render(<DashboardLayout {...defaultProps} isLoading />);
      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });
  });

  describe('last updated', () => {
    it('shows last updated when provided', () => {
      const lastUpdated = new Date('2025-01-15T10:30:00');
      render(<DashboardLayout {...defaultProps} lastUpdated={lastUpdated} />);
      expect(screen.getByTestId('last-updated')).toBeInTheDocument();
    });

    it('does not show last updated when not provided', () => {
      render(<DashboardLayout {...defaultProps} />);
      expect(screen.queryByTestId('last-updated')).not.toBeInTheDocument();
    });
  });

  describe('date range picker integration', () => {
    it('passes selectedPeriod to DateRangePicker', () => {
      render(<DashboardLayout {...defaultProps} selectedPeriod="week" />);
      expect(screen.getByText('This Week')).toBeInTheDocument();
    });

    it('passes onPeriodChange to DateRangePicker', () => {
      const onPeriodChange = vi.fn();
      render(<DashboardLayout {...defaultProps} onPeriodChange={onPeriodChange} />);
      
      fireEvent.click(screen.getByTestId('date-range-trigger'));
      fireEvent.click(screen.getByText('Today'));
      
      expect(onPeriodChange).toHaveBeenCalledWith('today');
    });
  });
});

describe('DashboardSection', () => {
  const defaultProps: DashboardSectionProps = {
    title: 'Section Title',
    children: <div>Section Content</div>,
  };

  describe('rendering', () => {
    it('renders the section', () => {
      render(<DashboardSection {...defaultProps} />);
      expect(screen.getByTestId('dashboard-section')).toBeInTheDocument();
    });

    it('displays the title', () => {
      render(<DashboardSection {...defaultProps} />);
      expect(screen.getByTestId('section-title')).toHaveTextContent('Section Title');
    });

    it('displays description when provided', () => {
      render(<DashboardSection {...defaultProps} description="Section description text" />);
      expect(screen.getByTestId('section-description')).toHaveTextContent('Section description text');
    });

    it('does not display description when not provided', () => {
      render(<DashboardSection {...defaultProps} />);
      expect(screen.queryByTestId('section-description')).not.toBeInTheDocument();
    });

    it('renders children in content area', () => {
      render(<DashboardSection {...defaultProps} />);
      expect(screen.getByTestId('section-content')).toHaveTextContent('Section Content');
    });

    it('renders actions when provided', () => {
      render(
        <DashboardSection {...defaultProps} actions={<button>Action</button>} />
      );
      expect(screen.getByTestId('section-actions')).toBeInTheDocument();
      expect(screen.getByText('Action')).toBeInTheDocument();
    });

    it('does not render actions container when not provided', () => {
      render(<DashboardSection {...defaultProps} />);
      expect(screen.queryByTestId('section-actions')).not.toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(<DashboardSection {...defaultProps} className="custom-section" />);
      expect(screen.getByTestId('dashboard-section')).toHaveClass('custom-section');
    });
  });
});

describe('DashboardCard', () => {
  const defaultProps: DashboardCardProps = {
    children: <div>Card Content</div>,
  };

  describe('rendering', () => {
    it('renders the card', () => {
      render(<DashboardCard {...defaultProps} />);
      expect(screen.getByTestId('dashboard-card')).toBeInTheDocument();
    });

    it('renders children in content area', () => {
      render(<DashboardCard {...defaultProps} />);
      expect(screen.getByTestId('card-content')).toHaveTextContent('Card Content');
    });

    it('displays title when provided', () => {
      render(<DashboardCard {...defaultProps} title="Card Title" />);
      expect(screen.getByTestId('card-title')).toHaveTextContent('Card Title');
    });

    it('does not display title when not provided', () => {
      render(<DashboardCard {...defaultProps} />);
      expect(screen.queryByTestId('card-title')).not.toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(<DashboardCard {...defaultProps} className="custom-card" />);
      expect(screen.getByTestId('dashboard-card')).toHaveClass('custom-card');
    });
  });

  describe('padding', () => {
    it('uses medium padding by default', () => {
      render(<DashboardCard {...defaultProps} />);
      expect(screen.getByTestId('card-content')).toHaveClass('p-5');
    });

    it('uses small padding when specified', () => {
      render(<DashboardCard {...defaultProps} padding="sm" />);
      expect(screen.getByTestId('card-content')).toHaveClass('p-3');
    });

    it('uses large padding when specified', () => {
      render(<DashboardCard {...defaultProps} padding="lg" />);
      expect(screen.getByTestId('card-content')).toHaveClass('p-6');
    });

    it('uses no padding when specified', () => {
      render(<DashboardCard {...defaultProps} padding="none" />);
      const content = screen.getByTestId('card-content');
      expect(content).not.toHaveClass('p-3');
      expect(content).not.toHaveClass('p-5');
      expect(content).not.toHaveClass('p-6');
    });
  });
});

describe('DashboardGrid', () => {
  const defaultProps: DashboardGridProps = {
    children: (
      <>
        <div>Item 1</div>
        <div>Item 2</div>
      </>
    ),
  };

  describe('rendering', () => {
    it('renders the grid', () => {
      render(<DashboardGrid {...defaultProps} />);
      expect(screen.getByTestId('dashboard-grid')).toBeInTheDocument();
    });

    it('renders children', () => {
      render(<DashboardGrid {...defaultProps} />);
      expect(screen.getByText('Item 1')).toBeInTheDocument();
      expect(screen.getByText('Item 2')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(<DashboardGrid {...defaultProps} className="custom-grid" />);
      expect(screen.getByTestId('dashboard-grid')).toHaveClass('custom-grid');
    });
  });

  describe('columns', () => {
    it('uses 2 columns by default', () => {
      render(<DashboardGrid {...defaultProps} />);
      expect(screen.getByTestId('dashboard-grid')).toHaveClass('lg:grid-cols-2');
    });

    it('uses 1 column when specified', () => {
      render(<DashboardGrid {...defaultProps} columns={1} />);
      const grid = screen.getByTestId('dashboard-grid');
      expect(grid).toHaveClass('grid-cols-1');
      expect(grid).not.toHaveClass('lg:grid-cols-2');
    });

    it('uses 3 columns when specified', () => {
      render(<DashboardGrid {...defaultProps} columns={3} />);
      expect(screen.getByTestId('dashboard-grid')).toHaveClass('lg:grid-cols-3');
    });
  });
});
