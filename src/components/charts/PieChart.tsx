/**
 * Pie Chart Component
 * Sprint 28 - T28.2
 * 
 * For distribution and composition visualizations.
 */

import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { PieChartData, ChartDataPoint } from '../../types/analytics';

export interface PieChartProps {
  data: PieChartData | ChartDataPoint[];
  height?: number;
  innerRadius?: number;
  outerRadius?: number;
  showLabels?: boolean;
  showLegend?: boolean;
  showPercentages?: boolean;
  colors?: string[];
  formatValue?: (value: number) => string;
  onSliceClick?: (data: ChartDataPoint) => void;
  className?: string;
}

const DEFAULT_COLORS = [
  '#3B82F6', // blue
  '#10B981', // green
  '#F59E0B', // amber
  '#EF4444', // red
  '#8B5CF6', // purple
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#6B7280', // gray
];

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: ChartDataPoint & { percent?: number } }>;
  formatValue?: (value: number) => string;
  total?: number;
}

function CustomTooltip({ active, payload, formatValue, total }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  
  const data = payload[0].payload;
  const percentage = total && total > 0 ? ((data.value / total) * 100).toFixed(1) : 0;
  
  return (
    <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200">
      <div className="flex items-center gap-2">
        <span 
          className="w-3 h-3 rounded-full" 
          style={{ backgroundColor: data.color }}
        />
        <span className="font-semibold text-gray-900">{data.label}</span>
      </div>
      <div className="mt-1 text-sm text-gray-600">
        <p>
          <span className="font-medium">
            {formatValue ? formatValue(data.value) : data.value.toLocaleString()}
          </span>
          {' '}({percentage}%)
        </p>
      </div>
    </div>
  );
}

const RADIAN = Math.PI / 180;

interface LabelProps {
  cx?: number;
  cy?: number;
  midAngle?: number;
  innerRadius?: number;
  outerRadius?: number;
  percent?: number;
}

function renderCustomLabel({ cx = 0, cy = 0, midAngle = 0, innerRadius = 0, outerRadius = 0, percent = 0 }: LabelProps) {
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  if (percent < 0.05) return null; // Don't show labels for small slices

  return (
    <text 
      x={x} 
      y={y} 
      fill="white" 
      textAnchor="middle" 
      dominantBaseline="central"
      fontSize={12}
      fontWeight={500}
    >
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
}

export function PieChart({
  data,
  height = 300,
  innerRadius = 0,
  outerRadius,
  showLabels = true,
  showLegend = true,
  showPercentages = true,
  colors = DEFAULT_COLORS,
  formatValue,
  onSliceClick,
  className = '',
}: PieChartProps) {
  // Normalize data format
  const chartData = Array.isArray(data) && !('data' in data)
    ? (data as ChartDataPoint[])
    : (data as PieChartData).data;
  
  const total = Array.isArray(data) && !('data' in data)
    ? chartData.reduce((sum, d) => sum + d.value, 0)
    : (data as PieChartData).total;

  // Add colors to data
  const coloredData = chartData.map((d, i) => ({
    ...d,
    color: d.color || colors[i % colors.length],
  }));

  // Calculate radius based on height
  const defaultOuterRadius = (height / 2) - 40;

  return (
    <div className={`w-full ${className}`} data-testid="pie-chart">
      <ResponsiveContainer width="100%" height={height}>
        <RechartsPieChart>
          <Pie
            data={coloredData}
            dataKey="value"
            nameKey="label"
            cx="50%"
            cy="50%"
            innerRadius={innerRadius}
            outerRadius={outerRadius || defaultOuterRadius}
            paddingAngle={2}
            onClick={(data) => onSliceClick?.(data as ChartDataPoint)}
            label={showLabels && showPercentages ? renderCustomLabel : undefined}
            labelLine={false}
          >
            {coloredData.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={entry.color}
                className="cursor-pointer hover:opacity-80 transition-opacity"
              />
            ))}
          </Pie>
          
          <Tooltip content={<CustomTooltip formatValue={formatValue} total={total} />} />
          
          {showLegend && (
            <Legend
              layout="vertical"
              align="right"
              verticalAlign="middle"
              formatter={(value) => <span className="text-sm text-gray-600">{value}</span>}
            />
          )}
        </RechartsPieChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Donut Chart
 * Pie chart with center hole for displaying total or label
 */
export function DonutChart({
  data,
  height = 300,
  centerLabel,
  centerValue,
  ...props
}: PieChartProps & {
  centerLabel?: string;
  centerValue?: string | number;
}) {
  const outerRadius = (height / 2) - 40;
  const innerRadius = outerRadius * 0.6;

  return (
    <div className="relative">
      <PieChart
        {...props}
        data={data}
        height={height}
        innerRadius={innerRadius}
        outerRadius={outerRadius}
      />
      {(centerLabel || centerValue) && (
        <div 
          className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
          style={{ height }}
        >
          {centerValue !== undefined && (
            <span className="text-2xl font-bold text-gray-900">
              {typeof centerValue === 'number' ? centerValue.toLocaleString() : centerValue}
            </span>
          )}
          {centerLabel && (
            <span className="text-sm text-gray-500">{centerLabel}</span>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Source Distribution Chart
 * Pre-configured for lead source distribution
 */
export function SourceDistributionChart({
  data,
  height = 250,
  className = '',
}: {
  data: Array<{ source: string; count: number }>;
  height?: number;
  className?: string;
}) {
  const chartData: ChartDataPoint[] = data.map((d, i) => ({
    label: d.source,
    value: d.count,
    color: DEFAULT_COLORS[i % DEFAULT_COLORS.length],
  }));

  const total = data.reduce((sum, d) => sum + d.count, 0);

  return (
    <DonutChart
      data={chartData}
      height={height}
      centerValue={total}
      centerLabel="Total"
      showLegend
      className={className}
    />
  );
}

export default PieChart;
