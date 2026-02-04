/**
 * T5.1: MeetingAttributionCard Component
 * 
 * Shows email-to-meeting conversion metrics and recent meetings
 * with attribution to outreach sources.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { LazyIcon } from './icons';
import { railwayClient } from '@/services/RailwayApiClient';
import { featureFlags } from '@/config/featureFlags';
import type { MeetingMetrics, RailwayMeeting } from '@/types/railway';

interface MetricBoxProps {
  label: string;
  value: string | number;
  highlight?: boolean;
  icon?: React.ReactNode;
}

function MetricBox({ label, value, highlight, icon }: MetricBoxProps) {
  return (
    <div className={`p-3 rounded-lg ${highlight ? 'bg-green-50 border border-green-100' : 'bg-slate-50'}`}>
      <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
        {icon}
        <span>{label}</span>
      </div>
      <div className={`text-xl font-semibold ${highlight ? 'text-green-700' : 'text-slate-800'}`}>
        {value}
      </div>
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 animate-pulse">
      <div className="h-5 bg-slate-200 rounded w-40 mb-4"></div>
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="h-16 bg-slate-100 rounded"></div>
        <div className="h-16 bg-slate-100 rounded"></div>
        <div className="h-16 bg-slate-100 rounded"></div>
      </div>
      <div className="h-px bg-slate-200 mb-4"></div>
      <div className="space-y-2">
        <div className="h-10 bg-slate-100 rounded"></div>
        <div className="h-10 bg-slate-100 rounded"></div>
      </div>
    </div>
  );
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

export function MeetingAttributionCard() {
  const [metrics, setMetrics] = useState<MeetingMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadMetrics = useCallback(async () => {
    if (!featureFlags.RAILWAY_ENABLED) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await railwayClient.meetings.getMetrics();
      if (result.ok && result.data) {
        setMetrics(result.data);
      } else {
        setError(result.error || 'Failed to load metrics');
      }
    } catch (err) {
      console.warn('Failed to load meeting metrics:', err);
      setError('Failed to load metrics');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMetrics();
  }, [loadMetrics]);

  // Don't render if Railway is disabled
  if (!featureFlags.RAILWAY_ENABLED) {
    return null;
  }

  if (isLoading) {
    return <CardSkeleton />;
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
        <h3 className="font-medium text-slate-800 mb-2 flex items-center gap-2">
          <LazyIcon name="Calendar" className="h-4 w-4 text-purple-600" />
          Meeting Attribution
        </h3>
        <p className="text-sm text-slate-400">{error}</p>
        <button
          onClick={loadMetrics}
          className="mt-2 text-xs text-blue-600 hover:text-blue-700"
        >
          Retry
        </button>
      </div>
    );
  }

  const conversionPercent = ((metrics?.conversionRate || 0) * 100).toFixed(1);
  const recentMeetings = metrics?.recentMeetings || [];

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
      <h3 className="font-medium text-slate-800 mb-4 flex items-center gap-2">
        <LazyIcon name="Calendar" className="h-4 w-4 text-purple-600" />
        Meeting Attribution
      </h3>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <MetricBox
          label="Emails Sent"
          value={metrics?.emailsSent || 0}
          icon={<LazyIcon name="Mail" className="h-3 w-3" />}
        />
        <MetricBox
          label="Meetings"
          value={metrics?.meetingsBooked || 0}
          icon={<LazyIcon name="Calendar" className="h-3 w-3" />}
        />
        <MetricBox
          label="Conversion"
          value={`${conversionPercent}%`}
          highlight={parseFloat(conversionPercent) > 0}
          icon={<LazyIcon name="TrendingUp" className="h-3 w-3" />}
        />
      </div>

      <div className="border-t border-slate-200 pt-4">
        <h4 className="text-sm font-medium text-slate-700 mb-3 flex items-center gap-1">
          <LazyIcon name="Clock" className="h-3.5 w-3.5" />
          Recent Meetings
        </h4>

        {recentMeetings.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-4">
            No meetings booked yet
          </p>
        ) : (
          <div className="space-y-3">
            {recentMeetings.slice(0, 5).map((meeting: RailwayMeeting) => (
              <div 
                key={meeting.id} 
                className="flex items-center justify-between text-sm border-b border-slate-100 pb-2 last:border-0 last:pb-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-700 truncate">
                    {meeting.prospectName || meeting.email}
                  </p>
                  <p className="text-xs text-slate-400 truncate">
                    {meeting.companyName || 'Unknown company'}
                  </p>
                </div>
                <div className="text-right ml-2 flex-shrink-0">
                  <p className="text-xs text-slate-400">
                    {formatDate(meeting.scheduledAt)}
                  </p>
                  {meeting.sourceOutreachId && (
                    <span 
                      className="inline-flex items-center gap-0.5 text-xs text-green-600"
                      title="This meeting was attributed to an email campaign"
                    >
                      <LazyIcon name="Mail" className="h-2.5 w-2.5" />
                      Attributed
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
