/**
 * DomainHealthCard Component
 * 
 * Sprint 39B.4: Dashboard card showing SPF/DKIM/DMARC status
 * 
 * Features:
 * - Visual status indicators for each DNS record type
 * - Overall domain health score
 * - Actionable recommendations
 * - Refresh capability
 */

import { useState } from 'react';
import { LazyIcon } from '@/components/icons';
import { useDomainHealth, type RecordStatus } from '@/hooks/useDomainHealth';

/** Props for the DomainHealthCard component */
export interface DomainHealthCardProps {
  /** Email domain to check (e.g., "example.com") */
  domain: string;
  /** Optional DKIM selector (default: auto-detect) */
  dkimSelector?: string;
  /** Show compact version suitable for sidebars */
  compact?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/** Map record status to icon name */
const STATUS_ICONS: Record<RecordStatus, string> = {
  valid: 'CheckCircle',
  warning: 'AlertCircle',
  invalid: 'XCircle',
  missing: 'MinusCircle',
  unknown: 'HelpCircle',
};

/** Map record status to background colors */
const STATUS_BG_COLORS: Record<RecordStatus, string> = {
  valid: 'bg-green-50 dark:bg-green-900/20',
  warning: 'bg-yellow-50 dark:bg-yellow-900/20',
  invalid: 'bg-red-50 dark:bg-red-900/20',
  missing: 'bg-slate-100 dark:bg-slate-800/40',
  unknown: 'bg-slate-100 dark:bg-slate-800/40',
};

/** Map record type to display name */
const RECORD_NAMES: Record<string, string> = {
  spf: 'SPF',
  dkim: 'DKIM',
  dmarc: 'DMARC',
};

/** Status badge component */
function StatusBadge({ status, label }: { status: RecordStatus; label: string }) {
  const iconName = STATUS_ICONS[status];
  const bgColor = STATUS_BG_COLORS[status];
  
  // Determine text color based on status
  const textColor = 
    status === 'valid' ? 'text-green-700 dark:text-green-400' :
    status === 'warning' ? 'text-yellow-700 dark:text-yellow-400' :
    status === 'invalid' ? 'text-red-700 dark:text-red-400' :
    'text-slate-600 dark:text-slate-400';

  return (
    <span 
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${bgColor} ${textColor}`}
      title={`${label}: ${status}`}
    >
      <LazyIcon name={iconName} className="h-3 w-3" />
      {label}
    </span>
  );
}

/** Score display component */
function ScoreDisplay({ score, isHealthy }: { score: number; isHealthy: boolean }) {
  const scoreColor = 
    score >= 80 ? 'text-green-600 dark:text-green-400' :
    score >= 50 ? 'text-yellow-600 dark:text-yellow-400' :
    'text-red-600 dark:text-red-400';

  const bgColor = 
    score >= 80 ? 'bg-green-100 dark:bg-green-900/30' :
    score >= 50 ? 'bg-yellow-100 dark:bg-yellow-900/30' :
    'bg-red-100 dark:bg-red-900/30';

  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${bgColor}`}>
      <div className={`text-2xl font-bold ${scoreColor}`}>{score}</div>
      <div className="text-xs text-slate-600 dark:text-slate-400">
        <div className="font-medium">Domain Score</div>
        <div className={isHealthy ? 'text-green-600' : 'text-red-600'}>
          {isHealthy ? 'Healthy' : 'Issues Found'}
        </div>
      </div>
    </div>
  );
}

