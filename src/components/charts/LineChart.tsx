/**
 * Line Chart Component
 * Sprint 28 - T28.2
 * 
 * Time series chart for trends and historical data.
 */

import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  ComposedChart,
} from 'recharts';
import type { LineChartData, TimeSeriesPoint } from '../../types/analytics';

export interface LineChartProps {
  data: LineChartData;
  height?: number;
  showGrid?: boolean;
  showLegend?: boolean;
  showArea?: boolean;
  smooth?: boolean;
  colors?: string[];
  formatValue?: (value: number) => string;
  formatDate?: (date: string) => string;
  onPointClick?: (data: TimeSeriesPoint, seriesName: string) => void;
  className?: string;
}

const DEFAULT_COLORS = [
  '#3B82F6', // blue
  '#10B981', // green
  '#F59E0B', // amber
  '#EF4444', // red
  '#8B5CF6', // purple
];

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string; dataKey: string }>;
  label?: string;
  formatValue?: (value: number) => string;
  formatDate?: (date: string) => string;
}

function CustomTooltip({ active, payload, label, formatValue, formatDate }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  
  const formattedLabel = formatDate ? formatDate(label || '') : label;
  
  return (
    <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200">
      <p className="font-semibold text-gray-900 mb-2">{formattedLabel}</p>
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

export function LineChart({
  data,
  height = 300,
  showGrid = true,
  showLegend = true,
  showArea = false,
  smooth = true,
  colors = DEFAULT_COLORS,
  formatValue,
  formatDate,
  // onPointClick - reserved for future use when recharts supports typed click handlers
  className = '',
}: LineChartProps) {
  // Transform data for recharts
  const allDates = new Set<string>();
  data.series.forEach(s => {
    s.data.forEach(point => allDates.add(point.date));
  });
  
  const sortedDates = Array.from(allDates).sort();
  
  const chartData = sortedDates.map(date => {
    const point: { date: string; [key: string]: unknown } = { date };
    data.series.forEach(s => {
      const dataPoint = s.data.find(d => d.date === date);
      point[s.name] = dataPoint?.value ?? null;
    });
    return point;
  });

  const ChartComponent = showArea ? ComposedChart : RechartsLineChart;

  return (
    <div className={`w-full ${className}`} data-testid="line-chart">
      <ResponsiveContainer width="100%" height={height}>
        <ChartComponent
          data={chartData}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />}
          
          <XAxis 
            dataKey="date" 
            tickFormatter={formatDate || defaultDateFormat}
            tick={{ fontSize: 12 }}
          />
          <YAxis 
            tickFormatter={formatValue}
            tick={{ fontSize: 12 }}
          />
          
          <Tooltip 
            content={<CustomTooltip formatValue={formatValue} formatDate={formatDate} />} 
          />
          
          {showLegend && data.series.length > 1 && (
            <Legend />
          )}
          
          {data.series.map((series, index) => {
            const color = series.color || colors[index % colors.length];
            
            if (showArea) {
              return (
                <Area
                  key={series.name}
                  type={smooth ? 'monotone' : 'linear'}
                  dataKey={series.name}
                  name={series.name}
                  stroke={color}
                  fill={color}
                  fillOpacity={0.1}
                  strokeWidth={2}
                  dot={{ r: 4, fill: color }}
                  activeDot={{ r: 6 }}
                />
              );
            }
            
            return (
              <Line
                key={series.name}
                type={smooth ? 'monotone' : 'linear'}
                dataKey={series.name}
                name={series.name}
                stroke={color}
                strokeWidth={2}
                dot={{ r: 4, fill: color }}
                activeDot={{ r: 6 }}
              />
            );
          })}
        </ChartComponent>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Trend Line Chart
 * Simplified version for showing single metric trends
 */
export function TrendLineChart({
  data,
  height = 150,
  color = '#3B82F6',
  showArea = true,
  className = '',
}: {
  data: TimeSeriesPoint[];
  height?: number;
  color?: string;
  showArea?: boolean;
  className?: string;
}) {
  return (
    <LineChart
      data={{ series: [{ name: 'Value', data, color }] }}
      height={height}
      showGrid={false}
      showLegend={false}
      showArea={showArea}
      className={className}
    />
  );
}

/**
 * Pipeline Trend Chart
 * Pre-configured for pipeline value trends
 */
export function PipelineTrendChart({
  data,
  height = 300,
  className = '',
}: {
  data: Array<{ date: string; totalValue: number; newDeals: number; closedWon: number; closedLost: number }>;
  height?: number;
  className?: string;
}) {
  const chartData: LineChartData = {
    series: [
      {
        name: 'Pipeline Value',
        data: data.map(d => ({ date: d.date, value: d.totalValue })),
        color: '#3B82F6',
      },
      {
        name: 'New Deals',
        data: data.map(d => ({ date: d.date, value: d.newDeals })),
        color: '#10B981',
      },
      {
        name: 'Closed Won',
        data: data.map(d => ({ date: d.date, value: d.closedWon })),
        color: '#F59E0B',
      },
    ],
  };

  return (
    <LineChart
      data={chartData}
      height={height}
      showArea
      formatValue={(v) => `$${(v / 1000).toFixed(0)}k`}
      className={className}
    />
  );
}

function defaultDateFormat(date: string): string {
  try {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return date;
  }
}

export default LineChart;
