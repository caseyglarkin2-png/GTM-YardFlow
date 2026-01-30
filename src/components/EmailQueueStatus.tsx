/**
 * EmailQueueStatus Component
 * 
 * Sprint 95: T95.5 - Email Queue Status UI
 * 
 * Visual indicator showing email queue health:
 * - Pending count
 * - Processing rate
 * - Health status (healthy/degraded/critical)
 */

import { useEmailQueueHealth } from '@/hooks/useEmailQueueHealth';
import { RefreshCw, AlertCircle, Clock, Mail } from 'lucide-react';

interface EmailQueueStatusProps {
  /** Compact mode for toolbar/header usage */
  compact?: boolean;
  /** Show refresh button */
  showRefresh?: boolean;
  /** Custom class name */
  className?: string;
}

const healthColors = {
  healthy: 'bg-green-500',
  degraded: 'bg-yellow-500',
  critical: 'bg-red-500',
  unknown: 'bg-slate-400',
} as const;

const healthLabels = {
  healthy: 'Healthy',
  degraded: 'Slow',
  critical: 'Issues',
  unknown: 'Unknown',
} as const;

export function EmailQueueStatus({
  compact = false,
  showRefresh = true,
  className = '',
}: EmailQueueStatusProps) {
  const { data, isLoading, refresh } = useEmailQueueHealth({
    pollInterval: 30000, // Every 30 seconds
    autoStart: true,
  });

  if (compact) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div
          className={`w-2 h-2 rounded-full ${healthColors[data.health]}`}
          title={`Queue: ${healthLabels[data.health]}`}
        />
        <span className="text-xs text-slate-600">
          {data.pending > 0 ? `${data.pending} pending` : 'Queue idle'}
        </span>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-3 p-3 bg-slate-50 rounded-lg ${className}`}>
      {/* Health indicator */}
      <div
        className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${healthColors[data.health]}`}
        title={`Queue status: ${healthLabels[data.health]}`}
      />

      {/* Stats */}
      <div className="flex-1 text-sm">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Pending count */}
          <div className="flex items-center gap-1" title="Emails waiting to be sent">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-medium">{data.pending}</span>
            <span className="text-slate-500">pending</span>
          </div>

          <span className="text-slate-300">•</span>

          {/* Sent today */}
          <div className="flex items-center gap-1" title="Emails sent today (UTC)">
            <Mail className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-medium">{data.sentToday}</span>
            <span className="text-slate-500">sent today</span>
          </div>

          {/* Failed count (only if > 0) */}
          {data.failed > 0 && (
            <>
              <span className="text-slate-300">•</span>
              <div
                className="flex items-center gap-1 text-red-600"
                title="Emails that failed to send"
              >
                <AlertCircle className="w-3.5 h-3.5" />
                <span className="font-medium">{data.failed}</span>
                <span>failed</span>
              </div>
            </>
          )}
        </div>

        {/* Processing rate (if available) */}
        {data.processingRate > 0 && (
          <div className="text-xs text-slate-500 mt-1">
            Processing ~{Math.round(data.processingRate)} emails/min
          </div>
        )}

        {/* Warning for old jobs */}
        {data.oldestJobAgeSeconds && data.oldestJobAgeSeconds > 60 && (
          <div className="text-xs text-yellow-600 mt-1 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            Oldest job: {Math.round(data.oldestJobAgeSeconds / 60)}min old
          </div>
        )}

        {/* Error message */}
        {data.error && (
          <div className="text-xs text-red-600 mt-1 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            {data.error}
          </div>
        )}
      </div>

      {/* Refresh button */}
      {showRefresh && (
        <button
          onClick={() => refresh()}
          disabled={isLoading}
          className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors disabled:opacity-50"
          title="Refresh queue status"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      )}
    </div>
  );
}

/**
 * Minimal badge version for use in navigation
 */
export function EmailQueueBadge() {
  const { data } = useEmailQueueHealth({
    pollInterval: 30000,
    autoStart: true,
  });

  // Don't show anything if healthy and no pending
  if (data.health === 'healthy' && data.pending === 0 && data.failed === 0) {
    return null;
  }

  // Show warning badge if degraded/critical or has failures
  if (data.health === 'critical' || data.failed > 0) {
    return (
      <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-medium text-white bg-red-500 rounded-full">
        {data.failed || '!'}
      </span>
    );
  }

  if (data.health === 'degraded') {
    return (
      <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-medium text-white bg-yellow-500 rounded-full">
        {data.pending > 99 ? '99+' : data.pending}
      </span>
    );
  }

  // Show pending count badge
  if (data.pending > 0) {
    return (
      <span className="inline-flex items-center justify-center min-w-5 h-5 px-1 text-xs font-medium text-slate-700 bg-slate-200 rounded-full">
        {data.pending}
      </span>
    );
  }

  return null;
}

export default EmailQueueStatus;
