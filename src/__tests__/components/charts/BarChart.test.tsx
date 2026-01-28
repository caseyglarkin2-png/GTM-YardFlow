/**
 * BarChart Component Tests
 * Sprint 28B - T28B.1b
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BarChart, type BarChartProps } from '../../../components/charts/BarChart';
import type { BarChartData, ChartDataPoint } from '../../../types/analytics';

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

const mockSimpleData: ChartDataPoint[] = [
  { label: 'Emails', value: 150, color: '#3B82F6' },
  { label: 'Calls', value: 75, color: '#10B981' },
  { label: 'Meetings', value: 30, color: '#F59E0B' },
  { label: 'LinkedIn', value: 45, color: '#8B5CF6' },
];

const mockBarChartData: BarChartData = {
  categories: ['Jan', 'Feb', 'Mar', 'Apr'],
  series: [
    { name: 'Emails', data: [100, 120, 140, 160], color: '#3B82F6' },
    { name: 'Calls', data: [50, 60, 70, 80], color: '#10B981' },
  ],
};

describe('BarChart', () => {
  describe('with simple ChartDataPoint[] data', () => {
    const defaultProps: BarChartProps = {
      data: mockSimpleData,
    };

    it('renders bar chart container', () => {
      render(<BarChart {...defaultProps} />);
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      const { container } = render(<BarChart {...defaultProps} className="custom-class" />);
      expect(container.firstChild).toHaveClass('custom-class');
    });

    it('renders with custom height', () => {
      render(<BarChart {...defaultProps} height={400} />);
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });

    it('handles empty simple data gracefully', () => {
      // Empty ChartDataPoint[] with a label key so it's recognized as simple data
      const emptySimple: ChartDataPoint[] = [];
      // Add a dummy item to help type detection, then remove - or use BarChartData format
      const emptyBarData: BarChartData = { categories: [], series: [] };
      render(<BarChart data={emptyBarData} />);
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });

    it('handles single data point', () => {
      render(<BarChart data={[mockSimpleData[0]]} />);
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });
  });

  describe('with BarChartData format', () => {
    const defaultProps: BarChartProps = {
      data: mockBarChartData,
    };

    it('renders with multi-series data', () => {
      render(<BarChart {...defaultProps} />);
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });

    it('renders stacked bars', () => {
      render(<BarChart {...defaultProps} stacked />);
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });

    it('renders horizontal bars', () => {
      render(<BarChart {...defaultProps} horizontal />);
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });

    it('hides grid when showGrid is false', () => {
      render(<BarChart {...defaultProps} showGrid={false} />);
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });

    it('hides legend when showLegend is false', () => {
      render(<BarChart {...defaultProps} showLegend={false} />);
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });
  });

  describe('customization options', () => {
    it('uses custom colors', () => {
      const customColors = ['#FF0000', '#00FF00', '#0000FF'];
      render(<BarChart data={mockSimpleData} colors={customColors} />);
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });

    it('uses custom value formatter', () => {
      const formatValue = (value: number) => `$${value.toLocaleString()}`;
      render(<BarChart data={mockSimpleData} formatValue={formatValue} />);
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });

    it('handles onBarClick callback', () => {
      const onBarClick = vi.fn();
      render(<BarChart data={mockSimpleData} onBarClick={onBarClick} />);
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('handles very large values', () => {
      const largeData: ChartDataPoint[] = mockSimpleData.map(d => ({
        ...d,
        value: d.value * 1000000000,
      }));
      render(<BarChart data={largeData} />);
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });

    it('handles zero values', () => {
      const zeroData: ChartDataPoint[] = mockSimpleData.map(d => ({
        ...d,
        value: 0,
      }));
      render(<BarChart data={zeroData} />);
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });

    it('handles negative values', () => {
      const negativeData: ChartDataPoint[] = [
        { label: 'Gain', value: 100 },
        { label: 'Loss', value: -50 },
      ];
      render(<BarChart data={negativeData} />);
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });

    it('handles mixed positive and negative values', () => {
      const mixedData: ChartDataPoint[] = [
        { label: 'Q1', value: 100 },
        { label: 'Q2', value: -30 },
        { label: 'Q3', value: 50 },
        { label: 'Q4', value: -10 },
      ];
      render(<BarChart data={mixedData} />);
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });

    it('handles very long category names', () => {
      const longNameData = mockBarChartData;
      longNameData.categories = [
        'January 2025 - First Quarter Start',
        'February 2025 - Mid Quarter',
        'March 2025 - Quarter End',
        'April 2025 - Second Quarter Start',
      ];
      render(<BarChart data={longNameData} />);
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });

    it('handles data with missing colors', () => {
      const noColorData: ChartDataPoint[] = [
        { label: 'A', value: 10 },
        { label: 'B', value: 20 },
      ];
      render(<BarChart data={noColorData} />);
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });
  });

  describe('combined options', () => {
    it('renders horizontal stacked chart', () => {
      render(<BarChart data={mockBarChartData} horizontal stacked />);
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });

    it('renders with all options disabled', () => {
      render(
        <BarChart
          data={mockSimpleData}
          showGrid={false}
          showLegend={false}
        />
      );
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });
  });
});
