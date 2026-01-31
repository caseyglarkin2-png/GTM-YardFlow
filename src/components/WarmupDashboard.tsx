/**
 * WarmupDashboard Component
 * 
 * Sprint 2: T2.4 - Domain Warmup Status Dashboard
 * 
 * Displays email domain warmup progress:
 * - Daily send limits with warmup progression
 * - Sent today vs limit with visual progress bar
 * - Warmup period day indicator
 * - Health status with color indicators
 */

import { useState, useEffect, useCallback } from 'react';
import { Flame, TrendingUp, Calendar, Mail, AlertTriangle, CheckCircle, Pause, RefreshCw } from 'lucide-react';

// ============================================
// Types
// ============================================

interface WarmupState {
  /** Warmup start timestamp */
  startedAt: number;
  /** Is warmup currently paused */
  paused: boolean;
  /** Reason for pause if applicable */
  pauseReason?: string;
  /** Last send timestamp */
  lastSentAt?: number;
  /** Current day in warmup period (1-based) */
  currentDay: number;
  /** Current week in warmup period */
  currentWeek: number;
  /** Daily limit for today */
  dailyLimit: number;
  /** Number of emails sent today */
  sentToday: number;
  /** Max limit after warmup complete */
  maxLimit: number;
  /** Is warmup complete */
  warmupComplete: boolean;
}

interface WarmupDashboardProps {
  /** Tenant ID for multi-tenant support */
  tenantId?: string;
  /** Compact mode for smaller displays */
  compact?: boolean;
  /** Custom class name */
  className?: string;
}

// ============================================
// Warmup Logic Helpers
// ============================================

const WARMUP_SCHEDULE = [
  { week: 1, limit: 50 },
  { week: 2, limit: 100 },
  { week: 3, limit: 250 },
  { week: 4, limit: 500 },
];

function getProgressPercentage(sent: number, limit: number): number {
  if (!Number.isFinite(limit)) return 0;
  return Math.min(100, (sent / limit) * 100);
}

type StatusLevel = 'healthy' | 'warning' | 'critical' | 'paused';

function getStatusLevel(state: WarmupState): StatusLevel {
  if (state.paused) return 'paused';
  if (state.warmupComplete) return 'healthy';
  
  const percentage = getProgressPercentage(state.sentToday, state.dailyLimit);
  if (percentage >= 100) return 'critical';
  if (percentage >= 80) return 'warning';
  return 'healthy';
}

const statusColors: Record<StatusLevel, { bg: string; text: string; progress: string }> = {
  healthy: { bg: 'bg-green-50', text: 'text-green-700', progress: 'bg-green-500' },
  warning: { bg: 'bg-yellow-50', text: 'text-yellow-700', progress: 'bg-yellow-500' },
  critical: { bg: 'bg-red-50', text: 'text-red-700', progress: 'bg-red-500' },
  paused: { bg: 'bg-slate-50', text: 'text-slate-700', progress: 'bg-slate-400' },
};

const statusIcons: Record<StatusLevel, typeof CheckCircle> = {
  healthy: CheckCircle,
  warning: AlertTriangle,
  critical: AlertTriangle,
  paused: Pause,
};

// ============================================
// Hook for Warmup Data
// ============================================

function useWarmupData(tenantId?: string) {
  const [state, setState] = useState<WarmupState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Fetch from real API endpoint
      const url = tenantId 
        ? `/api/warmup/status?tenantId=${encodeURIComponent(tenantId)}`
        : '/api/warmup/status';
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch warmup status: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Transform API response to WarmupState
      const warmupState: WarmupState = {
        startedAt: data.startedAt,
        paused: data.paused || false,
        pauseReason: data.pauseReason,
        currentDay: data.currentDay,
        currentWeek: data.currentWeek,
        dailyLimit: data.dailyLimit === -1 ? Number.POSITIVE_INFINITY : data.dailyLimit,
        sentToday: data.sentToday,
        maxLimit: data.maxLimit,
        warmupComplete: data.warmupComplete || data.bypassed,
      };
      
      setState(warmupState);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load warmup status');
    } finally {
      setIsLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    fetchData();
    
    // Refresh every 60 seconds
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [fetchData]);

  return { state, isLoading, error, refresh: fetchData };
}

// ============================================
// Component
// ============================================

