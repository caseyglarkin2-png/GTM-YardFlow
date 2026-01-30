/**
 * Sprint 84.4: Sequence Performance Report Panel
 * 
 * Shows performance metrics for each sequence including:
 * - Emails sent, opened, clicked, replied
 * - Meetings booked from sequence
 * - Conversion rates at each step
 */

import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  Mail, 
  Eye, 
  MousePointer, 
  MessageSquare, 
  Calendar,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  BarChart3
} from 'lucide-react';
import { getSequencePerformance, type SequencePerformance } from '../services/MeetingAttributionService';

interface SequencePerformancePanelProps {
  onClose?: () => void;
}

export function SequencePerformancePanel({ onClose: _onClose }: SequencePerformancePanelProps) {
  const [performances, setPerformances] = useState<SequencePerformance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSequence, setExpandedSequence] = useState<string | null>(null);

  const loadPerformance = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getSequencePerformance();
      setPerformances(data);
    } catch (err) {
      console.error('Failed to load sequence performance:', err);
      setError('Failed to load performance data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPerformance();
  }, []);

  const formatPercent = (value: number) => {
    if (isNaN(value) || !isFinite(value)) return '0%';
    return `${Math.round(value)}%`;
  };

  const getConversionColor = (rate: number) => {
    if (rate >= 20) return 'text-green-600';
    if (rate >= 10) return 'text-blue-600';
    if (rate >= 5) return 'text-amber-600';
    return 'text-slate-500';
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-blue-600" />
            Sequence Performance
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

  if (error) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-blue-600" />
            Sequence Performance
          </h3>
        </div>
        <div className="text-center py-6">
          <p className="text-slate-500 mb-3">{error}</p>
          <button
            onClick={loadPerformance}
            className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1 mx-auto"
          >
            <RefreshCw className="h-4 w-4" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (performances.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-blue-600" />
            Sequence Performance
          </h3>
        </div>
        <div className="text-center py-8 text-slate-500">
          <Mail className="h-10 w-10 mx-auto mb-3 text-slate-300" />
          <p>No sequence data yet</p>
          <p className="text-xs mt-1">Performance will appear after sending sequence emails</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-blue-600" />
          Sequence Performance
        </h3>
        <button
          onClick={loadPerformance}
          className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100"
          title="Refresh data"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      <div className="divide-y divide-slate-100">
        {performances.map((seq) => {
          const isExpanded = expandedSequence === seq.sequenceId;
          const meetingRate = seq.sent > 0 ? (seq.meetings / seq.sent) * 100 : 0;
          
          return (
            <div key={seq.sequenceId} className="bg-white">
              {/* Summary Row */}
              <button
                onClick={() => setExpandedSequence(isExpanded ? null : seq.sequenceId)}
                className="w-full p-4 text-left hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="font-medium text-slate-800">{seq.sequenceName}</div>
                    <div className="flex items-center gap-4 mt-2 text-xs">
                      <span className="flex items-center gap-1 text-slate-500">
                        <Mail className="h-3.5 w-3.5" />
                        {seq.sent} sent
                      </span>
                      <span className="flex items-center gap-1 text-slate-500">
                        <Eye className="h-3.5 w-3.5" />
                        {formatPercent(seq.openRate)} open
                      </span>
                      <span className="flex items-center gap-1 text-slate-500">
                        <MessageSquare className="h-3.5 w-3.5" />
                        {formatPercent(seq.replyRate)} reply
                      </span>
                      <span className={`flex items-center gap-1 font-semibold ${getConversionColor(meetingRate)}`}>
                        <Calendar className="h-3.5 w-3.5" />
                        {seq.meetings} meetings
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className={`text-lg font-bold ${getConversionColor(meetingRate)}`}>
                        {formatPercent(meetingRate)}
                      </div>
                      <div className="text-xs text-slate-400">conversion</div>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="h-5 w-5 text-slate-400" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-slate-400" />
                    )}
                  </div>
                </div>
              </button>

              {/* Expanded Details */}
              {isExpanded && (
                <div className="px-4 pb-4 bg-slate-50">
                  {/* Metrics Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
                    <MetricBox
                      icon={<Mail className="h-4 w-4" />}
                      label="Sent"
                      value={seq.sent}
                      color="text-slate-600"
                    />
                    <MetricBox
                      icon={<Eye className="h-4 w-4" />}
                      label="Opened"
                      value={seq.opened}
                      rate={seq.openRate}
                      color="text-blue-600"
                    />
                    <MetricBox
                      icon={<MousePointer className="h-4 w-4" />}
                      label="Clicked"
                      value={seq.clicked}
                      rate={seq.clickRate}
                      color="text-indigo-600"
                    />
                    <MetricBox
                      icon={<MessageSquare className="h-4 w-4" />}
                      label="Replied"
                      value={seq.replied}
                      rate={seq.replyRate}
                      color="text-purple-600"
                    />
                    <MetricBox
                      icon={<Calendar className="h-4 w-4" />}
                      label="Meetings"
                      value={seq.meetings}
                      rate={meetingRate}
                      color="text-green-600"
                    />
                  </div>

                  {/* Funnel Visualization */}
                  <div className="bg-white rounded-lg p-3 border border-slate-200">
                    <div className="text-xs font-medium text-slate-500 mb-2">Conversion Funnel</div>
                    <div className="flex items-center gap-1">
                      <FunnelBar value={seq.sent} max={seq.sent} label="Sent" color="bg-slate-300" />
                      <ChevronRight />
                      <FunnelBar value={seq.opened} max={seq.sent} label={`${formatPercent(seq.openRate)}`} color="bg-blue-400" />
                      <ChevronRight />
                      <FunnelBar value={seq.replied} max={seq.sent} label={`${formatPercent(seq.replyRate)}`} color="bg-purple-400" />
                      <ChevronRight />
                      <FunnelBar value={seq.meetings} max={seq.sent} label={`${formatPercent(meetingRate)}`} color="bg-green-500" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MetricBox({ 
  icon, 
  label, 
  value, 
  rate, 
  color 
}: { 
  icon: React.ReactNode; 
  label: string; 
  value: number; 
  rate?: number; 
  color: string;
}) {
  return (
    <div className="bg-white rounded-lg p-3 border border-slate-200">
      <div className={`flex items-center gap-1.5 ${color} mb-1`}>
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <div className="text-lg font-bold text-slate-800">{value}</div>
      {rate !== undefined && (
        <div className="text-xs text-slate-400">{Math.round(rate)}% rate</div>
      )}
    </div>
  );
}

function FunnelBar({ 
  value, 
  max, 
  label, 
  color 
}: { 
  value: number; 
  max: number; 
  label: string; 
  color: string;
}) {
  const percentage = max > 0 ? (value / max) * 100 : 0;
  
  return (
    <div className="flex-1 min-w-0">
      <div className="h-8 bg-slate-100 rounded relative overflow-hidden">
        <div 
          className={`absolute inset-y-0 left-0 ${color} transition-all duration-500`}
          style={{ width: `${Math.max(percentage, 5)}%` }}
        />
        <div className="absolute inset-0 flex items-center justify-center text-xs font-medium text-slate-700">
          {label}
        </div>
      </div>
    </div>
  );
}

function ChevronRight() {
  return (
    <div className="text-slate-300 flex-shrink-0">
      <TrendingUp className="h-4 w-4" />
    </div>
  );
}
