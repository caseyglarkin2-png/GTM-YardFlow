/**
 * SuppressionManager Component
 * 
 * Sprint 2: T2.5 - Suppression List Manager UI
 * 
 * Provides UI for managing email suppression list:
 * - View suppressed emails with filtering
 * - Search by email
 * - Remove entries
 * - View statistics
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Ban,
  Search,
  RefreshCw,
  Trash2,
  Mail,
  AlertTriangle,
  MailWarning,
  UserX,
  ThumbsDown,
  ChevronLeft,
  ChevronRight,
  Download,
} from 'lucide-react';
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  deleteDoc,
  doc,
  limit,
  startAfter,
  getFirestore,
  DocumentSnapshot,
} from 'firebase/firestore';
import { getApp } from 'firebase/app';
import type { SuppressionEntry } from '@/types/email';

const SUPPRESSION_COLLECTION = 'email_suppressions';
const PAGE_SIZE = 20;

type ReasonFilter = 'all' | 'bounce' | 'spam' | 'unsubscribe' | 'manual';

const reasonConfig: Record<SuppressionEntry['reason'], { label: string; icon: React.ReactNode; color: string }> = {
  bounce: { label: 'Bounce', icon: <MailWarning className="w-4 h-4" />, color: 'text-orange-600 bg-orange-50' },
  spam: { label: 'Spam Report', icon: <AlertTriangle className="w-4 h-4" />, color: 'text-red-600 bg-red-50' },
  unsubscribe: { label: 'Unsubscribed', icon: <UserX className="w-4 h-4" />, color: 'text-blue-600 bg-blue-50' },
  manual: { label: 'Manual', icon: <Ban className="w-4 h-4" />, color: 'text-slate-600 bg-slate-50' },
  feedback: { label: 'Feedback', icon: <ThumbsDown className="w-4 h-4" />, color: 'text-purple-600 bg-purple-50' },
};

interface SuppressionStats {
  total: number;
  byReason: Record<string, number>;
  last7Days: number;
  last30Days: number;
}

function getDb() {
  try {
    const app = getApp();
    return getFirestore(app);
  } catch {
    return null;
  }
}

export function SuppressionManager() {
  const db = getDb();
  
  const [entries, setEntries] = useState<(SuppressionEntry & { id: string })[]>([]);
  const [stats, setStats] = useState<SuppressionStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [reasonFilter, setReasonFilter] = useState<ReasonFilter>('all');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isRemoving, setIsRemoving] = useState<string | null>(null);
  const [lastDoc, setLastDoc] = useState<DocumentSnapshot | null>(null);

  // Fetch suppression list
  const fetchList = useCallback(async () => {
    if (!db) return;

    setIsLoading(true);
    try {
      const collRef = collection(db, SUPPRESSION_COLLECTION);
      let q = query(collRef, orderBy('createdAt', 'desc'));

      if (reasonFilter !== 'all') {
        q = query(collRef, where('reason', '==', reasonFilter), orderBy('createdAt', 'desc'));
      }

      // Apply pagination if not first page
      if (page > 0 && lastDoc) {
        q = query(q, startAfter(lastDoc), limit(PAGE_SIZE + 1));
      } else {
        q = query(q, limit(PAGE_SIZE + 1));
      }

      const snap = await getDocs(q);

      const docs = snap.docs.slice(0, PAGE_SIZE).map(d => ({
        ...d.data(),
        id: d.id,
      })) as (SuppressionEntry & { id: string })[];

      // Store last doc for pagination
      if (snap.docs.length > 0) {
        setLastDoc(snap.docs[Math.min(PAGE_SIZE - 1, snap.docs.length - 1)]);
      }

      // Client-side search filter
      const filtered = searchQuery
        ? docs.filter(e => e.email.toLowerCase().includes(searchQuery.toLowerCase()))
        : docs;

      setEntries(filtered);
      setHasMore(snap.docs.length > PAGE_SIZE);
    } catch (err) {
      console.error('Failed to fetch suppression list:', err);
    } finally {
      setIsLoading(false);
    }
  }, [db, page, reasonFilter, searchQuery, lastDoc]);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    if (!db) return;

    try {
      const now = Date.now();
      const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
      const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

      const collRef = collection(db, SUPPRESSION_COLLECTION);
      const allSnap = await getDocs(collRef);
      const allEntries = allSnap.docs.map(d => d.data() as SuppressionEntry);

      const byReason: Record<string, number> = {};
      let last7Days = 0;
      let last30Days = 0;

      for (const entry of allEntries) {
        byReason[entry.reason] = (byReason[entry.reason] || 0) + 1;
        if (entry.createdAt >= sevenDaysAgo) last7Days++;
        if (entry.createdAt >= thirtyDaysAgo) last30Days++;
      }

      setStats({
        total: allEntries.length,
        byReason,
        last7Days,
        last30Days,
      });
    } catch (err) {
      console.error('Failed to fetch suppression stats:', err);
    }
  }, [db]);

  // Remove from suppression
  const removeEntry = async (email: string) => {
    if (!db) return;

    setIsRemoving(email);
    try {
      const docId = email.toLowerCase();
      await deleteDoc(doc(db, SUPPRESSION_COLLECTION, docId));
      
      // Update local state
      setEntries(prev => prev.filter(e => e.email !== email));
      setStats(prev => prev ? { ...prev, total: prev.total - 1 } : null);
    } catch (err) {
      console.error('Failed to remove from suppression:', err);
    } finally {
      setIsRemoving(null);
    }
  };

  // Export to CSV
  const exportToCsv = () => {
    if (entries.length === 0) return;

    const headers = ['Email', 'Reason', 'Bounce Type', 'Source', 'Created At'];
    const rows = entries.map(e => [
      e.email,
      e.reason,
      e.bounceType || '',
      e.source || '',
      new Date(e.createdAt).toISOString(),
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `suppression-list-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Reset page and pagination state when filters change
  useEffect(() => {
    setPage(0);
    setLastDoc(null);
  }, [reasonFilter, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-white rounded-lg border border-slate-200 shadow-sm">
            <div className="text-2xl font-bold text-slate-800">{stats.total}</div>
            <div className="text-sm text-slate-500">Total Suppressed</div>
          </div>
          <div className="p-4 bg-white rounded-lg border border-slate-200 shadow-sm">
            <div className="text-2xl font-bold text-orange-600">
              {stats.byReason['bounce'] || 0}
            </div>
            <div className="text-sm text-slate-500">Bounces</div>
          </div>
          <div className="p-4 bg-white rounded-lg border border-slate-200 shadow-sm">
            <div className="text-2xl font-bold text-red-600">
              {stats.byReason['spam'] || 0}
            </div>
            <div className="text-sm text-slate-500">Spam Reports</div>
          </div>
          <div className="p-4 bg-white rounded-lg border border-slate-200 shadow-sm">
            <div className="text-2xl font-bold text-blue-600">
              {stats.byReason['unsubscribe'] || 0}
            </div>
            <div className="text-sm text-slate-500">Unsubscribes</div>
          </div>
        </div>
      )}

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Reason Filter */}
        <select
          value={reasonFilter}
          onChange={(e) => setReasonFilter(e.target.value as ReasonFilter)}
          className="px-4 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Reasons</option>
          <option value="bounce">Bounces</option>
          <option value="spam">Spam Reports</option>
          <option value="unsubscribe">Unsubscribes</option>
          <option value="manual">Manual</option>
        </select>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={() => fetchList()}
            disabled={isLoading}
            className="p-2 text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={exportToCsv}
            disabled={entries.length === 0}
            className="p-2 text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
            title="Export to CSV"
          >
            <Download className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Email
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Reason
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider hidden md:table-cell">
                Source
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider hidden sm:table-cell">
                Added
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading && entries.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  <RefreshCw className="w-5 h-5 animate-spin inline mr-2" />
                  Loading...
                </td>
              </tr>
            ) : entries.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  <Mail className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  <p>No suppressed emails found</p>
                </td>
              </tr>
            ) : (
              entries.map((entry) => {
                const config = reasonConfig[entry.reason];
                return (
                  <tr key={entry.email} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        <span className="text-sm font-medium text-slate-800 truncate max-w-[200px] sm:max-w-[300px]">
                          {entry.email}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${config.color}`}>
                        {config.icon}
                        {config.label}
                        {entry.bounceType && (
                          <span className="text-xs opacity-75">({entry.bounceType})</span>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500 hidden md:table-cell">
                      {entry.source || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500 hidden sm:table-cell">
                      {formatDate(entry.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => removeEntry(entry.email)}
                        disabled={isRemoving === entry.email}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                        title="Remove from suppression list"
                      >
                        {isRemoving === entry.email ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {(page > 0 || hasMore) && (
          <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between bg-slate-50">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-slate-600 hover:text-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </button>
            <span className="text-sm text-slate-500">
              Page {page + 1}
            </span>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={!hasMore}
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-slate-600 hover:text-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="text-xs text-slate-500 flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <p>
          Removing an email from the suppression list allows emails to be sent to that address again.
          Use caution when removing bounced or spam-reported addresses.
        </p>
      </div>
    </div>
  );
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default SuppressionManager;
