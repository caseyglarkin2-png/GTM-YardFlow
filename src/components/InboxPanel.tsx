/**
 * InboxPanel Component
 * Sprint 201: Reply Inbox Feature
 * 
 * Displays prospects that have replied to emails and need a response.
 * Provides actions to mark replies as handled.
 */

import { useState } from 'react';
import { 
  Inbox, 
  CheckCircle, 
  Clock, 
  User, 
  Building2, 
  Mail,
  RefreshCw,
  CheckCheck,
  MessageSquare,
  AlertCircle,
  ExternalLink
} from 'lucide-react';
import { useInboxReplies, type InboxReply } from '@/hooks/useInboxReplies';

interface InboxPanelProps {
  onProspectClick?: (prospectId: string) => void;
  onClose?: () => void;
}

/**
 * Format relative time for display
 */
function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

/**
 * Get reply type badge styling
 */
function getReplyTypeBadge(type: InboxReply['lastReplyType']): { label: string; className: string } {
  switch (type) {
    case 'human_reply':
      return { label: 'Reply', className: 'bg-green-100 text-green-700' };
    case 'out_of_office':
      return { label: 'OOO', className: 'bg-amber-100 text-amber-700' };
    case 'unsubscribe':
      return { label: 'Unsub', className: 'bg-red-100 text-red-700' };
    case 'bounce':
      return { label: 'Bounce', className: 'bg-slate-100 text-slate-700' };
    default:
      return { label: 'Reply', className: 'bg-slate-100 text-slate-700' };
  }
}

export function InboxPanel({ onProspectClick, onClose: _onClose }: InboxPanelProps) {
  const { 
    replies, 
    unhandledCount, 
    isLoading, 
    error, 
    markAsHandled, 
    markAllAsHandled, 
    refresh 
  } = useInboxReplies();

  const [handlingId, setHandlingId] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);

  const handleMarkAsHandled = async (prospectId: string) => {
    setHandlingId(prospectId);
    await markAsHandled(prospectId);
    setHandlingId(null);
  };

  const handleMarkAllAsHandled = async () => {
    setMarkingAll(true);
    await markAllAsHandled();
    setMarkingAll(false);
  };

  // Loading state
  if (isLoading && replies.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <Inbox className="h-5 w-5 text-blue-600" />
            Reply Inbox
          </h3>
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="animate-pulse">
              <div className="h-4 bg-slate-200 rounded w-1/3 mb-2" />
              <div className="h-3 bg-slate-100 rounded w-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <Inbox className="h-5 w-5 text-blue-600" />
            Reply Inbox
          </h3>
        </div>
        <div className="text-center py-6">
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
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm" data-testid="inbox-panel">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
              <Inbox className="h-5 w-5 text-blue-600" />
              Reply Inbox
            </h3>
            {unhandledCount > 0 && (
              <span className="inline-flex items-center justify-center px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">
                {unhandledCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={refresh}
              disabled={isLoading}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
              title="Refresh"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            {replies.length > 0 && (
              <button
                onClick={handleMarkAllAsHandled}
                disabled={markingAll}
                className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1 disabled:opacity-50"
              >
                <CheckCheck className="h-4 w-4" />
                {markingAll ? 'Marking...' : 'Mark all handled'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Empty state */}
      {replies.length === 0 && (
        <div className="text-center py-12 px-6">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="h-8 w-8 text-green-500" />
          </div>
          <h4 className="text-lg font-medium text-slate-800 mb-1">All caught up!</h4>
          <p className="text-slate-500 text-sm">No replies need your attention right now.</p>
        </div>
      )}

      {/* Reply list */}
      {replies.length > 0 && (
        <ul className="divide-y divide-slate-100" role="list" aria-label="Replies needing response">
          {replies.map((reply) => {
            const badge = getReplyTypeBadge(reply.lastReplyType);
            const isHandling = handlingId === reply.prospectId;

            return (
              <li 
                key={reply.id} 
                className="px-6 py-4 hover:bg-slate-50 transition-colors"
                data-testid={`inbox-reply-${reply.id}`}
              >
                <div className="flex items-start justify-between gap-4">
                  {/* Reply info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <button
                        onClick={() => onProspectClick?.(reply.prospectId)}
                        className="font-medium text-slate-800 hover:text-blue-600 truncate flex items-center gap-1"
                      >
                        <User className="h-4 w-4 text-slate-400" />
                        {reply.prospectName}
                        <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100" />
                      </button>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${badge.className}`}>
                        {badge.label}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-3 text-sm text-slate-500">
                      <span className="flex items-center gap-1 truncate">
                        <Mail className="h-3.5 w-3.5" />
                        {reply.prospectEmail}
                      </span>
                      <span className="flex items-center gap-1">
                        <Building2 className="h-3.5 w-3.5" />
                        {reply.company}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-1 text-xs text-slate-400 mt-1">
                      <Clock className="h-3 w-3" />
                      {formatRelativeTime(reply.lastReplyAt)}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleMarkAsHandled(reply.prospectId)}
                      disabled={isHandling}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-lg transition-colors disabled:opacity-50"
                      title="Mark as handled"
                    >
                      <CheckCircle className="h-4 w-4" />
                      {isHandling ? 'Marking...' : 'Handled'}
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Footer with summary */}
      {replies.length > 0 && (
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 text-sm text-slate-500">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            {unhandledCount} {unhandledCount === 1 ? 'reply' : 'replies'} awaiting response
          </div>
        </div>
      )}
    </div>
  );
}

export default InboxPanel;