export function WarmupDashboard({
  tenantId,
  compact = false,
  className = '',
}: WarmupDashboardProps) {
  const { state, isLoading, error, refresh } = useWarmupData(tenantId);

  if (isLoading && !state) {
    return (
      <div className={`animate-pulse ${className}`}>
        <div className="h-32 bg-slate-100 rounded-lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={`p-4 bg-red-50 rounded-lg text-red-700 ${className}`}>
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          <span className="text-sm">{error}</span>
        </div>
      </div>
    );
  }

  if (!state) return null;

  const status = getStatusLevel(state);
  const colors = statusColors[status];
  const StatusIcon = statusIcons[status];
  const progressPct = getProgressPercentage(state.sentToday, state.dailyLimit);
  const remaining = Math.max(0, state.dailyLimit - state.sentToday);

  // Compact view
  if (compact) {
    return (
      <div className={`flex items-center gap-3 ${className}`}>
        <div className={`w-2 h-2 rounded-full ${colors.progress}`} />
        <div className="flex items-center gap-2 text-sm">
          <Flame className="w-4 h-4 text-orange-500" />
          <span className="text-slate-600">
            {state.warmupComplete ? (
              'Warmup complete'
            ) : (
              <>
                Day {state.currentDay} · {state.sentToday}/{state.dailyLimit} sent
              </>
            )}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-lg border border-slate-200 overflow-hidden ${className}`}>
      {/* Header */}
      <div className={`px-4 py-3 ${colors.bg} border-b border-slate-200`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-orange-500" />
            <h3 className="font-semibold text-slate-900">Domain Warmup</h3>
          </div>
          <div className="flex items-center gap-2">
            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${colors.bg} ${colors.text}`}>
              <StatusIcon className="w-3.5 h-3.5" />
              {status === 'paused' && 'Paused'}
              {status === 'critical' && 'At Limit'}
              {status === 'warning' && 'Near Limit'}
              {status === 'healthy' && (state.warmupComplete ? 'Complete' : 'On Track')}
            </div>
            <button
              onClick={refresh}
              disabled={isLoading}
              className="p-1 text-slate-400 hover:text-slate-600 rounded transition-colors disabled:opacity-50"
              title="Refresh warmup status"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="p-4 bg-white">
        {/* Progress section */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Mail className="w-4 h-4 text-slate-400" />
              <span>Sent Today</span>
            </div>
            <span className="text-sm font-medium">
              {state.sentToday}
              <span className="text-slate-400">
                /{Number.isFinite(state.dailyLimit) ? state.dailyLimit : '∞'}
              </span>
            </span>
          </div>
          
          {/* Progress bar */}
          <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full ${colors.progress} transition-all duration-500 rounded-full`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
          
          {/* Remaining */}
          {!state.warmupComplete && Number.isFinite(state.dailyLimit) && (
            <p className={`text-xs mt-1.5 ${colors.text}`}>
              {remaining > 0 ? (
                <>
                  {remaining} email{remaining !== 1 ? 's' : ''} remaining today
                </>
              ) : (
                'Daily limit reached - sending resumes tomorrow'
              )}
            </p>
          )}
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3">
          {/* Warmup Day */}
          <div className="p-3 bg-slate-50 rounded-lg">
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
              <Calendar className="w-3.5 h-3.5" />
              Warmup Progress
            </div>
            {state.warmupComplete ? (
              <p className="text-lg font-semibold text-green-600">Complete</p>
            ) : (
              <p className="text-lg font-semibold text-slate-900">
                Day {state.currentDay}
                <span className="text-sm font-normal text-slate-500"> / Week {state.currentWeek}</span>
              </p>
            )}
          </div>

          {/* Daily Limit */}
          <div className="p-3 bg-slate-50 rounded-lg">
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
              <TrendingUp className="w-3.5 h-3.5" />
              Current Limit
            </div>
            <p className="text-lg font-semibold text-slate-900">
              {Number.isFinite(state.dailyLimit) ? (
                <>
                  {state.dailyLimit}
                  <span className="text-sm font-normal text-slate-500">/day</span>
                </>
              ) : (
                'Unlimited'
              )}
            </p>
          </div>
        </div>

        {/* Warmup schedule preview */}
        {!state.warmupComplete && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <p className="text-xs text-slate-500 mb-2">Warmup Schedule</p>
            <div className="flex items-center gap-1">
              {WARMUP_SCHEDULE.map((week, idx) => {
                const isActive = state.currentWeek === week.week;
                const isPast = state.currentWeek > week.week;
                
                return (
                  <div key={week.week} className="flex items-center">
                    <div
                      className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                        isActive
                          ? 'bg-blue-100 text-blue-700 ring-1 ring-blue-300'
                          : isPast
                          ? 'bg-green-100 text-green-700'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                      title={`Week ${week.week}: ${week.limit} emails/day`}
                    >
                      W{week.week}: {week.limit}
                    </div>
                    {idx < WARMUP_SCHEDULE.length - 1 && (
                      <div className={`w-4 h-0.5 ${isPast ? 'bg-green-300' : 'bg-slate-200'}`} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Pause reason */}
        {state.paused && state.pauseReason && (
          <div className="mt-4 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
            <div className="flex items-start gap-2">
              <Pause className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-yellow-800">Warmup Paused</p>
                <p className="text-xs text-yellow-700 mt-0.5">
                  {state.pauseReason === 'health'
                    ? 'Paused due to high bounce or spam rate. Please review your email list quality.'
                    : state.pauseReason}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Compact badge for navigation/header usage
 */
export function WarmupBadge({ className = '' }: { className?: string }) {
  const { state } = useWarmupData();
  
  if (!state) return null;
  if (state.warmupComplete) return null;
  
  const status = getStatusLevel(state);
  const colors = statusColors[status];
  const progressPct = getProgressPercentage(state.sentToday, state.dailyLimit);
  
  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <Flame className="w-3.5 h-3.5 text-orange-500" />
      <span className="text-xs text-slate-600">D{state.currentDay}</span>
      <div className="w-12 h-1.5 bg-slate-200 rounded-full overflow-hidden">
        <div
          className={`h-full ${colors.progress} rounded-full`}
          style={{ width: `${progressPct}%` }}
        />
      </div>
    </div>
  );
}

export default WarmupDashboard;
