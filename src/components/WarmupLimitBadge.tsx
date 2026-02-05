/**
 * WarmupLimitBadge - Sprint 38F
 * 
 * Displays current email warmup status and remaining daily quota.
 * Shows warning when approaching limits.
 */

import React from 'react';
import { useWarmupStatus } from '../hooks/useWarmupStatus';

interface WarmupLimitBadgeProps {
  /** Number of emails about to be sent */
  pendingSendCount?: number;
  /** Compact mode for inline display */
  compact?: boolean;
  /** Additional CSS classes */
  className?: string;
}

export function WarmupLimitBadge({ 
  pendingSendCount = 0, 
  compact = false,
  className = '' 
}: WarmupLimitBadgeProps) {
  const { status, isLoading, error } = useWarmupStatus({ autoRefresh: false });

  if (isLoading) {
    return (
      <span className={`text-xs text-slate-400 ${className}`}>
        Loading limits...
      </span>
    );
  }

  if (error || !status) {
    return null; // Fail silently, don't block sending
  }

  // Check if pending send would exceed limit
  const wouldExceed = !status.isBypassed && 
    (status.sentToday + pendingSendCount) > status.dailyLimit;
  const remaining = status.remaining;
  const usagePercent = status.usagePercent;

  // Determine badge color
  const getColorClass = () => {
    if (status.isBypassed) return 'bg-green-100 text-green-700 border-green-200';
    if (wouldExceed) return 'bg-red-100 text-red-700 border-red-200';
    if (usagePercent >= 80) return 'bg-amber-100 text-amber-700 border-amber-200';
    if (usagePercent >= 50) return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    return 'bg-slate-100 text-slate-600 border-slate-200';
  };

  if (compact) {
    return (
      <span 
        className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded border ${getColorClass()} ${className}`}
        title={status.message}
      >
        {status.isBypassed ? '∞' : `${remaining}/${status.dailyLimit}`}
      </span>
    );
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span 
        className={`inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full border ${getColorClass()}`}
      >
        {status.isBypassed ? (
          'Unlimited sending'
        ) : (
          <>
            Week {status.week}: {remaining}/{status.dailyLimit} remaining
          </>
        )}
      </span>
      
      {wouldExceed && !status.isBypassed && (
        <span className="text-xs text-red-600 font-medium">
          ⚠️ Sending {pendingSendCount} would exceed daily limit
        </span>
      )}
      
      {!status.isBypassed && usagePercent >= 80 && !wouldExceed && (
        <span className="text-xs text-amber-600">
          Approaching daily limit
        </span>
      )}
    </div>
  );
}

export default WarmupLimitBadge;
