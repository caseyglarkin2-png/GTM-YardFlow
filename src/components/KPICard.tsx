/**
 * KPICard Component
 * Sprint 28B - T28B.3
 * 
 * Displays a single KPI metric with trend indicator.
 */

import type { KPIMetric, KPIValue } from '../types/analytics';

export interface KPICardProps {
  metric: KPIMetric;
  onClick?: () => void;
  className?: string;
}

function formatValue(value: number, format: KPIMetric['format']): string {
  switch (format) {
    case 'currency':
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(value);
    case 'percent':
      return `${value.toFixed(1)}%`;
    case 'duration':
      if (value < 1) return `${Math.round(value * 60)}m`;
      if (value < 24) return `${value.toFixed(1)}h`;
      return `${Math.round(value / 24)}d`;
    default:
      return value.toLocaleString();
  }
}

function getTrendIcon(trend: KPIValue['trend']) {
  switch (trend) {
    case 'up':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
        </svg>
      );
    case 'down':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        </svg>
      );
    default:
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14" />
        </svg>
      );
  }
}

function getTrendColor(trend: KPIValue['trend'], isPositiveGood: boolean = true) {
  const isPositiveTrend = trend === 'up';
  const isGood = isPositiveGood ? isPositiveTrend : !isPositiveTrend;
  
  if (trend === 'flat') return 'text-gray-500 bg-gray-100';
  return isGood ? 'text-green-600 bg-green-100' : 'text-red-600 bg-red-100';
}

export function KPICard({
  metric,
  onClick,
  className = '',
}: KPICardProps) {
  const { name, value, format, icon, color } = metric;
  const isClickable = !!onClick;
  
  // Determine if positive change is good (for most metrics, yes)
  const isPositiveGood = !name.toLowerCase().includes('cost') && 
                         !name.toLowerCase().includes('churn') &&
                         !name.toLowerCase().includes('time');

  return (
    <div
      className={`
        bg-white rounded-xl border border-gray-200 p-5 shadow-sm
        ${isClickable ? 'cursor-pointer hover:shadow-md hover:border-gray-300 transition-all' : ''}
        ${className}
      `}
      onClick={onClick}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={isClickable ? (e) => e.key === 'Enter' && onClick?.() : undefined}
      data-testid="kpi-card"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          {icon && (
            <span 
              className="text-lg"
              style={{ color: color }}
              data-testid="kpi-icon"
            >
              {icon}
            </span>
          )}
          <h3 className="text-sm font-medium text-gray-600" data-testid="kpi-name">
            {name}
          </h3>
        </div>
        
        {/* Trend Badge */}
        <div 
          className={`
            flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium
            ${getTrendColor(value.trend, isPositiveGood)}
          `}
          data-testid="kpi-trend"
        >
          {getTrendIcon(value.trend)}
          <span>{Math.abs(value.changePercent).toFixed(1)}%</span>
        </div>
      </div>

      {/* Current Value */}
      <div className="mb-2">
        <p 
          className="text-2xl font-bold text-gray-900"
          data-testid="kpi-value"
        >
          {formatValue(value.current, format)}
        </p>
      </div>

      {/* Comparison */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <span>vs</span>
        <span data-testid="kpi-previous">{formatValue(value.previous, format)}</span>
        <span className="text-gray-400">•</span>
        <span 
          className={value.change >= 0 ? 'text-green-600' : 'text-red-600'}
          data-testid="kpi-change"
        >
          {value.change >= 0 ? '+' : ''}{formatValue(Math.abs(value.change), format)}
        </span>
      </div>
    </div>
  );
}

// =============================================================================
// KPI Grid Component
// =============================================================================

export interface KPIGridProps {
  metrics: KPIMetric[];
  columns?: 2 | 3 | 4;
  onMetricClick?: (metric: KPIMetric) => void;
  className?: string;
}

export function KPIGrid({
  metrics,
  columns = 4,
  onMetricClick,
  className = '',
}: KPIGridProps) {
  const gridCols = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
  };

  return (
    <div 
      className={`grid gap-4 ${gridCols[columns]} ${className}`}
      data-testid="kpi-grid"
    >
      {metrics.map((metric) => (
        <KPICard
          key={metric.id}
          metric={metric}
          onClick={onMetricClick ? () => onMetricClick(metric) : undefined}
        />
      ))}
    </div>
  );
}
