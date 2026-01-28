/**
 * Funnel Chart Component
 * Sprint 28 - T28.2
 * 
 * Displays conversion funnel with stages and rates.
 */

import {
  FunnelChart as RechartsFunnel,
  Funnel,
  Cell,
  LabelList,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { FunnelStage } from '../../types/analytics';

export interface FunnelChartProps {
  data: FunnelStage[];
  height?: number;
  showLabels?: boolean;
  showConversionRates?: boolean;
  onStageClick?: (stage: FunnelStage) => void;
  className?: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: FunnelStage }>;
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  
  const data = payload[0].payload;
  
  return (
    <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200">
      <p className="font-semibold text-gray-900">{data.name}</p>
      <div className="mt-1 space-y-1 text-sm">
        <p className="text-gray-600">
          <span className="font-medium">{data.count}</span> prospects
        </p>
        <p className="text-gray-600">
          <span className="font-medium">${data.value.toLocaleString()}</span> value
        </p>
        {data.conversionRate > 0 && (
          <p className="text-gray-600">
            <span className="font-medium">{data.conversionRate}%</span> conversion
          </p>
        )}
        <p className="text-gray-500">
          Avg {data.avgTimeInStage} days in stage
        </p>
      </div>
    </div>
  );
}

export function FunnelChart({
  data,
  height = 300,
  showLabels = true,
  showConversionRates = true,
  onStageClick,
  className = '',
}: FunnelChartProps) {
  // Transform data for recharts
  const chartData = data.map(stage => ({
    ...stage,
    value: stage.count, // Recharts uses 'value' for funnel size
    fill: stage.color,
  }));

  return (
    <div className={`w-full ${className}`} data-testid="funnel-chart">
      <ResponsiveContainer width="100%" height={height}>
        <RechartsFunnel>
          <Tooltip content={<CustomTooltip />} />
          <Funnel
            dataKey="value"
            data={chartData}
            isAnimationActive
            onClick={(entry) => onStageClick?.(entry as unknown as FunnelStage)}
          >
            {chartData.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={entry.fill}
                className="cursor-pointer hover:opacity-80 transition-opacity"
              />
            ))}
            {showLabels && (
              <LabelList
                position="center"
                fill="#fff"
                stroke="none"
                dataKey="name"
                style={{ fontSize: 12, fontWeight: 500 }}
              />
            )}
          </Funnel>
        </RechartsFunnel>
      </ResponsiveContainer>
      
      {showConversionRates && (
        <div className="mt-4 flex justify-center gap-4 flex-wrap">
          {data.slice(0, -1).map((stage, index) => (
            <div 
              key={stage.id} 
              className="flex items-center gap-2 text-sm"
            >
              <span 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: stage.color }}
              />
              <span className="text-gray-600">
                {stage.name} → {data[index + 1]?.name}: 
                <span className="font-medium ml-1">{stage.conversionRate}%</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Horizontal Funnel Chart
 * Alternative layout for wider displays
 */
export function HorizontalFunnelChart({
  data,
  className = '',
}: Omit<FunnelChartProps, 'showLabels' | 'showConversionRates'>) {
  const maxCount = Math.max(...data.map(s => s.count));

  return (
    <div className={`space-y-3 ${className}`} data-testid="horizontal-funnel">
      {data.map((stage, index) => {
        const width = maxCount > 0 ? (stage.count / maxCount) * 100 : 0;
        
        return (
          <div key={stage.id} className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="font-medium text-gray-900">{stage.name}</span>
              <span className="text-gray-600">
                {stage.count} ({stage.conversionRate > 0 ? `${stage.conversionRate}%` : '-'})
              </span>
            </div>
            <div className="h-8 bg-gray-100 rounded-lg overflow-hidden">
              <div
                className="h-full rounded-lg transition-all duration-500"
                style={{ 
                  width: `${width}%`,
                  backgroundColor: stage.color,
                }}
              />
            </div>
            {index < data.length - 1 && (
              <div className="flex justify-center">
                <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default FunnelChart;
