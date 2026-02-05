/**
 * T96.3: Email Stats Card Component
 * Displays email performance metrics from Railway or local Firestore fallback
 */

import React from 'react';
import { Mail, Send, Eye, MousePointer, AlertTriangle, TrendingUp, RefreshCw } from 'lucide-react';
import { useWeeklyEmailStats, useTodayEmailStats } from '../hooks/useEmailAnalytics';

interface StatItemProps {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  trend?: number;
  color?: string;
}

function StatItem({ label, value, icon, trend, color = 'text-gray-600' }: StatItemProps) {
  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
      <div className="flex items-center gap-2">
        <span className={color}>{icon}</span>
        <span className="text-sm text-gray-600 dark:text-gray-400">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="font-semibold text-gray-900 dark:text-white">{value}</span>
        {trend !== undefined && trend !== 0 && (
          <span className={`text-xs ${trend > 0 ? 'text-green-600' : 'text-red-600'}`}>
            {trend > 0 ? '+' : ''}{trend.toFixed(1)}%
          </span>
        )}
      </div>
    </div>
  );
}

interface RateDisplayProps {
  label: string;
  rate: number;
  color: string;
}

function RateDisplay({ label, rate, color }: RateDisplayProps) {
  return (
    <div className="text-center">
      <div className={`text-2xl font-bold ${color}`}>{rate.toFixed(1)}%</div>
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  );
}

export function EmailStatsCard() {
  const { analytics, isLoading, error, refresh, lastUpdated } = useWeeklyEmailStats();
  const { analytics: todayStats } = useTodayEmailStats();

  if (error) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-red-500">
            <AlertTriangle className="w-5 h-5" />
            <span>{error}</span>
          </div>
          <button
            onClick={refresh}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-800">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Mail className="w-5 h-5 text-indigo-600" />
          <h3 className="font-semibold text-gray-900 dark:text-white">Email Performance</h3>
        </div>
        <div className="flex items-center gap-2">
          {lastUpdated && (
            <span className="text-xs text-gray-400">
              Updated {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={refresh}
            disabled={isLoading}
            className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Rates Section */}
      {analytics && (
        <>
          <div className="grid grid-cols-3 gap-4 mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
            <RateDisplay
              label="Open Rate"
              rate={analytics.metrics.openRate}
              color="text-blue-600"
            />
            <RateDisplay
              label="Click Rate"
              rate={analytics.metrics.clickRate}
              color="text-green-600"
            />
            <RateDisplay
              label="Bounce Rate"
              rate={analytics.metrics.bounceRate}
              color={analytics.metrics.bounceRate > 5 ? 'text-red-600' : 'text-gray-600'}
            />
          </div>

          {/* Stats Grid */}
          <div className="space-y-2">
            <StatItem
              label="Sent this week"
              value={analytics.metrics.sent.toLocaleString()}
              icon={<Send className="w-4 h-4" />}
              color="text-indigo-600"
            />
            <StatItem
              label="Delivered"
              value={analytics.metrics.delivered.toLocaleString()}
              icon={<TrendingUp className="w-4 h-4" />}
              color="text-green-600"
            />
            <StatItem
              label="Opened"
              value={analytics.metrics.opened.toLocaleString()}
              icon={<Eye className="w-4 h-4" />}
              color="text-blue-600"
            />
            <StatItem
              label="Clicked"
              value={analytics.metrics.clicked.toLocaleString()}
              icon={<MousePointer className="w-4 h-4" />}
              color="text-purple-600"
            />
          </div>

          {/* Today's Stats */}
          {todayStats && (
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="text-sm text-gray-500 mb-2">Today</div>
              <div className="flex justify-around">
                <div className="text-center">
                  <div className="text-lg font-semibold text-indigo-600">
                    {todayStats.metrics.sent}
                  </div>
                  <div className="text-xs text-gray-500">Sent</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-semibold text-blue-600">
                    {todayStats.metrics.opened}
                  </div>
                  <div className="text-xs text-gray-500">Opened</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-semibold text-green-600">
                    {todayStats.metrics.clicked}
                  </div>
                  <div className="text-xs text-gray-500">Clicked</div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Loading State */}
      {isLoading && !analytics && (
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="w-6 h-6 text-gray-400 animate-spin" />
        </div>
      )}
    </div>
  );
}

/**
 * Compact version for sidebar or navigation
 */
export function EmailStatsBadge() {
  const { analytics, isLoading } = useTodayEmailStats();

  if (isLoading || !analytics) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 px-2 py-1 bg-indigo-50 dark:bg-indigo-900/20 rounded-md">
      <Mail className="w-3.5 h-3.5 text-indigo-600" />
      <span className="text-xs font-medium text-indigo-700 dark:text-indigo-300">
        {analytics.metrics.sent} sent today
      </span>
      {analytics.metrics.openRate > 0 && (
        <span className="text-xs text-indigo-500">
          ({analytics.metrics.openRate.toFixed(0)}% opens)
        </span>
      )}
    </div>
  );
}

export default EmailStatsCard;
