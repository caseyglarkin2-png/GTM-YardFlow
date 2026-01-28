/**
 * Sync Status Component
 * Sprint 27 - T27.7
 * 
 * Visual indicator for offline queue and sync status.
 */

import type { SyncStatus as SyncStatusType } from '../services/OfflineQueue';

export interface SyncStatusProps {
  status: SyncStatusType;
  pendingCount: number;
  onRetry?: () => void;
  showDetails?: boolean;
  className?: string;
}

/**
 * Sync Status Badge
 * Shows current sync state with pending operation count
 */
export function SyncStatus({
  status,
  pendingCount,
  onRetry,
  showDetails = true,
  className = '',
}: SyncStatusProps) {
  const config = getStatusConfig(status);

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${config.bgColor} ${config.textColor} ${className}`}
      role="status"
      aria-live="polite"
      data-testid="sync-status"
    >
      {/* Status Icon */}
      <span className={`w-2 h-2 rounded-full ${config.dotColor} ${status === 'syncing' ? 'animate-pulse' : ''}`} />

      {/* Status Text */}
      <span>{config.label}</span>

      {/* Pending Count */}
      {showDetails && pendingCount > 0 && status !== 'synced' && (
        <span className="text-xs opacity-75">
          ({pendingCount} pending)
        </span>
      )}

      {/* Retry Button */}
      {status === 'error' && onRetry && (
        <button
          onClick={onRetry}
          className="ml-1 p-0.5 rounded hover:bg-white/20 transition-colors"
          aria-label="Retry sync"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      )}
    </div>
  );
}

/**
 * Sync Indicator
 * Minimal dot indicator for compact spaces
 */
export function SyncIndicator({
  status,
  className = '',
}: {
  status: SyncStatusType;
  className?: string;
}) {
  const config = getStatusConfig(status);

  return (
    <span
      className={`inline-block w-2.5 h-2.5 rounded-full ${config.dotColor} ${
        status === 'syncing' ? 'animate-pulse' : ''
      } ${className}`}
      role="status"
      aria-label={config.label}
      title={config.label}
      data-testid="sync-indicator"
    />
  );
}

/**
 * Offline Banner
 * Full-width banner for prominent offline notification
 */
export function OfflineBanner({
  pendingCount = 0,
  onDismiss,
  className = '',
}: {
  pendingCount?: number;
  onDismiss?: () => void;
  className?: string;
}) {
  return (
    <div
      className={`w-full bg-amber-500 text-white px-4 py-2 flex items-center justify-between ${className}`}
      role="alert"
      data-testid="offline-banner"
    >
      <div className="flex items-center gap-3">
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414" />
        </svg>
        <span className="font-medium">You're offline</span>
        {pendingCount > 0 && (
          <span className="text-sm opacity-90">
            {pendingCount} change{pendingCount !== 1 ? 's' : ''} will sync when you reconnect
          </span>
        )}
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="p-1 rounded hover:bg-white/20 transition-colors"
          aria-label="Dismiss"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}

/**
 * Syncing Toast
 * Temporary notification during sync
 */
export function SyncingToast({
  processed = 0,
  total = 0,
  className = '',
}: {
  processed?: number;
  total?: number;
  className?: string;
}) {
  const percentage = total > 0 ? Math.round((processed / total) * 100) : 0;

  return (
    <div
      className={`bg-blue-600 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 ${className}`}
      role="status"
      data-testid="syncing-toast"
    >
      <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
      </svg>
      <div>
        <p className="font-medium">Syncing changes...</p>
        {total > 0 && (
          <p className="text-sm opacity-90">
            {processed} of {total} ({percentage}%)
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Pending Changes Card
 * Detailed view of pending operations
 */
export interface PendingOperation {
  id: string;
  type: 'create' | 'update' | 'remove';
  collection: string;
  docId: string;
  createdAt: string;
  attempts: number;
  lastError?: string;
}

export function PendingChangesCard({
  operations,
  onClear,
  onRetryAll,
  className = '',
}: {
  operations: PendingOperation[];
  onClear?: () => void;
  onRetryAll?: () => void;
  className?: string;
}) {
  if (operations.length === 0) {
    return null;
  }

  return (
    <div className={`bg-white rounded-lg border border-gray-200 shadow-sm ${className}`}>
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <h3 className="font-medium text-gray-900">
          Pending Changes ({operations.length})
        </h3>
        <div className="flex gap-2">
          {onRetryAll && (
            <button
              onClick={onRetryAll}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Retry All
            </button>
          )}
          {onClear && (
            <button
              onClick={onClear}
              className="text-sm text-gray-500 hover:text-gray-600 font-medium"
            >
              Clear
            </button>
          )}
        </div>
      </div>
      <ul className="divide-y divide-gray-100 max-h-60 overflow-y-auto" data-testid="pending-list">
        {operations.map((op) => (
          <li key={op.id} className="px-4 py-2 flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <span className={`w-1.5 h-1.5 rounded-full ${getOperationColor(op.type)}`} />
              <span className="text-gray-600">{op.type}</span>
              <span className="text-gray-400">•</span>
              <span className="text-gray-900">{op.collection}</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              {op.attempts > 0 && (
                <span className="text-amber-600">
                  {op.attempts} attempt{op.attempts !== 1 ? 's' : ''}
                </span>
              )}
              <span className="text-gray-400">
                {formatTimeAgo(new Date(op.createdAt))}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ==========================================================================
// Helpers
// ==========================================================================

interface StatusConfig {
  label: string;
  bgColor: string;
  textColor: string;
  dotColor: string;
}

function getStatusConfig(status: SyncStatusType): StatusConfig {
  switch (status) {
    case 'synced':
      return {
        label: 'Synced',
        bgColor: 'bg-green-50',
        textColor: 'text-green-700',
        dotColor: 'bg-green-500',
      };
    case 'syncing':
      return {
        label: 'Syncing',
        bgColor: 'bg-blue-50',
        textColor: 'text-blue-700',
        dotColor: 'bg-blue-500',
      };
    case 'pending':
      return {
        label: 'Pending',
        bgColor: 'bg-amber-50',
        textColor: 'text-amber-700',
        dotColor: 'bg-amber-500',
      };
    case 'offline':
      return {
        label: 'Offline',
        bgColor: 'bg-gray-100',
        textColor: 'text-gray-600',
        dotColor: 'bg-gray-400',
      };
    case 'error':
      return {
        label: 'Error',
        bgColor: 'bg-red-50',
        textColor: 'text-red-700',
        dotColor: 'bg-red-500',
      };
  }
}

function getOperationColor(type: 'create' | 'update' | 'remove'): string {
  switch (type) {
    case 'create':
      return 'bg-green-500';
    case 'update':
      return 'bg-blue-500';
    case 'remove':
      return 'bg-red-500';
  }
}

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export default SyncStatus;
