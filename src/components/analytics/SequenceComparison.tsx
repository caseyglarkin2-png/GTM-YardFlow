/**
 * SequenceComparison Component
 * 
 * Sprint 4: T4.4 - Comparative Sequence Analysis
 * 
 * Features:
 * - Sortable table with all sequences
 * - Color-coded performance indicators
 * - Best performer highlights
 * - Recommendations from analytics service
 * - Optional bar chart visualization
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  BarChart3,
  Table2,
  Trophy,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  RefreshCw,
  ChevronUp,
  ChevronDown,
  Lightbulb,
  Users,
  Mail,
  MessageSquare,
  Calendar,
  Star,
} from 'lucide-react';
import {
  SequenceAnalyticsService,
  ComparativeAnalysis,
  SequenceComparison as SequenceComparisonData,
} from '../../services/SequenceAnalyticsService';

// ============================================
// Types
// ============================================

type SortKey = 'sequenceName' | 'enrolled' | 'openRate' | 'replyRate' | 'meetingRate' | 'score';
type SortDirection = 'asc' | 'desc';
type ViewMode = 'table' | 'chart';

interface SequenceComparisonProps {
  /** Title override */
  title?: string;
  /** Show recommendations panel */
  showRecommendations?: boolean;
  /** Initial view mode */
  initialView?: ViewMode;
  /** Custom class name */
  className?: string;
}

// ============================================
// Constants
// ============================================

const THRESHOLDS = {
  openRate: { good: 40, warning: 25 },
  replyRate: { good: 10, warning: 5 },
  meetingRate: { good: 5, warning: 2 },
  score: { good: 15, warning: 8 },
};

// ============================================
// Helper Functions
// ============================================

function getPerformanceColor(value: number, metric: keyof typeof THRESHOLDS): string {
  const threshold = THRESHOLDS[metric];
  if (value >= threshold.good) return 'text-green-600 bg-green-50';
  if (value >= threshold.warning) return 'text-amber-600 bg-amber-50';
  return 'text-red-600 bg-red-50';
}

function getPerformanceBadge(value: number, metric: keyof typeof THRESHOLDS): string {
  const threshold = THRESHOLDS[metric];
  if (value >= threshold.good) return 'bg-green-100 text-green-700 border-green-200';
  if (value >= threshold.warning) return 'bg-amber-100 text-amber-700 border-amber-200';
  return 'bg-red-100 text-red-700 border-red-200';
}

function formatPercent(value: number): string {
  if (isNaN(value) || !isFinite(value)) return '0%';
  return `${value.toFixed(1)}%`;
}

function formatNumber(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return value.toString();
}

// ============================================
// Hooks
// ============================================

function useComparativeAnalysis() {
  const [data, setData] = useState<ComparativeAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const analyticsService = new SequenceAnalyticsService();
      const analysis = await analyticsService.getComparativeAnalysis();
      setData(analysis);
    } catch (err) {
      console.error('Failed to load comparative analysis:', err);
      setError(err instanceof Error ? err.message : 'Failed to load sequence comparison');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, isLoading, error, refresh: fetchData };
}

// ============================================
// Sub-Components
// ============================================

interface SortHeaderProps {
  label: string;
  sortKey: SortKey;
  currentSort: SortKey;
  direction: SortDirection;
  onSort: (key: SortKey) => void;
  icon?: React.ReactNode;
}

function SortHeader({ label, sortKey, currentSort, direction, onSort, icon }: SortHeaderProps) {
  const isActive = currentSort === sortKey;
  
  return (
    <button
      onClick={() => onSort(sortKey)}
      className={`
        flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide
        ${isActive ? 'text-blue-600' : 'text-slate-500 hover:text-slate-700'}
        transition-colors
      `}
    >
      {icon}
      <span>{label}</span>
      {isActive && (
        direction === 'desc' 
          ? <ChevronDown className="w-3.5 h-3.5" />
          : <ChevronUp className="w-3.5 h-3.5" />
      )}
    </button>
  );
}

interface BarChartRowProps {
  sequence: SequenceComparisonData;
  maxValues: { enrolled: number; openRate: number; replyRate: number; meetingRate: number };
  bestIds: { overall: string; openRate: string; replyRate: string; meetingRate: string };
}