/** DNS Record row component */
function RecordRow({ 
  type, 
  status, 
  message, 
  value, 
  details,
  getStatusColor 
}: { 
  type: string;
  status: RecordStatus;
  message: string;
  value?: string;
  details?: string[];
  getStatusColor: (status: RecordStatus) => string;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasDetails = value || (details && details.length > 0);

  return (
    <div className="border-b border-slate-100 dark:border-slate-700 last:border-0">
      <div 
        className={`flex items-center justify-between py-3 ${hasDetails ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50' : ''}`}
        onClick={() => hasDetails && setExpanded(!expanded)}
        onKeyDown={(e) => {
          if (hasDetails && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            setExpanded(!expanded);
          }
        }}
        tabIndex={hasDetails ? 0 : -1}
        role={hasDetails ? 'button' : undefined}
        aria-expanded={hasDetails ? expanded : undefined}
      >
        <div className="flex items-center gap-3">
          <LazyIcon 
            name={STATUS_ICONS[status]} 
            className={`h-5 w-5 ${getStatusColor(status)}`} 
          />
          <div>
            <div className="font-medium text-slate-900 dark:text-slate-100">
              {RECORD_NAMES[type] || type}
            </div>
            <div className="text-sm text-slate-600 dark:text-slate-400">
              {message}
            </div>
          </div>
        </div>
        {hasDetails && (
          <LazyIcon 
            name={expanded ? 'ChevronUp' : 'ChevronDown'} 
            className="h-4 w-4 text-slate-400" 
          />
        )}
      </div>
      
      {expanded && hasDetails && (
        <div className="pb-3 pl-8 space-y-2">
          {value && (
            <div className="text-xs font-mono bg-slate-100 dark:bg-slate-800 p-2 rounded overflow-x-auto">
              {value}
            </div>
          )}
          {details && details.length > 0 && (
            <ul className="text-sm text-slate-600 dark:text-slate-400 list-disc pl-4 space-y-1">
              {details.map((detail, idx) => (
                <li key={idx}>{detail}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/** Main DomainHealthCard component */
export function DomainHealthCard({
  domain,
  dkimSelector,
  compact = false,
  className = '',
}: DomainHealthCardProps) {
  const {
    data,
    isLoading,
    error,
    refresh,
    getStatusColor,
    isFullyConfigured,
  } = useDomainHealth({
    domain,
    dkimSelector,
    enabled: Boolean(domain),
  });

  // Loading state
  if (isLoading) {
    return (
      <div className={`bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-4 ${className}`}>
        <div className="flex items-center gap-3 text-slate-500">
          <div className="animate-spin rounded-full h-5 w-5 border-2 border-slate-300 border-t-blue-600" />
          <span>Checking domain authentication...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={`bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-red-200 dark:border-red-800 p-4 ${className}`}>
        <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
          <LazyIcon name="AlertTriangle" className="h-5 w-5" />
          <div>
            <div className="font-medium">Domain Check Failed</div>
            <div className="text-sm text-red-500">{error}</div>
          </div>
        </div>
        <button
          onClick={() => refresh()}
          className="mt-3 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400"
        >
          Try again
        </button>
      </div>
    );
  }

  // No domain specified
  if (!domain) {
    return (
      <div className={`bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-4 ${className}`}>
        <div className="text-slate-500 text-center">
          <LazyIcon name="Globe" className="h-8 w-8 mx-auto mb-2 text-slate-300" />
          <p>Enter a domain to check authentication status</p>
        </div>
      </div>
    );
  }

  // No data yet
  if (!data) {
    return null;
  }

  // Compact view for sidebars
  if (compact) {
    return (
      <div className={`bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-4 ${className}`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <LazyIcon name="Shield" className="h-4 w-4 text-slate-400" />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {domain}
            </span>
          </div>
          <span className={`text-lg font-bold ${getStatusColor(data.score >= 80 ? 'valid' : data.score >= 50 ? 'warning' : 'invalid')}`}>
            {data.score}
          </span>
        </div>
        <div className="flex gap-2 flex-wrap">
          <StatusBadge status={data.records.spf.status} label="SPF" />
          <StatusBadge status={data.records.dkim.status} label="DKIM" />
          <StatusBadge status={data.records.dmarc.status} label="DMARC" />
        </div>
      </div>
    );
  }

  // Full view
  return (
    <div className={`bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg">
            <LazyIcon name="Shield" className="h-5 w-5 text-slate-600 dark:text-slate-400" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-slate-100">
              Domain Authentication
            </h3>
            <p className="text-sm text-slate-500">{domain}</p>
          </div>
        </div>
        <button
          onClick={() => refresh(true)}
          className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          title="Refresh"
        >
          <LazyIcon name="RefreshCw" className="h-4 w-4 text-slate-500" />
        </button>
      </div>

      {/* Score and Status */}
      <div className="p-4 flex items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-700">
        <ScoreDisplay score={data.score} isHealthy={data.isHealthy} />
        <div className="flex gap-2 flex-wrap">
          <StatusBadge status={data.records.spf.status} label="SPF" />
          <StatusBadge status={data.records.dkim.status} label="DKIM" />
          <StatusBadge status={data.records.dmarc.status} label="DMARC" />
        </div>
      </div>

      {/* Record Details */}
      <div className="p-4">
        <RecordRow 
          type="spf" 
          status={data.records.spf.status}
          message={data.records.spf.message}
          value={data.records.spf.value}
          details={data.records.spf.details}
          getStatusColor={getStatusColor}
        />
        <RecordRow 
          type="dkim" 
          status={data.records.dkim.status}
          message={data.records.dkim.message}
          value={data.records.dkim.value}
          details={data.records.dkim.details}
          getStatusColor={getStatusColor}
        />
        <RecordRow 
          type="dmarc" 
          status={data.records.dmarc.status}
          message={data.records.dmarc.message}
          value={data.records.dmarc.value}
          details={data.records.dmarc.details}
          getStatusColor={getStatusColor}
        />
      </div>

      {/* Recommendations */}
      {data.recommendations.length > 0 && !isFullyConfigured && (
        <div className="px-4 pb-4">
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400 text-sm font-medium mb-2">
              <LazyIcon name="Lightbulb" className="h-4 w-4" />
              Recommendations
            </div>
            <ul className="text-sm text-blue-600 dark:text-blue-300 space-y-1">
              {data.recommendations.slice(0, 3).map((rec, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-blue-400 mt-1">•</span>
                  {rec}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Success message when fully configured */}
      {isFullyConfigured && (
        <div className="px-4 pb-4">
          <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg flex items-center gap-2">
            <LazyIcon name="CheckCircle" className="h-5 w-5 text-green-600 dark:text-green-400" />
            <span className="text-sm text-green-700 dark:text-green-300 font-medium">
              Domain authentication is fully configured
            </span>
          </div>
        </div>
      )}

      {/* Last checked timestamp */}
      {data.lastChecked && (
        <div className="px-4 pb-3 text-xs text-slate-400">
          Last checked: {new Date(data.lastChecked).toLocaleString()}
        </div>
      )}
    </div>
  );
}

export default DomainHealthCard;
