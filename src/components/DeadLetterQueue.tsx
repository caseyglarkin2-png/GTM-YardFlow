/**
 * DeadLetterQueue Component
 * 
 * Sprint 95: T95.6 - Dead Letter Queue UI
 * 
 * Shows failed emails with retry capability.
 */

import { useDeadLetterQueue } from '@/hooks/useDeadLetterQueue';
import {
  AlertCircle,
  RefreshCw,
  RotateCcw,
  Trash2,
  Mail,
  Clock,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useState } from 'react';

interface DeadLetterQueueProps {
  /** Show as collapsed panel initially */
  collapsed?: boolean;
  /** Maximum items to show before "Show more" */
  maxVisible?: number;
  /** Custom class name */
  className?: string;
}

export function DeadLetterQueue({
  collapsed = false,
  maxVisible = 5,
  className = '',
}: DeadLetterQueueProps) {
  const {
    failedEmails,
    isLoading,
    isRetrying,
    retryEmail,
    retryAll,
    discardEmail,
    refresh,
  } = useDeadLetterQueue();

  const [isExpanded, setIsExpanded] = useState(!collapsed);
  const [showAll, setShowAll] = useState(false);

  // No failed emails - show success state
  if (failedEmails.length === 0 && !isLoading) {
    return (
      <div className={`p-4 bg-green-50 rounded-lg border border-green-100 ${className}`}>
        <div className="flex items-center gap-2 text-green-700">
          <Mail className="w-4 h-4" />
          <span className="text-sm font-medium">No failed emails</span>
        </div>
        <p className="text-xs text-green-600 mt-1">
          All emails are being delivered successfully.
        </p>
      </div>
    );
  }

  const visibleEmails = showAll ? failedEmails : failedEmails.slice(0, maxVisible);
  const hasMore = failedEmails.length > maxVisible;

  return (
    <div className={`rounded-lg border border-red-100 overflow-hidden ${className}`}>
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-3 bg-red-50 hover:bg-red-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-600" />
          <span className="text-sm font-medium text-red-700">
            Failed Emails ({failedEmails.length})
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isExpanded && failedEmails.length > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                retryAll();
              }}
              disabled={isRetrying}
              className="text-xs px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {isRetrying ? 'Retrying...' : 'Retry All'}
            </button>
          )}
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-red-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-red-400" />
          )}
        </div>
      </button>

      {/* Email list */}
      {isExpanded && (
        <div className="divide-y divide-red-100">
          {isLoading ? (
            <div className="p-4 text-center text-sm text-slate-500">
              <RefreshCw className="w-4 h-4 animate-spin inline mr-2" />
              Loading failed emails...
            </div>
          ) : (
            <>
              {visibleEmails.map((email) => (
                <div
                  key={email.id}
                  className="p-3 bg-white hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      {/* Subject */}
                      <div className="font-medium text-sm text-slate-800 truncate">
                        {String(email.data?.subject || 'No subject')}
                      </div>

                      {/* Recipient */}
                      <div className="text-xs text-slate-600 truncate">
                        To: {String(email.data?.to || email.data?.prospectEmail || 'Unknown')}
                      </div>

                      {/* Error message */}
                      <div className="text-xs text-red-600 mt-1 flex items-start gap-1">
                        <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                        <span className="line-clamp-2">
                          {email.failedReason || 'Unknown error'}
                        </span>
                      </div>

                      {/* Timestamp */}
                      <div className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Failed {formatTimeAgo(email.timestamp)}
                        {email.attemptsMade > 1 && (
                          <span className="ml-1">
                            • {email.attemptsMade} attempts
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => retryEmail(email.id)}
                        disabled={isRetrying}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors disabled:opacity-50"
                        title="Retry sending"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => discardEmail(email.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Discard"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {/* Show more / Show less */}
              {hasMore && (
                <button
                  onClick={() => setShowAll(!showAll)}
                  className="w-full p-2 text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  {showAll
                    ? `Show less`
                    : `Show ${failedEmails.length - maxVisible} more`}
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* Refresh footer */}
      {isExpanded && (
        <div className="p-2 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>Updates every minute</span>
          <button
            onClick={() => refresh()}
            disabled={isLoading}
            className="flex items-center gap-1 hover:text-slate-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Format timestamp as relative time
 */
function formatTimeAgo(timestamp: string | Date | number): string {
  const date = typeof timestamp === 'string' ? new Date(timestamp) : new Date(timestamp);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export default DeadLetterQueue;
