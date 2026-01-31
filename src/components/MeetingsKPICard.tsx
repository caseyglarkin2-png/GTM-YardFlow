/**
 * MeetingsKPICard Component
 * 
 * Sprint 1: T1.4 - Meetings KPI Dashboard Widget
 * 
 * Displays the North Star metric: meetings booked this week.
 * Shows trend vs last week and breakdown by sequence.
 */

import { useState, useEffect } from 'react';
import { Calendar, TrendingUp, TrendingDown, Minus, Users, Target } from 'lucide-react';
import { getMeetingStats, type MeetingStats } from '../services/MeetingAttributionService';

interface MeetingsKPICardProps {
  /** Refresh interval in milliseconds (default: 60000 = 1 min) */
  refreshInterval?: number;
  /** Show sequence breakdown */
  showBreakdown?: boolean;
  /** Custom class name */
  className?: string;
  /** On click handler for drill-down */
  onClick?: () => void;
}

export function MeetingsKPICard({
  refreshInterval = 60000,
  showBreakdown = true,
  className = '',
  onClick,
}: MeetingsKPICardProps) {
  const [stats, setStats] = useState<MeetingStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function fetchStats() {
      try {
        const data = await getMeetingStats();
        if (mounted) {
          setStats(data);
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          setError('Failed to load meeting stats');
          console.error('Error loading meeting stats:', err);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    fetchStats();

    // Set up refresh interval
    const interval = setInterval(fetchStats, refreshInterval);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [refreshInterval]);

  // Loading state
  if (isLoading) {
    return (
      <div className={`bg-white rounded-xl border border-gray-200 p-5 shadow-sm ${className}`}>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-32 mb-3" />
          <div className="h-8 bg-gray-200 rounded w-16 mb-2" />
          <div className="h-3 bg-gray-200 rounded w-24" />
        </div>
      </div>
    );
  }

  // Error state
  if (error || !stats) {
    return (
      <div className={`bg-white rounded-xl border border-red-200 p-5 shadow-sm ${className}`}>
        <div className="flex items-center gap-2 text-red-600">
          <Calendar className="w-5 h-5" />
          <span className="text-sm font-medium">{error || 'Unable to load stats'}</span>
        </div>
      </div>
    );
  }

  // Determine trend direction
  const getTrendInfo = () => {
    if (stats.weekOverWeekChange > 0) {
      return {
        icon: TrendingUp,
        color: 'text-green-600 bg-green-100',
        label: `+${stats.weekOverWeekChange}%`,
      };
    } else if (stats.weekOverWeekChange < 0) {
      return {
        icon: TrendingDown,
        color: 'text-red-600 bg-red-100',
        label: `${stats.weekOverWeekChange}%`,
      };
    }
    return {
      icon: Minus,
      color: 'text-gray-500 bg-gray-100',
      label: 'No change',
    };
  };

  const trend = getTrendInfo();
  const TrendIcon = trend.icon;

  // Get top sequences
  const topSequences = Object.entries(stats.bySequence)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);

  return (
    <div
      className={`
        bg-white rounded-xl border border-gray-200 p-5 shadow-sm
        ${onClick ? 'cursor-pointer hover:shadow-md hover:border-blue-300 transition-all' : ''}
        ${className}
      `}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
      data-testid="meetings-kpi-card"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-blue-100">
            <Target className="w-5 h-5 text-blue-600" />
          </div>
          <span className="text-sm font-medium text-gray-600">Meetings Booked</span>
        </div>
        
        {/* Trend Badge */}
        <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${trend.color}`}>
          <TrendIcon className="w-3 h-3" />
          <span>{trend.label}</span>
        </div>
      </div>

      {/* Main Metric - This Week */}
      <div className="mb-4">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold text-gray-900">{stats.thisWeek}</span>
          <span className="text-sm text-gray-500">this week</span>
        </div>
        <p className="text-xs text-gray-400 mt-1">
          vs {stats.lastWeek} last week • {stats.thisMonth} this month
        </p>
      </div>

      {/* Sequence Breakdown */}
      {showBreakdown && topSequences.length > 0 && (
        <div className="border-t border-gray-100 pt-3 mt-3">
          <div className="flex items-center gap-1 text-xs text-gray-500 mb-2">
            <Users className="w-3 h-3" />
            <span>Top sequences</span>
          </div>
          <div className="space-y-1.5">
            {topSequences.map(([name, count]) => (
              <div key={name} className="flex items-center justify-between text-xs">
                <span className="text-gray-600 truncate max-w-[70%]">{name}</span>
                <span className="font-medium text-gray-900">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Total all-time */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
        <span className="text-xs text-gray-500">All time</span>
        <span className="text-sm font-semibold text-gray-700">{stats.total} meetings</span>
      </div>
    </div>
  );
}
