/**
 * HotListPanel Component
 * Sprint 203: Hot List & Daily Briefing
 * 
 * Displays the top priority prospects based on scoring algorithm.
 * Shows engagement reasons and quick actions.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Flame,
  TrendingUp,
  Mail,
  MousePointer,
  MessageSquare,
  Calendar,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  User,
  Building2,
  Star,
  ExternalLink,
  AlertCircle,
} from 'lucide-react';
import {
  collection,
  query,
  where,
  limit,
  getDocs,
  getFirestore,
  type DocumentData,
} from 'firebase/firestore';
import { getApp } from 'firebase/app';
import {
  getTopProspects,
  type HotListScore,
  type ProspectScoreInput,
} from '@/services/HotListScoringService';

// =============================================================================
// Types
// =============================================================================

interface HotListPanelProps {
  onProspectClick?: (prospectId: string) => void;
  maxProspects?: number;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

// =============================================================================
// Helper
// =============================================================================

function getDb() {
  try {
    const app = getApp();
    return getFirestore(app);
  } catch {
    return null;
  }
}

function getTierBadge(tier: string | undefined): { label: string; className: string } {
  const normalized = (tier || '').toLowerCase().replace(/\s+/g, '');
  if (normalized === 'tier1' || normalized === '1') {
    return { label: 'T1', className: 'bg-red-100 text-red-700' };
  }
  if (normalized === 'tier2' || normalized === '2') {
    return { label: 'T2', className: 'bg-orange-100 text-orange-700' };
  }
  if (normalized === 'tier3' || normalized === '3') {
    return { label: 'T3', className: 'bg-yellow-100 text-yellow-700' };
  }
  return { label: '', className: '' };
}

function getScoreColor(score: number): string {
  if (score >= 50) return 'text-red-600';
  if (score >= 30) return 'text-orange-600';
  if (score >= 15) return 'text-amber-600';
  return 'text-slate-500';
}

function getScoreBg(score: number): string {
  if (score >= 50) return 'bg-red-50';
  if (score >= 30) return 'bg-orange-50';
  if (score >= 15) return 'bg-amber-50';
  return 'bg-slate-50';
}

// =============================================================================
// Component
// =============================================================================

export function HotListPanel({
  onProspectClick,
  maxProspects = 10,
  autoRefresh = false,
  refreshInterval = 5 * 60 * 1000, // 5 minutes
}: HotListPanelProps) {
  const [hotList, setHotList] = useState<HotListScore[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchHotList = useCallback(async () => {
    const db = getDb();
    if (!db) {
      setError(new Error('Firestore not available'));
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Fetch prospects with some activity or high tier
      const prospectsRef = collection(db, 'prospects');
      const q = query(
        prospectsRef,
        where('status', 'in', ['active', 'contacted', 'engaged']),
        limit(100) // Get more than we need for scoring
      );

      const snapshot = await getDocs(q);

      const prospects: ProspectScoreInput[] = snapshot.docs.map((doc) => {
        const data = doc.data() as DocumentData;
        return {
          id: doc.id,
          tier: data.tier,
          emailOpened: data.emailOpened || data.opened,
          emailClicked: data.emailClicked || data.clicked,
          lastContactedAt: data.lastContactedAt,
          needsResponse: data.needsResponse,
          upcomingMeetingAt: data.upcomingMeetingAt,
          lastReplyAt: data.lastReplyAt,
          company: data.company,
          name: data.name || `${data.firstName || ''} ${data.lastName || ''}`.trim(),
          email: data.email,
        };
      });

      const topProspects = getTopProspects(prospects, maxProspects);
      setHotList(topProspects);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch hot list'));
      console.error('[HotListPanel] Failed to fetch:', err);
    } finally {
      setIsLoading(false);
    }
  }, [maxProspects]);

  // Initial fetch
  useEffect(() => {
    fetchHotList();
  }, [fetchHotList]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(fetchHotList, refreshInterval);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, fetchHotList]);

  // Stats summary
  const stats = useMemo(() => {
    return {
      critical: hotList.filter(h => h.score >= 50).length,
      high: hotList.filter(h => h.score >= 30 && h.score < 50).length,
      medium: hotList.filter(h => h.score >= 15 && h.score < 30).length,
    };
  }, [hotList]);

  // Loading state
  if (isLoading && hotList.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6" data-testid="hotlist-panel">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <Flame className="h-5 w-5 text-orange-500" />
            Hot List
          </h3>
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
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
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6" data-testid="hotlist-panel">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <Flame className="h-5 w-5 text-orange-500" />
            Hot List
          </h3>
        </div>
        <div className="text-center py-6">
          <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-2" />
          <p className="text-slate-500 mb-3">{error.message}</p>
          <button
            onClick={fetchHotList}
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
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm" data-testid="hotlist-panel">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
              <Flame className="h-5 w-5 text-orange-500" />
              Hot List
            </h3>
            <div className="flex gap-2">
              {stats.critical > 0 && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">
                  {stats.critical} critical
                </span>
              )}
              {stats.high > 0 && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-700">
                  {stats.high} high
                </span>
              )}
            </div>
          </div>
          <button
            onClick={fetchHotList}
            disabled={isLoading}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Empty state */}
      {hotList.length === 0 && (
        <div className="text-center py-12 px-6">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <TrendingUp className="h-8 w-8 text-slate-400" />
          </div>
          <h4 className="text-lg font-medium text-slate-800 mb-1">No hot prospects</h4>
          <p className="text-slate-500 text-sm">Start outreach to build your hot list</p>
        </div>
      )}

      {/* Hot list */}
      {hotList.length > 0 && (
        <ul className="divide-y divide-slate-100" role="list" aria-label="Hot prospects">
          {hotList.map((item, index) => {
            const isExpanded = expandedId === item.prospectId;
            const tierBadge = getTierBadge(item.prospect?.tier);

            return (
              <li
                key={item.prospectId}
                className={`px-6 py-4 hover:bg-slate-50 transition-colors ${getScoreBg(item.score)}`}
                data-testid={`hotlist-item-${item.prospectId}`}
              >
                <div className="flex items-start justify-between gap-4">
                  {/* Rank & Score */}
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col items-center">
                      <span className="text-lg font-bold text-slate-300">#{index + 1}</span>
                      <span className={`text-sm font-semibold ${getScoreColor(item.score)}`}>
                        {item.score}
                      </span>
                    </div>
                  </div>

                  {/* Prospect info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <button
                        onClick={() => onProspectClick?.(item.prospectId)}
                        className="font-medium text-slate-800 hover:text-blue-600 truncate flex items-center gap-1"
                      >
                        <User className="h-4 w-4 text-slate-400" />
                        {item.prospect?.name || 'Unknown'}
                        <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100" />
                      </button>
                      {tierBadge.label && (
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${tierBadge.className}`}>
                          {tierBadge.label}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-sm text-slate-500">
                      <span className="flex items-center gap-1 truncate">
                        <Building2 className="h-3.5 w-3.5" />
                        {item.prospect?.company || 'Unknown'}
                      </span>
                    </div>

                    {/* Quick engagement indicators */}
                    <div className="flex items-center gap-2 mt-2">
                      {item.prospect?.needsResponse && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
                          <MessageSquare className="h-3 w-3" />
                          Replied
                        </span>
                      )}
                      {item.prospect?.emailClicked && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                          <MousePointer className="h-3 w-3" />
                          Clicked
                        </span>
                      )}
                      {item.prospect?.emailOpened && !item.prospect?.emailClicked && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700">
                          <Mail className="h-3 w-3" />
                          Opened
                        </span>
                      )}
                      {item.prospect?.upcomingMeetingAt && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-cyan-100 text-cyan-700">
                          <Calendar className="h-3 w-3" />
                          Meeting
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Expand/Collapse */}
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : item.prospectId)}
                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                    aria-label={isExpanded ? 'Collapse reasons' : 'Expand reasons'}
                  >
                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                </div>

                {/* Expanded reasons */}
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-slate-200">
                    <h5 className="text-xs font-medium text-slate-500 uppercase mb-2">Why this prospect is hot:</h5>
                    <ul className="space-y-1">
                      {item.reasons.map((reason, i) => (
                        <li key={i} className="flex items-center gap-2 text-sm text-slate-600">
                          <Star className="h-3.5 w-3.5 text-amber-500" />
                          {reason}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* Footer */}
      {hotList.length > 0 && (
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 text-sm text-slate-500">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Top {hotList.length} prospects by engagement score
          </div>
        </div>
      )}
    </div>
  );
}

export default HotListPanel;