function BarChartRow({ sequence, maxValues, bestIds }: BarChartRowProps) {
  const isBestOverall = sequence.sequenceId === bestIds.overall;
  
  return (
    <div className={`p-3 rounded-lg border ${isBestOverall ? 'border-blue-200 bg-blue-50/50' : 'border-slate-100 bg-white'}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {isBestOverall && <Trophy className="w-4 h-4 text-amber-500" />}
          <span className="font-medium text-slate-800">{sequence.sequenceName}</span>
          {sequence.tier && (
            <span className="text-xs px-1.5 py-0.5 bg-slate-100 rounded text-slate-500">
              {sequence.tier}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 text-sm">
          <Star className="w-3.5 h-3.5 text-amber-400" />
          <span className="font-semibold text-slate-700">{sequence.score.toFixed(1)}</span>
        </div>
      </div>
      
      <div className="space-y-2">
        {/* Open Rate Bar */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 w-16">Opens</span>
          <div className="flex-1 h-4 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                sequence.sequenceId === bestIds.openRate ? 'bg-green-500' : 'bg-blue-400'
              }`}
              style={{ width: `${Math.min(100, (sequence.openRate / (maxValues.openRate || 100)) * 100)}%` }}
            />
          </div>
          <span className="text-xs font-medium text-slate-700 w-12 text-right">
            {formatPercent(sequence.openRate)}
          </span>
        </div>
        
        {/* Reply Rate Bar */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 w-16">Replies</span>
          <div className="flex-1 h-4 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                sequence.sequenceId === bestIds.replyRate ? 'bg-green-500' : 'bg-indigo-400'
              }`}
              style={{ width: `${Math.min(100, (sequence.replyRate / (maxValues.replyRate || 100)) * 100)}%` }}
            />
          </div>
          <span className="text-xs font-medium text-slate-700 w-12 text-right">
            {formatPercent(sequence.replyRate)}
          </span>
        </div>
        
        {/* Meeting Rate Bar */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 w-16">Meetings</span>
          <div className="flex-1 h-4 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                sequence.sequenceId === bestIds.meetingRate ? 'bg-green-500' : 'bg-violet-400'
              }`}
              style={{ width: `${Math.min(100, (sequence.meetingRate / (maxValues.meetingRate || 100)) * 100)}%` }}
            />
          </div>
          <span className="text-xs font-medium text-slate-700 w-12 text-right">
            {formatPercent(sequence.meetingRate)}
          </span>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Main Component
// ============================================

export function SequenceComparison({
  title = 'Sequence Performance Comparison',
  showRecommendations = true,
  initialView = 'table',
  className = '',
}: SequenceComparisonProps) {
  const { data, isLoading, error, refresh } = useComparativeAnalysis();
  const [sortKey, setSortKey] = useState<SortKey>('score');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [viewMode, setViewMode] = useState<ViewMode>(initialView);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(prev => prev === 'desc' ? 'asc' : 'desc');
    } else {
      setSortKey(key);
      setSortDirection('desc');
    }
  };

  const sortedSequences = useMemo(() => {
    if (!data?.sequences) return [];
    
    return [...data.sequences].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc' 
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }
      
      const aNum = typeof aVal === 'number' ? aVal : 0;
      const bNum = typeof bVal === 'number' ? bVal : 0;
      
      return sortDirection === 'asc' ? aNum - bNum : bNum - aNum;
    });
  }, [data?.sequences, sortKey, sortDirection]);

  const maxValues = useMemo(() => {
    if (!data?.sequences) return { enrolled: 100, openRate: 100, replyRate: 100, meetingRate: 100 };
    
    return {
      enrolled: Math.max(...data.sequences.map(s => s.enrolled), 1),
      openRate: Math.max(...data.sequences.map(s => s.openRate), 1),
      replyRate: Math.max(...data.sequences.map(s => s.replyRate), 1),
      meetingRate: Math.max(...data.sequences.map(s => s.meetingRate), 1),
    };
  }, [data?.sequences]);

  const bestIds = useMemo(() => ({
    overall: data?.bestOverall || '',
    openRate: data?.bestOpenRate || '',
    replyRate: data?.bestReplyRate || '',
    meetingRate: data?.bestMeetingRate || '',
  }), [data]);

  // Loading State
  if (isLoading && !data) {
    return (
      <div className={`bg-white rounded-lg shadow-sm border border-gray-200 p-6 ${className}`}>
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-5 h-5 text-blue-500" />
          <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="animate-pulse flex items-center gap-4">
              <div className="h-4 bg-slate-200 rounded w-1/4" />
              <div className="h-4 bg-slate-100 rounded flex-1" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Error State
  if (error) {
    return (
      <div className={`bg-white rounded-lg shadow-sm border border-gray-200 p-6 ${className}`}>
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-5 h-5 text-blue-500" />
          <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
        </div>
        <div className="text-center py-8">
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
          <p className="text-slate-600 mb-3">{error}</p>
          <button
            onClick={refresh}
            className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1 mx-auto"
          >
            <RefreshCw className="w-4 h-4" />
            Try again
          </button>
        </div>
      </div>
    );
  }

  // Empty State
  if (!data || data.sequences.length === 0) {
    return (
      <div className={`bg-white rounded-lg shadow-sm border border-gray-200 p-6 ${className}`}>
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-5 h-5 text-blue-500" />
          <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
        </div>
        <div className="text-center py-8">
          <TrendingDown className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">No sequence data available yet.</p>
          <p className="text-sm text-slate-400 mt-1">Start sending sequences to see performance comparisons.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden ${className}`}>
      {/* Header */}
      <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-500" />
            <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
            <span className="text-sm text-slate-500">({data.sequences.length} sequences)</span>
          </div>
          
          <div className="flex items-center gap-2">
            {/* View Toggle */}
            <div className="flex items-center bg-white rounded-lg border border-slate-200 p-0.5">
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-md transition-colors ${
                  viewMode === 'table' 
                    ? 'bg-blue-100 text-blue-600' 
                    : 'text-slate-400 hover:text-slate-600'
                }`}
                title="Table view"
              >
                <Table2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('chart')}
                className={`p-1.5 rounded-md transition-colors ${
                  viewMode === 'chart' 
                    ? 'bg-blue-100 text-blue-600' 
                    : 'text-slate-400 hover:text-slate-600'
                }`}
                title="Chart view"
              >
                <BarChart3 className="w-4 h-4" />
              </button>
            </div>
            
            {/* Refresh Button */}
            <button
              onClick={refresh}
              disabled={isLoading}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded transition-colors disabled:opacity-50"
              title="Refresh data"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
        
        {/* Best Performer Summary */}
        {data.bestOverall && (
          <div className="flex items-center gap-4 mt-3 text-sm">
            <div className="flex items-center gap-1.5 text-amber-600">
              <Trophy className="w-4 h-4" />
              <span>Best Overall:</span>
              <span className="font-medium">
                {data.sequences.find(s => s.sequenceId === data.bestOverall)?.sequenceName}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        {viewMode === 'table' ? (
          /* Table View */
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="pb-3 text-left">
                    <SortHeader
                      label="Sequence"
                      sortKey="sequenceName"
                      currentSort={sortKey}
                      direction={sortDirection}
                      onSort={handleSort}
                    />
                  </th>
                  <th className="pb-3 text-center">
                    <SortHeader
                      label="Enrolled"
                      sortKey="enrolled"
                      currentSort={sortKey}
                      direction={sortDirection}
                      onSort={handleSort}
                      icon={<Users className="w-3.5 h-3.5" />}
                    />
                  </th>
                  <th className="pb-3 text-center">
                    <SortHeader
                      label="Open Rate"
                      sortKey="openRate"
                      currentSort={sortKey}
                      direction={sortDirection}
                      onSort={handleSort}
                      icon={<Mail className="w-3.5 h-3.5" />}
                    />
                  </th>
                  <th className="pb-3 text-center">
                    <SortHeader
                      label="Reply Rate"
                      sortKey="replyRate"
                      currentSort={sortKey}
                      direction={sortDirection}
                      onSort={handleSort}
                      icon={<MessageSquare className="w-3.5 h-3.5" />}
                    />
                  </th>
                  <th className="pb-3 text-center">
                    <SortHeader
                      label="Meeting Rate"
                      sortKey="meetingRate"
                      currentSort={sortKey}
                      direction={sortDirection}
                      onSort={handleSort}
                      icon={<Calendar className="w-3.5 h-3.5" />}
                    />
                  </th>
                  <th className="pb-3 text-center">
                    <SortHeader
                      label="Score"
                      sortKey="score"
                      currentSort={sortKey}
                      direction={sortDirection}
                      onSort={handleSort}
                      icon={<Star className="w-3.5 h-3.5" />}
                    />
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {sortedSequences.map((sequence) => {
                  const isBestOverall = sequence.sequenceId === bestIds.overall;
                  const isBestOpen = sequence.sequenceId === bestIds.openRate;
                  const isBestReply = sequence.sequenceId === bestIds.replyRate;
                  const isBestMeeting = sequence.sequenceId === bestIds.meetingRate;
                  
                  return (
                    <tr 
                      key={sequence.sequenceId}
                      className={`hover:bg-slate-50 transition-colors ${isBestOverall ? 'bg-blue-50/50' : ''}`}
                    >
                      {/* Sequence Name */}
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2">
                          {isBestOverall && <Trophy className="w-4 h-4 text-amber-500" />}
                          <div>
                            <div className="font-medium text-slate-800">{sequence.sequenceName}</div>
                            {(sequence.tier || sequence.persona) && (
                              <div className="text-xs text-slate-400">
                                {sequence.tier && <span>{sequence.tier}</span>}
                                {sequence.tier && sequence.persona && <span> • </span>}
                                {sequence.persona && <span>{sequence.persona}</span>}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      
                      {/* Enrolled */}
                      <td className="py-3 text-center">
                        <span className="text-2xl font-bold text-gray-900">
                          {formatNumber(sequence.enrolled)}
                        </span>
                      </td>
                      
                      {/* Open Rate */}
                      <td className="py-3 text-center">
                        <span className={`
                          inline-flex items-center gap-1 px-2 py-1 rounded-full text-sm font-medium border
                          ${getPerformanceBadge(sequence.openRate, 'openRate')}
                        `}>
                          {isBestOpen && <TrendingUp className="w-3.5 h-3.5" />}
                          {formatPercent(sequence.openRate)}
                        </span>
                      </td>
                      
                      {/* Reply Rate */}
                      <td className="py-3 text-center">
                        <span className={`
                          inline-flex items-center gap-1 px-2 py-1 rounded-full text-sm font-medium border
                          ${getPerformanceBadge(sequence.replyRate, 'replyRate')}
                        `}>
                          {isBestReply && <TrendingUp className="w-3.5 h-3.5" />}
                          {formatPercent(sequence.replyRate)}
                        </span>
                      </td>
                      
                      {/* Meeting Rate */}
                      <td className="py-3 text-center">
                        <span className={`
                          inline-flex items-center gap-1 px-2 py-1 rounded-full text-sm font-medium border
                          ${getPerformanceBadge(sequence.meetingRate, 'meetingRate')}
                        `}>
                          {isBestMeeting && <TrendingUp className="w-3.5 h-3.5" />}
                          {formatPercent(sequence.meetingRate)}
                        </span>
                      </td>
                      
                      {/* Score */}
                      <td className="py-3 text-center">
                        <div className={`
                          inline-flex items-center gap-1 px-3 py-1 rounded-lg text-sm font-bold
                          ${getPerformanceColor(sequence.score, 'score')}
                        `}>
                          <Star className="w-3.5 h-3.5" />
                          {sequence.score.toFixed(1)}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          /* Chart View */
          <div className="space-y-3">
            {sortedSequences.map(sequence => (
              <BarChartRow
                key={sequence.sequenceId}
                sequence={sequence}
                maxValues={maxValues}
                bestIds={bestIds}
              />
            ))}
          </div>
        )}
      </div>

      {/* Recommendations */}
      {showRecommendations && data.recommendations.length > 0 && (
        <div className="px-6 py-4 bg-amber-50 border-t border-amber-100">
          <div className="flex items-start gap-2">
            <Lightbulb className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-medium text-amber-800 mb-2">Recommendations</h4>
              <ul className="space-y-1.5">
                {data.recommendations.map((rec, idx) => (
                  <li key={idx} className="text-sm text-amber-700 flex items-start gap-2">
                    <span className="text-amber-400">•</span>
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SequenceComparison;
