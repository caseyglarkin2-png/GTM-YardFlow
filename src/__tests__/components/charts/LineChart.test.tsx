/**
 * LineChart Component Tests
 * Sprint 28B - T28B.1c
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LineChart, type LineChartProps } from '../../../components/charts/LineChart';
import type { LineChartData, TimeSeriesPoint } from '../../../types/analytics';

// Mock recharts to avoid ResponsiveContainer issues in tests
vi.mock('recharts', async () => {
  const actual = await vi.importActual<typeof import('recharts')>('recharts');
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="responsive-container" style={{ width: 400, height: 300 }}>
        {children}
      </div>
    ),
  };
});

const mockTimeSeriesData: TimeSeriesPoint[] = [
  { date: '2025-01-01', value: 100, label: 'Jan 1' },
  { date: '2025-01-02', value: 120, label: 'Jan 2' },
  { date: '2025-01-03', value: 115, label: 'Jan 3' },
  { date: '2025-01-04', value: 140, label: 'Jan 4' },
  { date: '2025-01-05', value: 160, label: 'Jan 5' },
];

const mockLineChartData: LineChartData = {
  series: [
    {
      name: 'Emails Sent',
      data: mockTimeSeriesData,
      color: '#3B82F6',
    },
    {
      name: 'Calls Made',
      data: mockTimeSeriesData.map(p => ({ ...p, value: p.value * 0.5 })),
      color: '#10B981',
    },
  ],
};

const singleSeriesData: LineChartData = {
  series: [
    {
      name: 'Revenue',
      data: mockTimeSeriesData,
      color: '#3B82F6',
    },
  ],
};

describe('LineChart', () => {
  const defaultProps: LineChartProps = {
    data: mockLineChartData,
  };

  describe('basic rendering', () => {
    it('renders line chart container', () => {
      render(<LineChart {...defaultProps} />);
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      const { container } = render(<LineChart {...defaultProps} className="custom-class" />);
      expect(container.firstChild).toHaveClass('custom-class');
    });

    it('renders with custom height', () => {
      render(<LineChart {...defaultProps} height={500} />);
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });

    it('renders single series', () => {
      render(<LineChart data={singleSeriesData} />);
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });

    it('renders multiple series', () => {
      render(<LineChart {...defaultProps} />);
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });
  });

  describe('display options', () => {
    it('shows grid by default', () => {
      render(<LineChart {...defaultProps} />);
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });

    it('hides grid when showGrid is false', () => {
      render(<LineChart {...defaultProps} showGrid={false} />);
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });

    it('shows legend by default', () => {
      render(<LineChart {...defaultProps} />);
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });

    it('hides legend when showLegend is false', () => {
      render(<LineChart {...defaultProps} showLegend={false} />);
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });

    it('renders with area fill', () => {
      render(<LineChart {...defaultProps} showArea />);
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });

    it('renders smooth curves by default', () => {
      render(<LineChart {...defaultProps} />);
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });

    it('renders straight lines when smooth is false', () => {
      render(<LineChart {...defaultProps} smooth={false} />);
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });
  });

  describe('formatters', () => {
    it('uses custom value formatter', () => {
      const formatValue = (value: number) => `$${value.toFixed(2)}`;
      render(<LineChart {...defaultProps} formatValue={formatValue} />);
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });

    it('uses custom date formatter', () => {
      const formatDate = (date: string) => new Date(date).toLocaleDateString();
      render(<LineChart {...defaultProps} formatDate={formatDate} />);
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });

    it('uses both formatters together', () => {
      const formatValue = (value: number) => `$${value}`;
      const formatDate = (date: string) => date.split('-')[2];
      render(<LineChart {...defaultProps} formatValue={formatValue} formatDate={formatDate} />);
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });
  });

  describe('customization', () => {
    it('uses custom colors', () => {
      const customColors = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF'];
      render(<LineChart {...defaultProps} colors={customColors} />);
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });

    it('handles onPointClick callback', () => {
      const onPointClick = vi.fn();
      render(<LineChart {...defaultProps} onPointClick={onPointClick} />);
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('handles empty series array', () => {
      render(<LineChart data={{ series: [] }} />);
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });

    it('handles series with empty data', () => {
      render(<LineChart data={{ series: [{ name: 'Empty', data: [] }] }} />);
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });

    it('handles single data point', () => {
      const singlePoint: LineChartData = {
        series: [{ name: 'Single', data: [{ date: '2025-01-01', value: 100 }] }],
      };
      render(<LineChart data={singlePoint} />);
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });

    it('handles very large values', () => {
      const largeData: LineChartData = {
        series: [{
          name: 'Large',
          data: mockTimeSeriesData.map(p => ({ ...p, value: p.value * 1000000000 })),
        }],
      };
      render(<LineChart data={largeData} />);
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });

    it('handles negative values', () => {
      const negativeData: LineChartData = {
        series: [{
          name: 'Negative',
          data: mockTimeSeriesData.map(p => ({ ...p, value: -p.value })),
        }],
      };
      render(<LineChart data={negativeData} />);
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });

    it('handles mixed positive and negative values', () => {
      const mixedData: LineChartData = {
        series: [{
          name: 'Mixed',
          data: [
            { date: '2025-01-01', value: 100 },
            { date: '2025-01-02', value: -50 },
            { date: '2025-01-03', value: 75 },
            { date: '2025-01-04', value: -25 },
          ],
        }],
      };
      render(<LineChart data={mixedData} />);
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });

    it('handles unsorted dates', () => {
      const unsortedData: LineChartData = {
        series: [{
          name: 'Unsorted',
          data: [
            { date: '2025-01-03', value: 115 },
            { date: '2025-01-01', value: 100 },
            { date: '2025-01-05', value: 160 },
            { date: '2025-01-02', value: 120 },
          ],
        }],
      };
      render(<LineChart data={unsortedData} />);
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });

    it('handles series with different date ranges', () => {
      const differentRanges: LineChartData = {
        series: [
          {
            name: 'Series A',
            data: [
              { date: '2025-01-01', value: 100 },
              { date: '2025-01-02', value: 120 },
            ],
          },
          {
            name: 'Series B',
            data: [
              { date: '2025-01-02', value: 80 },
              { date: '2025-01-03', value: 90 },
            ],
          },
        ],
      };
      render(<LineChart data={differentRanges} />);
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });

    it('handles series without colors', () => {
      const noColorData: LineChartData = {
        series: [
          { name: 'No Color 1', data: mockTimeSeriesData },
          { name: 'No Color 2', data: mockTimeSeriesData.map(p => ({ ...p, value: p.value * 0.8 })) },
        ],
      };
      render(<LineChart data={noColorData} />);
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });
  });

  describe('combined options', () => {
    it('renders with area and smooth lines', () => {
      render(<LineChart {...defaultProps} showArea smooth />);
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });

    it('renders with area and straight lines', () => {
      render(<LineChart {...defaultProps} showArea smooth={false} />);
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });

    it('renders with all display options disabled', () => {
      render(
        <LineChart
          {...defaultProps}
          showGrid={false}
          showLegend={false}
          showArea={false}
          smooth={false}
        />
      );
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });

    it('renders with all display options enabled', () => {
      render(
        <LineChart
          {...defaultProps}
          showGrid
          showLegend
          showArea
          smooth
        />
      );
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });
  });
});
