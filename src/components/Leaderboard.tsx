/**
 * Leaderboard Component
 * Sprint 28B - T28B.5
 * 
 * Displays ranked list of team members with performance metrics.
 */

import type { UserActivitySummary } from '../types/analytics';

export interface LeaderboardProps {
  data: UserActivitySummary[];
  title?: string;
  maxItems?: number;
  showRank?: boolean;
  showAvatar?: boolean;
  onUserClick?: (user: UserActivitySummary) => void;
  className?: string;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDuration(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 24) return `${hours.toFixed(1)}h`;
  return `${Math.round(hours / 24)}d`;
}

function getRankBadge(rank: number) {
  const badges: Record<number, { emoji: string; color: string }> = {
    1: { emoji: '🥇', color: 'bg-yellow-100 text-yellow-800' },
    2: { emoji: '🥈', color: 'bg-gray-100 text-gray-700' },
    3: { emoji: '🥉', color: 'bg-orange-100 text-orange-800' },
  };

  const badge = badges[rank];
  
  if (badge) {
    return (
      <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full ${badge.color}`}>
        {badge.emoji}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gray-50 text-gray-600 text-sm font-medium">
      {rank}
    </span>
  );
}

function UserAvatar({ name, avatar }: { name: string; avatar?: string }) {
  if (avatar) {
    return (
      <img 
        src={avatar} 
        alt={name}
        className="w-10 h-10 rounded-full object-cover"
        data-testid="user-avatar-image"
      />
    );
  }

  // Generate initials
  const initials = name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  // Generate color from name
  const colors = [
    'bg-blue-500', 'bg-green-500', 'bg-purple-500', 
    'bg-pink-500', 'bg-indigo-500', 'bg-teal-500',
  ];
  const colorIndex = name.length % colors.length;

  return (
    <div 
      className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-medium ${colors[colorIndex]}`}
      data-testid="user-avatar-initials"
    >
      {initials}
    </div>
  );
}

export function Leaderboard({
  data,
  title = 'Top Performers',
  maxItems = 5,
  showRank = true,
  showAvatar = true,
  onUserClick,
  className = '',
}: LeaderboardProps) {
  const displayedData = data.slice(0, maxItems);
  const isClickable = !!onUserClick;

  return (
    <div className={`bg-white rounded-xl border border-gray-200 shadow-sm ${className}`} data-testid="leaderboard">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100">
        <h3 className="font-semibold text-gray-900" data-testid="leaderboard-title">
          {title}
        </h3>
      </div>

      {/* List */}
      {displayedData.length > 0 ? (
        <ul className="divide-y divide-gray-100" data-testid="leaderboard-list">
          {displayedData.map((user) => (
            <li
              key={user.userId}
              className={`
                px-5 py-4 flex items-center gap-4
                ${isClickable ? 'cursor-pointer hover:bg-gray-50 transition-colors' : ''}
              `}
              onClick={() => onUserClick?.(user)}
              role={isClickable ? 'button' : undefined}
              data-testid="leaderboard-item"
            >
              {/* Rank */}
              {showRank && (
                <div className="flex-shrink-0" data-testid="user-rank">
                  {getRankBadge(user.rank)}
                </div>
              )}

              {/* Avatar */}
              {showAvatar && (
                <div className="flex-shrink-0" data-testid="user-avatar">
                  <UserAvatar name={user.userName} avatar={user.userAvatar} />
                </div>
              )}

              {/* User Info */}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 truncate" data-testid="user-name">
                  {user.userName}
                </p>
                <div className="flex items-center gap-3 text-sm text-gray-500">
                  <span data-testid="user-activities">
                    {user.totalActivities.toLocaleString()} activities
                  </span>
                  <span>•</span>
                  <span data-testid="user-prospects">
                    {user.prospectsContacted.toLocaleString()} prospects
                  </span>
                </div>
              </div>

              {/* Stats */}
              <div className="flex-shrink-0 text-right">
                <p className="font-semibold text-gray-900" data-testid="user-revenue">
                  {formatCurrency(user.revenue)}
                </p>
                <p className="text-sm text-gray-500" data-testid="user-deals">
                  {user.dealsWon} won / {user.dealsCreated} created
                </p>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="px-5 py-8 text-center text-gray-500" data-testid="leaderboard-empty">
          No data available
        </div>
      )}

      {/* Footer - Show more if truncated */}
      {data.length > maxItems && (
        <div className="px-5 py-3 border-t border-gray-100 text-center">
          <span className="text-sm text-gray-500" data-testid="leaderboard-more">
            +{data.length - maxItems} more
          </span>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Compact Leaderboard Variant
// =============================================================================

export interface CompactLeaderboardProps {
  data: UserActivitySummary[];
  metric: 'revenue' | 'activities' | 'deals' | 'responseTime';
  title?: string;
  maxItems?: number;
  className?: string;
}

export function CompactLeaderboard({
  data,
  metric,
  title = 'Top Performers',
  maxItems = 5,
  className = '',
}: CompactLeaderboardProps) {
  const displayedData = data.slice(0, maxItems);

  const getMetricValue = (user: UserActivitySummary) => {
    switch (metric) {
      case 'revenue':
        return formatCurrency(user.revenue);
      case 'activities':
        return user.totalActivities.toLocaleString();
      case 'deals':
        return `${user.dealsWon} won`;
      case 'responseTime':
        return formatDuration(user.avgResponseTime);
    }
  };

  const getMetricLabel = () => {
    switch (metric) {
      case 'revenue':
        return 'Revenue';
      case 'activities':
        return 'Activities';
      case 'deals':
        return 'Deals';
      case 'responseTime':
        return 'Avg Response';
    }
  };

  // Find max value for progress bar
  const maxValue = Math.max(...displayedData.map(user => {
    switch (metric) {
      case 'revenue': return user.revenue;
      case 'activities': return user.totalActivities;
      case 'deals': return user.dealsWon;
      case 'responseTime': return 1 / (user.avgResponseTime || 1); // Inverse for response time
    }
  }));

  const getProgress = (user: UserActivitySummary) => {
    const value = (() => {
      switch (metric) {
        case 'revenue': return user.revenue;
        case 'activities': return user.totalActivities;
        case 'deals': return user.dealsWon;
        case 'responseTime': return 1 / (user.avgResponseTime || 1);
      }
    })();
    return maxValue > 0 ? (value / maxValue) * 100 : 0;
  };

  return (
    <div className={`bg-white rounded-xl border border-gray-200 shadow-sm ${className}`} data-testid="compact-leaderboard">
      <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center">
        <h3 className="font-semibold text-gray-900" data-testid="compact-leaderboard-title">
          {title}
        </h3>
        <span className="text-xs text-gray-500 uppercase tracking-wide">
          {getMetricLabel()}
        </span>
      </div>

      <ul className="divide-y divide-gray-50" data-testid="compact-leaderboard-list">
        {displayedData.map((user, index) => (
          <li key={user.userId} className="px-5 py-3" data-testid="compact-leaderboard-item">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-600">
                  {index + 1}.
                </span>
                <span className="text-sm font-medium text-gray-900 truncate">
                  {user.userName}
                </span>
              </div>
              <span className="text-sm font-semibold text-gray-900">
                {getMetricValue(user)}
              </span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-blue-500 rounded-full transition-all duration-300"
                style={{ width: `${getProgress(user)}%` }}
                data-testid="progress-bar"
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
