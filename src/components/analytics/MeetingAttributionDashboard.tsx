/**
 * MeetingAttributionDashboard Component
 * Sprint 204: Meeting Attribution Dashboard
 * 
 * Displays meeting analytics showing which sequences and templates
 * are driving the most meetings.
 */

import { useState } from 'react';
import {
  Calendar,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Mail,
  Layers,
  RefreshCw,
  AlertCircle,
  ArrowUp,
  ArrowDown,
  Minus,
} from 'lucide-react';
import { useMeetingStats, useMeetingKPIs } from '@/hooks/useMeetingStats';

// =============================================================================
// Types
// =============================================================================

interface DateRange {
  label: string;
  days: number;
}

const DATE_RANGES: DateRange[] = [
  { label: '7 Days', days: 7 },
  { label: '30 Days', days: 30 },
  { label: '90 Days', days: 90 },
];

// =============================================================================
// Sub-components
// =============================================================================

function KPICard({
  title,
  value,
  subtitle,
  trend,
  icon: Icon,
}: {
  title: string;
  value: number | string;
  subtitle?: string;
  trend?: 'up' | 'down' | 'flat';
  icon?: React.ElementType;
}) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-slate-500">{title}</span>
        {Icon && <Icon className="h-4 w-4 text-slate-400" />}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold text-slate-800">{value}</span>
        {trend && trend !== 'flat' && (
          <span className={`flex items-center text-sm ${
            trend === 'up' ? 'text-green-600' : 'text-red-600'
          }`}>
            {trend === 'up' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
          </span>
        )}
      </div>
      {subtitle && (
        <p className="text-xs text-slate-400 mt-1">{subtitle}</p>
      )}
    </div>
  );
}

function BarChartSimple({
  data,
  title,
  emptyMessage,
}: {
  data: { name: string; count: number }[];
  title: string;
  emptyMessage: string;
}) {
  const maxCount = Math.max(...data.map(d => d.count), 1);

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4">
      <h4 className="text-sm font-medium text-slate-700 mb-4">{title}</h4>
      {data.length === 0 ? (
        <div className="text-center py-8 text-slate-400 text-sm">
          {emptyMessage}
        </div>
      ) : (
        <div className="space-y-3">
          {data.slice(0, 5).map((item, index) => (
            <div key={item.name + index}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-slate-600 truncate max-w-[70%]">
                  {item.name}
                </span>
                <span className="text-sm font-medium text-slate-800">
                  {item.count}
                </span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-300"
                  style={{ width: `${(item.count / maxCount) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function MeetingAttributionDashboard() {
  const [dateRange, setDateRange] = useState<DateRange>(DATE_RANGES[1]); // Default 30 days

  const startDate = new Date(Date.now() - dateRange.days * 24 * 60 * 60 * 1000);
  const endDate = new Date();

  const { analytics, isLoading, error, refresh } = useMeetingStats({
    startDate,
    endDate,
  });

  const kpis = useMeetingKPIs({ startDate, endDate });

  // Loading state
  if (isLoading && !analytics) {
    return (
      <div className="space-y-6" data-testid="meeting-dashboard">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-800 flex items-center gap-2">
            <Calendar className="h-5 w-5 text-blue-600" />
            Meeting Attribution
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-lg border border-slate-200 p-4 animate-pulse">
              <div className="h-4 bg-slate-200 rounded w-1/2 mb-2" />
              <div className="h-6 bg-slate-100 rounded w-1/3" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="space-y-6" data-testid="meeting-dashboard">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-800 flex items-center gap-2">
            <Calendar className="h-5 w-5 text-blue-600" />
            Meeting Attribution
          </h2>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-8 text-center">
          <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-2" />
          <p className="text-slate-500 mb-3">{error.message}</p>
          <button
            onClick={refresh}
            className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1 mx-auto"
          >
            <RefreshCw className="h-4 w-4" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="meeting-dashboard">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-800 flex items-center gap-2">
          <Calendar className="h-5 w-5 text-blue-600" />
          Meeting Attribution
        </h2>
        <div className="flex items-center gap-3">
          {/* Date range selector */}
          <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
            {DATE_RANGES.map((range) => (
              <button
                key={range.days}
                onClick={() => setDateRange(range)}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${
                  dateRange.days === range.days
                    ? 'bg-white text-slate-800 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {range.label}
              </button>
            ))}
          </div>
          <button
            onClick={refresh}
            disabled={isLoading}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPICard
          title="Total Meetings"
          value={analytics?.total || 0}
          subtitle={`Last ${dateRange.days} days`}
          icon={Calendar}
        />
        <KPICard
          title="This Week"
          value={analytics?.thisWeek || 0}
          subtitle={`vs ${analytics?.lastWeek || 0} last week`}
          trend={kpis.trend}
          icon={kpis.trend === 'up' ? TrendingUp : kpis.trend === 'down' ? TrendingDown : Minus}
        />
        <KPICard
          title="Top Sequence"
          value={kpis.topSequence?.name || 'None'}
          subtitle={kpis.topSequence ? `${kpis.topSequence.count} meetings` : 'No data'}
          icon={Layers}
        />
        <KPICard
          title="Top Template"
          value={kpis.topTemplate?.name || 'None'}
          subtitle={kpis.topTemplate ? `${kpis.topTemplate.count} meetings` : 'No data'}
          icon={Mail}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <BarChartSimple
          title="Meetings by Sequence"
          data={analytics?.bySequence || []}
          emptyMessage="No sequence attribution data"
        />
        <BarChartSimple
          title="Meetings by Template"
          data={analytics?.byTemplate || []}
          emptyMessage="No template attribution data"
        />
      </div>

      {/* Weekly Trend */}
      {analytics && analytics.percentChange !== 0 && (
        <div className={`rounded-lg p-4 ${
          analytics.percentChange > 0 
            ? 'bg-green-50 border border-green-200' 
            : 'bg-red-50 border border-red-200'
        }`}>
          <div className="flex items-center gap-2">
            {analytics.percentChange > 0 ? (
              <TrendingUp className="h-5 w-5 text-green-600" />
            ) : (
              <TrendingDown className="h-5 w-5 text-red-600" />
            )}
            <span className={`font-medium ${
              analytics.percentChange > 0 ? 'text-green-700' : 'text-red-700'
            }`}>
              {Math.abs(analytics.percentChange)}% {analytics.percentChange > 0 ? 'increase' : 'decrease'}
            </span>
            <span className="text-slate-500">
              compared to last week
            </span>
          </div>
        </div>
      )}

      {/* Empty state */}
      {analytics && analytics.total === 0 && (
        <div className="bg-slate-50 rounded-lg p-8 text-center">
          <BarChart3 className="h-12 w-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-slate-700 mb-1">No meetings yet</h3>
          <p className="text-slate-500 text-sm">
            Meetings will appear here once prospects book through your outreach
          </p>
        </div>
      )}
    </div>
  );
}

export default MeetingAttributionDashboard;
