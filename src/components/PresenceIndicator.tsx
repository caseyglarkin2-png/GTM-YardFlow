/**
 * Presence Indicator Component
 * Sprint 27 - T27.5
 * 
 * Shows user presence status with avatar stack.
 */

import { useState, useEffect } from 'react';
import type { UserPresence, PresenceStatus, PresenceService } from '../services/PresenceService';

export interface PresenceIndicatorProps {
  presenceService: PresenceService | null;
  maxAvatars?: number;
  showCount?: boolean;
  size?: 'sm' | 'md' | 'lg';
  filterView?: string;
  filterDocId?: string;
  className?: string;
  'data-testid'?: string;
}

const SIZE_CLASSES = {
  sm: 'h-6 w-6 text-xs',
  md: 'h-8 w-8 text-sm',
  lg: 'h-10 w-10 text-base',
};

const STATUS_COLORS: Record<PresenceStatus, string> = {
  online: 'bg-green-500',
  idle: 'bg-yellow-500',
  offline: 'bg-gray-400',
};

/**
 * Avatar component for a single user
 */
function UserAvatar({
  user,
  size,
  showStatus = true,
}: {
  user: UserPresence;
  size: 'sm' | 'md' | 'lg';
  showStatus?: boolean;
}) {
  const sizeClass = SIZE_CLASSES[size];
  const initials = user.displayName
    .split(' ')
    .map(n => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="relative" title={`${user.displayName} (${user.status})`}>
      {user.avatarUrl ? (
        <img
          src={user.avatarUrl}
          alt={user.displayName}
          className={`${sizeClass} rounded-full border-2 border-white object-cover`}
        />
      ) : (
        <div
          className={`${sizeClass} rounded-full border-2 border-white bg-indigo-500 flex items-center justify-center text-white font-medium`}
        >
          {initials}
        </div>
      )}
      {showStatus && (
        <span
          className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white ${STATUS_COLORS[user.status]}`}
        />
      )}
    </div>
  );
}

/**
 * Overflow count indicator
 */
function OverflowCount({ count, size }: { count: number; size: 'sm' | 'md' | 'lg' }) {
  const sizeClass = SIZE_CLASSES[size];
  
  return (
    <div
      className={`${sizeClass} rounded-full border-2 border-white bg-gray-200 flex items-center justify-center text-gray-600 font-medium`}
    >
      +{count}
    </div>
  );
}

/**
 * Main Presence Indicator component
 */
export function PresenceIndicator({
  presenceService,
  maxAvatars = 4,
  showCount = true,
  size = 'md',
  filterView,
  filterDocId,
  className = '',
  'data-testid': dataTestId,
}: PresenceIndicatorProps) {
  const [users, setUsers] = useState<UserPresence[]>([]);

  useEffect(() => {
    if (!presenceService) return;

    const unsubscribe = presenceService.subscribe((allUsers) => {
      let filtered = allUsers.filter(u => u.status !== 'offline');
      
      // Apply filters
      if (filterDocId) {
        filtered = filtered.filter(u => u.viewingDocId === filterDocId);
      } else if (filterView) {
        filtered = filtered.filter(u => u.currentView === filterView);
      }
      
      setUsers(filtered);
    });

    return unsubscribe;
  }, [presenceService, filterView, filterDocId]);

  if (!presenceService || users.length === 0) {
    return null;
  }

  const visibleUsers = users.slice(0, maxAvatars);
  const overflowCount = users.length - maxAvatars;

  return (
    <div className={`flex items-center ${className}`} data-testid={dataTestId}>
      <div className="flex -space-x-2">
        {visibleUsers.map(user => (
          <UserAvatar key={user.userId} user={user} size={size} />
        ))}
        {overflowCount > 0 && <OverflowCount count={overflowCount} size={size} />}
      </div>
      
      {showCount && (
        <span className="ml-2 text-sm text-gray-600">
          {users.length} {users.length === 1 ? 'user' : 'users'} active
        </span>
      )}
    </div>
  );
}

/**
 * Status badge component
 */
export function PresenceStatusBadge({
  status,
  showLabel = true,
}: {
  status: PresenceStatus;
  showLabel?: boolean;
}) {
  const labels: Record<PresenceStatus, string> = {
    online: 'Online',
    idle: 'Away',
    offline: 'Offline',
  };

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-2 w-2 rounded-full ${STATUS_COLORS[status]}`} />
      {showLabel && <span className="text-sm text-gray-600">{labels[status]}</span>}
    </span>
  );
}

/**
 * "Who's viewing" panel for document collaboration
 */
export function WhosViewing({
  presenceService,
  docId,
  title = "Who's viewing",
  className = '',
}: {
  presenceService: PresenceService | null;
  docId: string;
  title?: string;
  className?: string;
}) {
  const [users, setUsers] = useState<UserPresence[]>([]);

  useEffect(() => {
    if (!presenceService) return;

    const unsubscribe = presenceService.subscribe(() => {
      setUsers(presenceService.getUsersViewingDoc(docId));
    });

    return unsubscribe;
  }, [presenceService, docId]);

  if (!presenceService || users.length === 0) {
    return null;
  }

  return (
    <div className={`bg-white rounded-lg border p-3 ${className}`}>
      <h4 className="text-sm font-medium text-gray-700 mb-2">{title}</h4>
      <div className="space-y-2">
        {users.map(user => (
          <div key={user.userId} className="flex items-center gap-2">
            <UserAvatar user={user} size="sm" />
            <span className="text-sm text-gray-600">{user.displayName}</span>
            <PresenceStatusBadge status={user.status} showLabel={false} />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Connection status indicator
 */
export function ConnectionStatus({
  presenceService,
  className = '',
}: {
  presenceService: PresenceService | null;
  className?: string;
}) {
  const [status, setStatus] = useState<PresenceStatus>('offline');

  useEffect(() => {
    if (!presenceService) return;

    const checkStatus = () => {
      setStatus(presenceService.getMyStatus());
    };

    checkStatus();
    const interval = setInterval(checkStatus, 5000);

    return () => clearInterval(interval);
  }, [presenceService]);

  const statusConfig: Record<PresenceStatus, { label: string; color: string }> = {
    online: { label: 'Connected', color: 'text-green-600' },
    idle: { label: 'Away', color: 'text-yellow-600' },
    offline: { label: 'Disconnected', color: 'text-gray-500' },
  };

  const { label, color } = statusConfig[status];

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <span className={`h-2 w-2 rounded-full ${STATUS_COLORS[status]}`} />
      <span className={`text-xs ${color}`}>{label}</span>
    </div>
  );
}

export default PresenceIndicator;
