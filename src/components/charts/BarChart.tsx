/**
 * Bar Chart Component
 * Sprint 28 - T28.2
 * 
 * Versatile bar chart for activity metrics, comparisons, etc.
 */

import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import type { BarChartData, ChartDataPoint } from '../../types/analytics';

export interface BarChartProps {
  data: BarChartData | ChartDataPoint[];
  height?: number;
  horizontal?: boolean;
  stacked?: boolean;
  showGrid?: boolean;
  showLegend?: boolean;
  colors?: string[];
  formatValue?: (value: number) => string;
  onBarClick?: (data: unknown, index: number) => void;
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
];

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
  formatValue?: (value: number) => string;
}

function CustomTooltip({ active, payload, label, formatValue }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  
  return (
    <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200">
      <p className="font-semibold text-gray-900 mb-2">{label}</p>
      {payload.map((entry, index) => (
        <div key={index} className="flex items-center gap-2 text-sm">
          <span 
            className="w-3 h-3 rounded-full" 
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-gray-600">{entry.name}:</span>
          <span className="font-medium text-gray-900">
            {formatValue ? formatValue(entry.value) : entry.value.toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
}

export function BarChart({
  data,
  height = 300,
  horizontal = false,
  stacked = false,
  showGrid = true,
  showLegend = true,
  colors = DEFAULT_COLORS,
  formatValue,
  onBarClick,
  className = '',
}: BarChartProps) {
  // Normalize data format
  const isSimpleData = Array.isArray(data) && 'label' in (data[0] || {});
  
  let chartData: { name: string; [key: string]: unknown }[];
  let series: { name: string; dataKey: string; color: string }[];

  if (isSimpleData) {
    // Simple ChartDataPoint[] format
    chartData = (data as ChartDataPoint[]).map(d => ({
      name: d.label,
      value: d.value,
    }));
    series = [{ name: 'Value', dataKey: 'value', color: colors[0] }];
  } else {
    // BarChartData format
    const barData = data as BarChartData;
    chartData = barData.categories.map((cat, i) => {
      const point: { name: string; [key: string]: unknown } = { name: cat };
      barData.series.forEach(s => {
        point[s.name] = s.data[i] || 0;
      });
      return point;
    });
    series = barData.series.map((s, i) => ({
      name: s.name,
      dataKey: s.name,
      color: s.color || colors[i % colors.length],
    }));
  }

  const Layout = horizontal ? 'vertical' : 'horizontal';

  return (
    <div className={`w-full ${className}`} data-testid="bar-chart">
      <ResponsiveContainer width="100%" height={height}>
        <RechartsBarChart
          data={chartData}
          layout={Layout}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />}
          
          {horizontal ? (
            <>
              <XAxis type="number" tickFormatter={formatValue} />
              <YAxis dataKey="name" type="category" width={100} />
            </>
          ) : (
            <>
              <XAxis dataKey="name" />
              <YAxis tickFormatter={formatValue} />
            </>
          )}
          
          <Tooltip content={<CustomTooltip formatValue={formatValue} />} />
          
          {showLegend && series.length > 1 && (
            <Legend />
          )}
          
          {series.map((s) => (
            <Bar
              key={s.dataKey}
              dataKey={s.dataKey}
              name={s.name}
              fill={s.color}
              stackId={stacked ? 'stack' : undefined}
              onClick={(data, index) => onBarClick?.(data, index)}
              className="cursor-pointer"
            >
              {isSimpleData && (data as ChartDataPoint[]).map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={entry.color || colors[index % colors.length]}
                />
              ))}
            </Bar>
          ))}
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Activity Bar Chart
 * Pre-configured for activity metrics display
 */
export function ActivityBarChart({
  data,
  height = 250,
  className = '',
}: {
  data: Array<{ type: string; count: number; label: string }>;
  height?: number;
  className?: string;
}) {
  const chartData = data.map(d => ({
    label: d.label,
    value: d.count,
    color: getActivityColor(d.type),
  }));

  return (
    <BarChart
      data={chartData}
      height={height}
      horizontal
      showLegend={false}
      className={className}
    />
  );
}

function getActivityColor(type: string): string {
  const colors: Record<string, string> = {
    email_sent: '#3B82F6',
    email_opened: '#60A5FA',
    email_replied: '#2563EB',
    call_made: '#10B981',
    meeting_scheduled: '#F59E0B',
    meeting_completed: '#D97706',
    linkedin_message: '#0077B5',
    note_added: '#8B5CF6',
    status_changed: '#6B7280',
    deal_created: '#EC4899',
  };
  return colors[type] || '#6B7280';
}

export default BarChart;
