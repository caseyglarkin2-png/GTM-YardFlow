/**
 * KPICard Component Tests
 * Sprint 28B - T28B.3
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { KPICard, KPIGrid, type KPICardProps, type KPIGridProps } from '../../components/KPICard';
import type { KPIMetric } from '../../types/analytics';

const mockMetric: KPIMetric = {
  id: 'revenue',
  name: 'Total Revenue',
  value: {
    current: 125000,
    previous: 100000,
    change: 25000,
    changePercent: 25,
    trend: 'up',
  },
  format: 'currency',
};

const mockMetricDown: KPIMetric = {
  id: 'churn',
  name: 'Churn Rate',
  value: {
    current: 5.2,
    previous: 4.8,
    change: 0.4,
    changePercent: 8.3,
    trend: 'up',
  },
  format: 'percent',
};

const mockMetricFlat: KPIMetric = {
  id: 'deals',
  name: 'Active Deals',
  value: {
    current: 42,
    previous: 42,
    change: 0,
    changePercent: 0,
    trend: 'flat',
  },
  format: 'number',
};

const mockMetricDuration: KPIMetric = {
  id: 'cycle-time',
  name: 'Avg Cycle Time',
  value: {
    current: 14.5,
    previous: 18.2,
    change: -3.7,
    changePercent: -20.3,
    trend: 'down',
  },
  format: 'duration',
};

describe('KPICard', () => {
  const defaultProps: KPICardProps = {
    metric: mockMetric,
  };

  describe('rendering', () => {
    it('renders the KPI card', () => {
      render(<KPICard {...defaultProps} />);
      expect(screen.getByTestId('kpi-card')).toBeInTheDocument();
    });

    it('displays the metric name', () => {
      render(<KPICard {...defaultProps} />);
      expect(screen.getByTestId('kpi-name')).toHaveTextContent('Total Revenue');
    });

    it('displays the current value formatted as currency', () => {
      render(<KPICard {...defaultProps} />);
      expect(screen.getByTestId('kpi-value')).toHaveTextContent('$125,000');
    });

    it('displays the previous value', () => {
      render(<KPICard {...defaultProps} />);
      expect(screen.getByTestId('kpi-previous')).toHaveTextContent('$100,000');
    });

    it('displays the change value', () => {
      render(<KPICard {...defaultProps} />);
      expect(screen.getByTestId('kpi-change')).toHaveTextContent('+$25,000');
    });

    it('displays the trend badge with percentage', () => {
      render(<KPICard {...defaultProps} />);
      expect(screen.getByTestId('kpi-trend')).toHaveTextContent('25.0%');
    });

    it('applies custom className', () => {
      render(<KPICard {...defaultProps} className="custom-class" />);
      expect(screen.getByTestId('kpi-card')).toHaveClass('custom-class');
    });
  });

  describe('formatting', () => {
    it('formats currency values correctly', () => {
      render(<KPICard metric={mockMetric} />);
      expect(screen.getByTestId('kpi-value')).toHaveTextContent('$125,000');
    });

    it('formats percent values correctly', () => {
      render(<KPICard metric={mockMetricDown} />);
      expect(screen.getByTestId('kpi-value')).toHaveTextContent('5.2%');
    });

    it('formats number values correctly', () => {
      render(<KPICard metric={mockMetricFlat} />);
      expect(screen.getByTestId('kpi-value')).toHaveTextContent('42');
    });

    it('formats duration values (hours) correctly', () => {
      render(<KPICard metric={mockMetricDuration} />);
      expect(screen.getByTestId('kpi-value')).toHaveTextContent('14.5h');
    });

    it('formats short duration (minutes) correctly', () => {
      const shortDuration: KPIMetric = {
        ...mockMetricDuration,
        value: { ...mockMetricDuration.value, current: 0.5 },
      };
      render(<KPICard metric={shortDuration} />);
      expect(screen.getByTestId('kpi-value')).toHaveTextContent('30m');
    });

    it('formats long duration (days) correctly', () => {
      const longDuration: KPIMetric = {
        ...mockMetricDuration,
        value: { ...mockMetricDuration.value, current: 72 },
      };
      render(<KPICard metric={longDuration} />);
      expect(screen.getByTestId('kpi-value')).toHaveTextContent('3d');
    });
  });

  describe('trend indicators', () => {
    it('shows up trend for increasing values', () => {
      render(<KPICard metric={mockMetric} />);
      const trend = screen.getByTestId('kpi-trend');
      expect(trend).toBeInTheDocument();
      // Up trend for revenue should be green
      expect(trend.className).toContain('green');
    });

    it('shows down trend for decreasing values', () => {
      render(<KPICard metric={mockMetricDuration} />);
      const trend = screen.getByTestId('kpi-trend');
      expect(trend).toBeInTheDocument();
    });

    it('shows flat trend for unchanged values', () => {
      render(<KPICard metric={mockMetricFlat} />);
      const trend = screen.getByTestId('kpi-trend');
      expect(trend.className).toContain('gray');
    });

    it('inverts trend color for negative metrics (churn)', () => {
      render(<KPICard metric={mockMetricDown} />);
      const trend = screen.getByTestId('kpi-trend');
      // Churn going up is bad, so should be red
      expect(trend.className).toContain('red');
    });

    it('shows green for decreasing time metrics', () => {
      render(<KPICard metric={mockMetricDuration} />);
      const trend = screen.getByTestId('kpi-trend');
      // Cycle time going down is good
      expect(trend.className).toContain('green');
    });
  });

  describe('interactivity', () => {
    it('calls onClick when card is clicked', () => {
      const onClick = vi.fn();
      render(<KPICard {...defaultProps} onClick={onClick} />);
      
      fireEvent.click(screen.getByTestId('kpi-card'));
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('has button role when clickable', () => {
      const onClick = vi.fn();
      render(<KPICard {...defaultProps} onClick={onClick} />);
      
      expect(screen.getByTestId('kpi-card')).toHaveAttribute('role', 'button');
    });

    it('has no role when not clickable', () => {
      render(<KPICard {...defaultProps} />);
      expect(screen.getByTestId('kpi-card')).not.toHaveAttribute('role');
    });

    it('is keyboard accessible when clickable', () => {
      const onClick = vi.fn();
      render(<KPICard {...defaultProps} onClick={onClick} />);
      
      const card = screen.getByTestId('kpi-card');
      fireEvent.keyDown(card, { key: 'Enter' });
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('has tabIndex when clickable', () => {
      const onClick = vi.fn();
      render(<KPICard {...defaultProps} onClick={onClick} />);
      
      expect(screen.getByTestId('kpi-card')).toHaveAttribute('tabIndex', '0');
    });

    it('has no tabIndex when not clickable', () => {
      render(<KPICard {...defaultProps} />);
      expect(screen.getByTestId('kpi-card')).not.toHaveAttribute('tabIndex');
    });
  });

  describe('icon display', () => {
    it('displays icon when provided', () => {
      const metricWithIcon: KPIMetric = {
        ...mockMetric,
        icon: '💰',
        color: '#10B981',
      };
      render(<KPICard metric={metricWithIcon} />);
      expect(screen.getByTestId('kpi-icon')).toHaveTextContent('💰');
    });

    it('does not render icon container when no icon', () => {
      render(<KPICard {...defaultProps} />);
      expect(screen.queryByTestId('kpi-icon')).not.toBeInTheDocument();
    });

    it('applies custom color to icon', () => {
      const metricWithIcon: KPIMetric = {
        ...mockMetric,
        icon: '📈',
        color: '#EF4444',
      };
      render(<KPICard metric={metricWithIcon} />);
      expect(screen.getByTestId('kpi-icon')).toHaveStyle({ color: '#EF4444' });
    });
  });

  describe('edge cases', () => {
    it('handles zero values', () => {
      const zeroMetric: KPIMetric = {
        ...mockMetric,
        value: {
          current: 0,
          previous: 0,
          change: 0,
          changePercent: 0,
          trend: 'flat',
        },
      };
      render(<KPICard metric={zeroMetric} />);
      expect(screen.getByTestId('kpi-value')).toHaveTextContent('$0');
    });

    it('handles negative values', () => {
      const negativeMetric: KPIMetric = {
        ...mockMetric,
        value: {
          current: -5000,
          previous: 0,
          change: -5000,
          changePercent: -100,
          trend: 'down',
        },
      };
      render(<KPICard metric={negativeMetric} />);
      expect(screen.getByTestId('kpi-value')).toHaveTextContent('-$5,000');
    });

    it('handles very large values', () => {
      const largeMetric: KPIMetric = {
        ...mockMetric,
        value: {
          ...mockMetric.value,
          current: 1234567890,
        },
      };
      render(<KPICard metric={largeMetric} />);
      expect(screen.getByTestId('kpi-value')).toHaveTextContent('$1,234,567,890');
    });

    it('handles small percentages', () => {
      const smallPercent: KPIMetric = {
        ...mockMetricDown,
        value: {
          ...mockMetricDown.value,
          changePercent: 0.1,
        },
      };
      render(<KPICard metric={smallPercent} />);
      expect(screen.getByTestId('kpi-trend')).toHaveTextContent('0.1%');
    });
  });
});

describe('KPIGrid', () => {
  const mockMetrics: KPIMetric[] = [
    mockMetric,
    mockMetricDown,
    mockMetricFlat,
    mockMetricDuration,
  ];

  const defaultProps: KPIGridProps = {
    metrics: mockMetrics,
  };

  describe('rendering', () => {
    it('renders the KPI grid', () => {
      render(<KPIGrid {...defaultProps} />);
      expect(screen.getByTestId('kpi-grid')).toBeInTheDocument();
    });

    it('renders all metrics', () => {
      render(<KPIGrid {...defaultProps} />);
      const cards = screen.getAllByTestId('kpi-card');
      expect(cards).toHaveLength(4);
    });

    it('applies custom className', () => {
      render(<KPIGrid {...defaultProps} className="custom-grid" />);
      expect(screen.getByTestId('kpi-grid')).toHaveClass('custom-grid');
    });
  });

  describe('column layouts', () => {
    it('uses 4 columns by default', () => {
      render(<KPIGrid {...defaultProps} />);
      expect(screen.getByTestId('kpi-grid').className).toContain('lg:grid-cols-4');
    });

    it('uses 3 columns when specified', () => {
      render(<KPIGrid {...defaultProps} columns={3} />);
      expect(screen.getByTestId('kpi-grid').className).toContain('lg:grid-cols-3');
    });

    it('uses 2 columns when specified', () => {
      render(<KPIGrid {...defaultProps} columns={2} />);
      expect(screen.getByTestId('kpi-grid').className).toContain('sm:grid-cols-2');
      expect(screen.getByTestId('kpi-grid').className).not.toContain('lg:grid-cols');
    });
  });

  describe('interactivity', () => {
    it('calls onMetricClick when a metric is clicked', () => {
      const onMetricClick = vi.fn();
      render(<KPIGrid {...defaultProps} onMetricClick={onMetricClick} />);
      
      const cards = screen.getAllByTestId('kpi-card');
      fireEvent.click(cards[0]);
      
      expect(onMetricClick).toHaveBeenCalledWith(mockMetric);
    });

    it('does not add click handlers when onMetricClick is not provided', () => {
      render(<KPIGrid {...defaultProps} />);
      
      const cards = screen.getAllByTestId('kpi-card');
      expect(cards[0]).not.toHaveAttribute('role', 'button');
    });
  });

  describe('edge cases', () => {
    it('handles empty metrics array', () => {
      render(<KPIGrid metrics={[]} />);
      expect(screen.getByTestId('kpi-grid')).toBeInTheDocument();
      expect(screen.queryByTestId('kpi-card')).not.toBeInTheDocument();
    });

    it('handles single metric', () => {
      render(<KPIGrid metrics={[mockMetric]} />);
      const cards = screen.getAllByTestId('kpi-card');
      expect(cards).toHaveLength(1);
    });
  });
});
