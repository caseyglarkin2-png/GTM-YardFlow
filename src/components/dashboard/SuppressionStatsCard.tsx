/**
 * SuppressionStatsCard Component
 * 
 * Sprint 39E.3: Dashboard card showing suppression list statistics
 * 
 * Displays:
 * - Total suppressed count
 * - Breakdown by reason (bounce, spam, unsubscribe)
 * - Visual bar chart of proportions
 * - Last sync timestamp
 */

import { useState, useEffect, useCallback } from 'react';
import { LazyIcon } from '@/components/icons';

export interface SuppressionStats {
  total: number;
  byReason: {
    bounce: number;
    spam: number;
    unsubscribe: number;
    manual: number;
  };
  lastSyncAt: number | null;
}

interface SuppressionStatsCardProps {
  /** Custom class name */
  className?: string;
  /** Compact mode */
  compact?: boolean;
}

/**
 * Fetch suppression stats from the API
 */
async function fetchSuppressionStats(): Promise<SuppressionStats> {
  const res = await fetch('/api/email/reputation?period=30d');
  if (!res.ok) {
    throw new Error(`Failed to fetch suppression stats: ${res.status}`);
  }
  const data = await res.json();
  
  // Extract suppression-related metrics from reputation data
  return {
    total: (data.metrics?.bounced ?? 0) + (data.metrics?.spam ?? 0) + (data.metrics?.unsubscribed ?? 0),
    byReason: {
      bounce: data.metrics?.bounced ?? 0,
      spam: data.metrics?.spam ?? 0,
      unsubscribe: data.metrics?.unsubscribed ?? 0,
      manual: 0, // Manual suppressions tracked separately
    },
    lastSyncAt: data.lastSyncAt ?? null,
  };
}

function ReasonBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const percent = total > 0 ? Math.round((count / total) * 100) : 0;
  
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-24 text-slate-600 truncate">{label}</span>
      <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${percent}%` }}
          data-testid={`reason-bar-${label.toLowerCase()}`}
        />
      </div>
      <span className="w-10 text-right text-slate-500 tabular-nums">{count}</span>
    </div>
  );
}

export function SuppressionStatsCard({ className = '', compact = false }: SuppressionStatsCardProps) {
  const [stats, setStats] = useState<SuppressionStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await fetchSuppressionStats();
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  if (isLoading) {
    return (
      <div className={`bg-white rounded-lg border border-slate-200 p-4 animate-pulse ${className}`}>
        <div className="h-4 bg-slate-200 rounded w-40 mb-3" />
        <div className="h-8 bg-slate-200 rounded w-20 mb-3" />
        <div className="space-y-2">
          <div className="h-3 bg-slate-200 rounded" />
          <div className="h-3 bg-slate-200 rounded" />
          <div className="h-3 bg-slate-200 rounded" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-white rounded-lg border border-red-200 p-4 ${className}`}>
        <div className="flex items-center gap-2 text-red-600 text-sm">
          <LazyIcon name="AlertCircle" className="h-4 w-4" />
          <span>Failed to load suppression stats</span>
        </div>
        <button
          onClick={loadStats}
          className="mt-2 text-xs text-blue-600 hover:text-blue-700 underline"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!stats) return null;

  const { byReason, total, lastSyncAt } = stats;

  if (compact) {
    return (
      <div className={`bg-white rounded-lg border border-slate-200 p-3 ${className}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LazyIcon name="ShieldOff" className="h-4 w-4 text-slate-400" />
            <span className="text-sm font-medium text-slate-700">Suppressed</span>
          </div>
          <span className="text-lg font-semibold text-slate-900 tabular-nums">{total}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg border border-slate-200 p-4 ${className}`} data-testid="suppression-stats-card">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <LazyIcon name="ShieldOff" className="h-5 w-5 text-slate-500" />
          <h3 className="text-sm font-semibold text-slate-700">Suppression List</h3>
        </div>
        <button
          onClick={loadStats}
          className="text-slate-400 hover:text-slate-600 transition-colors"
          title="Refresh"
        >
          <LazyIcon name="RefreshCw" className="h-4 w-4" />
        </button>
      </div>

      <div className="mb-4">
        <span className="text-2xl font-bold text-slate-900 tabular-nums">{total}</span>
        <span className="text-sm text-slate-500 ml-1">emails suppressed</span>
      </div>

      <div className="space-y-2">
        <ReasonBar label="Bounced" count={byReason.bounce} total={total} color="bg-red-400" />
        <ReasonBar label="Spam" count={byReason.spam} total={total} color="bg-orange-400" />
        <ReasonBar label="Unsubscribed" count={byReason.unsubscribe} total={total} color="bg-yellow-400" />
        {byReason.manual > 0 && (
          <ReasonBar label="Manual" count={byReason.manual} total={total} color="bg-slate-400" />
        )}
      </div>

      {lastSyncAt && (
        <div className="mt-3 pt-3 border-t border-slate-100">
          <span className="text-xs text-slate-400">
            Last sync: {new Date(lastSyncAt).toLocaleString()}
          </span>
        </div>
      )}
    </div>
  );
}
