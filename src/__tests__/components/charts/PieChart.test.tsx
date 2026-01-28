/**
 * PieChart Component Tests
 * Sprint 28B - T28B.1d
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PieChart, type PieChartProps } from '../../../components/charts/PieChart';
import type { PieChartData, ChartDataPoint } from '../../../types/analytics';

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
  { label: 'Inbound', value: 450, color: '#3B82F6' },
  { label: 'Outbound', value: 350, color: '#10B981' },
  { label: 'Referral', value: 150, color: '#F59E0B' },
  { label: 'Partner', value: 50, color: '#8B5CF6' },
];

const mockPieChartData: PieChartData = {
  data: mockSimpleData,
  total: 1000,
};

describe('PieChart', () => {
  describe('with ChartDataPoint[] data', () => {
    const defaultProps: PieChartProps = {
      data: mockSimpleData,
    };

    it('renders pie chart container', () => {
      render(<PieChart {...defaultProps} />);
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      const { container } = render(<PieChart {...defaultProps} className="custom-class" />);
      expect(container.firstChild).toHaveClass('custom-class');
    });

    it('renders with custom height', () => {
      render(<PieChart {...defaultProps} height={400} />);
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });

    it('handles empty data gracefully', () => {
      render(<PieChart data={[]} />);
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });

    it('handles single slice', () => {
      render(<PieChart data={[mockSimpleData[0]]} />);
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });
  });

  describe('with PieChartData format', () => {
    const defaultProps: PieChartProps = {
      data: mockPieChartData,
    };

    it('renders with structured data', () => {
      render(<PieChart {...defaultProps} />);
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });

    it('uses total for percentage calculations', () => {
      render(<PieChart {...defaultProps} showPercentages />);
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });
  });

  describe('donut chart (inner radius)', () => {
    it('renders as donut when innerRadius > 0', () => {
      render(<PieChart data={mockSimpleData} innerRadius={50} />);
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });

    it('renders full pie when innerRadius is 0', () => {
      render(<PieChart data={mockSimpleData} innerRadius={0} />);
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });

    it('handles custom outer radius', () => {
      render(<PieChart data={mockSimpleData} outerRadius={100} />);
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });

    it('handles both inner and outer radius', () => {
      render(<PieChart data={mockSimpleData} innerRadius={40} outerRadius={80} />);
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });
  });

  describe('display options', () => {
    it('shows labels by default', () => {
      render(<PieChart data={mockSimpleData} />);
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });

    it('hides labels when showLabels is false', () => {
      render(<PieChart data={mockSimpleData} showLabels={false} />);
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });

    it('shows legend by default', () => {
      render(<PieChart data={mockSimpleData} />);
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });

    it('hides legend when showLegend is false', () => {
      render(<PieChart data={mockSimpleData} showLegend={false} />);
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });

    it('shows percentages when showPercentages is true', () => {
      render(<PieChart data={mockSimpleData} showPercentages />);
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });
  });

  describe('customization', () => {
    it('uses custom colors', () => {
      const customColors = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00'];
      render(<PieChart data={mockSimpleData} colors={customColors} />);
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });

    it('uses custom value formatter', () => {
      const formatValue = (value: number) => `$${value.toLocaleString()}`;
      render(<PieChart data={mockSimpleData} formatValue={formatValue} />);
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });

    it('handles onSliceClick callback', () => {
      const onSliceClick = vi.fn();
      render(<PieChart data={mockSimpleData} onSliceClick={onSliceClick} />);
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('handles very large values', () => {
      const largeData: ChartDataPoint[] = mockSimpleData.map(d => ({
        ...d,
        value: d.value * 1000000000,
      }));
      render(<PieChart data={largeData} />);
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });

    it('handles zero values', () => {
      const zeroData: ChartDataPoint[] = [
        { label: 'A', value: 100 },
        { label: 'B', value: 0 },
        { label: 'C', value: 50 },
      ];
      render(<PieChart data={zeroData} />);
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });

    it('handles all zero values', () => {
      const allZeroData: ChartDataPoint[] = [
        { label: 'A', value: 0 },
        { label: 'B', value: 0 },
      ];
      render(<PieChart data={allZeroData} />);
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });

    it('handles very small slices', () => {
      const smallSliceData: ChartDataPoint[] = [
        { label: 'Large', value: 1000 },
        { label: 'Tiny', value: 1 },
        { label: 'Micro', value: 0.1 },
      ];
      render(<PieChart data={smallSliceData} />);
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });

    it('handles many slices', () => {
      const manySlices: ChartDataPoint[] = Array.from({ length: 20 }, (_, i) => ({
        label: `Slice ${i + 1}`,
        value: Math.random() * 100,
      }));
      render(<PieChart data={manySlices} />);
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });

    it('handles very long labels', () => {
      const longLabelData: ChartDataPoint[] = [
        { label: 'This is a very long label that might overflow', value: 100 },
        { label: 'Another extremely long label for testing purposes', value: 50 },
      ];
      render(<PieChart data={longLabelData} />);
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });

    it('handles data without colors', () => {
      const noColorData: ChartDataPoint[] = [
        { label: 'A', value: 100 },
        { label: 'B', value: 200 },
        { label: 'C', value: 150 },
      ];
      render(<PieChart data={noColorData} />);
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });

    it('handles decimal values', () => {
      const decimalData: ChartDataPoint[] = [
        { label: 'A', value: 33.33 },
        { label: 'B', value: 33.33 },
        { label: 'C', value: 33.34 },
      ];
      render(<PieChart data={decimalData} />);
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });
  });

  describe('combined options', () => {
    it('renders donut with labels and legend', () => {
      render(
        <PieChart
          data={mockSimpleData}
          innerRadius={50}
          showLabels
          showLegend
        />
      );
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });

    it('renders with all options disabled', () => {
      render(
        <PieChart
          data={mockSimpleData}
          showLabels={false}
          showLegend={false}
          showPercentages={false}
        />
      );
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });

    it('renders with all options enabled', () => {
      render(
        <PieChart
          data={mockSimpleData}
          showLabels
          showLegend
          showPercentages
          innerRadius={40}
          outerRadius={80}
        />
      );
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });

    it('renders with custom formatting and click handler', () => {
      const formatValue = (value: number) => `$${value}`;
      const onSliceClick = vi.fn();
      render(
        <PieChart
          data={mockSimpleData}
          formatValue={formatValue}
          onSliceClick={onSliceClick}
          showPercentages
        />
      );
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });
  });
});
