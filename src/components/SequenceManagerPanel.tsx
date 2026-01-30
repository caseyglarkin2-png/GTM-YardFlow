/**
 * SequenceManagerPanel Component - YardFlow Hub
 * 
 * Sprint 81.5: Panel showing all active enrollments.
 * Columns: Prospect, Sequence, Step, Next Send, Status
 * Actions: Pause, Resume, Cancel
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Play, 
  Pause, 
  X, 
  Mail, 
  Clock, 
  Users,
  RefreshCw,
  Filter,
  ChevronDown,
  AlertCircle
} from 'lucide-react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  getFirestore, 
  doc, 
  updateDoc,
  getDocs
} from 'firebase/firestore';
import { getApp } from 'firebase/app';
import type { EnrollmentStatus } from '../types/emailSequence';

// ============================================
// Types
// ============================================

interface EnrollmentRow {
  id: string;
  prospectId: string;
  prospectName: string;
  prospectEmail: string;
  companyName: string;
  sequenceId: string;
  sequenceName: string;
  status: EnrollmentStatus;
  currentStepIndex: number;
  totalSteps: number;
  enrolledAt: string;
  nextSendAt: string | null;
  pauseReason?: string;
}

interface SequenceManagerPanelProps {
  onClose?: () => void;
  onProspectClick?: (prospectId: string) => void;
  showToast?: (type: 'success' | 'error' | 'info', title: string, message: string) => void;
}

// ============================================
// Helper Functions
// ============================================

function getDb() {
  try {
    const app = getApp();
    return getFirestore(app);
  } catch {
    return null;
  }
}

function formatNextSend(nextSendAt: string | null): string {
  if (!nextSendAt) return '—';
  
  const date = new Date(nextSendAt);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffMs < 0) return 'Overdue';
  if (diffHours < 1) return 'Soon';
  if (diffHours < 24) return `In ${diffHours}h`;
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays < 7) return `In ${diffDays} days`;
  
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getStatusBadge(status: EnrollmentStatus): { bg: string; text: string; label: string } {
  switch (status) {
    case 'active':
      return { bg: 'bg-green-100', text: 'text-green-700', label: 'Active' };
    case 'paused':
      return { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Paused' };
    case 'completed':
      return { bg: 'bg-slate-100', text: 'text-slate-600', label: 'Done' };
    case 'replied':
      return { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Replied' };
    case 'meeting':
      return { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Meeting' };
    case 'bounced':
      return { bg: 'bg-red-100', text: 'text-red-700', label: 'Bounced' };
    case 'unsubscribed':
      return { bg: 'bg-red-100', text: 'text-red-600', label: 'Unsub' };
    default:
      return { bg: 'bg-slate-100', text: 'text-slate-600', label: status };
  }
}

// ============================================
// Main Component
// ============================================

export function SequenceManagerPanel({ 
  onClose,
  onProspectClick,
  showToast 
}: SequenceManagerPanelProps): React.ReactElement {
  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | EnrollmentStatus>('all');
  const [sequenceFilter, setSequenceFilter] = useState<string>('all');
  const [sequences, setSequences] = useState<{ id: string; name: string }[]>([]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Load sequences for filter dropdown
  useEffect(() => {
    const db = getDb();
    if (!db) return;

    const loadSequences = async () => {
      const sequencesRef = collection(db, 'sequences');
      const snapshot = await getDocs(sequencesRef);
      setSequences(snapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name || 'Unnamed Sequence'
      })));
    };
    
    loadSequences();
  }, []);

  // Real-time listener for enrollments
  useEffect(() => {
    const db = getDb();
    if (!db) {
      setError('Firebase not configured');
      setIsLoading(false);
      return;
    }

    const enrollmentsRef = collection(db, 'sequenceEnrollments');
    
    // Build query based on filter
    let q;
    if (statusFilter === 'all') {
      q = query(enrollmentsRef);
    } else {
      q = query(enrollmentsRef, where('status', '==', statusFilter));
    }

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const rows: EnrollmentRow[] = [];
      
      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        
        // Filter by sequence if needed
        if (sequenceFilter !== 'all' && data.sequenceId !== sequenceFilter) {
          continue;
        }
        
        // Get sequence info
        const sequenceInfo = sequences.find(s => s.id === data.sequenceId);
        
        rows.push({
          id: docSnap.id,
          prospectId: data.prospectId,
          prospectName: data.prospectName || 'Unknown',
          prospectEmail: data.prospectEmail || '',
          companyName: data.companyName || '',
          sequenceId: data.sequenceId,
          sequenceName: sequenceInfo?.name || data.sequenceId,
          status: data.status,
          currentStepIndex: data.currentStepIndex || 0,
          totalSteps: 4, // Default, would be better to fetch from sequence
          enrolledAt: data.enrolledAt,
          nextSendAt: data.nextSendAt || null,
          pauseReason: data.pauseReason,
        });
      }
      
      // Sort by next send time (soonest first), then by enrolled date
      rows.sort((a, b) => {
        if (a.status === 'active' && b.status !== 'active') return -1;
        if (a.status !== 'active' && b.status === 'active') return 1;
        if (a.nextSendAt && b.nextSendAt) {
          return new Date(a.nextSendAt).getTime() - new Date(b.nextSendAt).getTime();
        }
        return new Date(b.enrolledAt).getTime() - new Date(a.enrolledAt).getTime();
      });
      
      setEnrollments(rows);
      setIsLoading(false);
    }, (err) => {
      console.error('Error loading enrollments:', err);
      setError('Failed to load enrollments');
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [statusFilter, sequenceFilter, sequences]);

  // Action handlers
  const handlePause = useCallback(async (enrollmentId: string) => {
    const db = getDb();
    if (!db) return;
    
    try {
      const enrollmentRef = doc(db, 'sequenceEnrollments', enrollmentId);
      await updateDoc(enrollmentRef, {
        status: 'paused',
        pausedAt: new Date().toISOString(),
        pauseReason: 'manual',
        nextSendAt: null,
      });
      showToast?.('success', 'Paused', 'Sequence paused');
    } catch (err) {
      console.error('Failed to pause:', err);
      showToast?.('error', 'Error', 'Failed to pause sequence');
    }
  }, [showToast]);

  const handleResume = useCallback(async (enrollmentId: string) => {
    const db = getDb();
    if (!db) return;
    
    try {
      // Calculate next send time
      const nextSendAt = new Date();
      nextSendAt.setHours(9, 15, 0, 0);
      if (nextSendAt <= new Date()) {
        nextSendAt.setDate(nextSendAt.getDate() + 1);
      }
      // Skip weekends
      if (nextSendAt.getDay() === 0) nextSendAt.setDate(nextSendAt.getDate() + 1);
      if (nextSendAt.getDay() === 6) nextSendAt.setDate(nextSendAt.getDate() + 2);
      
      const enrollmentRef = doc(db, 'sequenceEnrollments', enrollmentId);
      await updateDoc(enrollmentRef, {
        status: 'active',
        pausedAt: null,
        pauseReason: null,
        nextSendAt: nextSendAt.toISOString(),
      });
      showToast?.('success', 'Resumed', 'Sequence resumed');
    } catch (err) {
      console.error('Failed to resume:', err);
      showToast?.('error', 'Error', 'Failed to resume sequence');
    }
  }, [showToast]);

  const handleCancel = useCallback(async (enrollmentId: string) => {
    if (!confirm('Cancel this sequence? This cannot be undone.')) return;
    
    const db = getDb();
    if (!db) return;
    
    try {
      const enrollmentRef = doc(db, 'sequenceEnrollments', enrollmentId);
      await updateDoc(enrollmentRef, {
        status: 'completed',
        completedAt: new Date().toISOString(),
        pauseReason: 'cancelled_by_user',
        nextSendAt: null,
      });
      showToast?.('info', 'Cancelled', 'Sequence cancelled');
    } catch (err) {
      console.error('Failed to cancel:', err);
      showToast?.('error', 'Error', 'Failed to cancel sequence');
    }
  }, [showToast]);

  // Stats
  const stats = {
    active: enrollments.filter(e => e.status === 'active').length,
    paused: enrollments.filter(e => e.status === 'paused').length,
    replied: enrollments.filter(e => e.status === 'replied').length,
    total: enrollments.length,
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50">
        <div className="flex items-center gap-3">
          <Mail className="h-5 w-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-slate-800">Sequence Manager</h2>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Stats Bar */}
      <div className="flex items-center gap-4 px-4 py-2 border-b border-slate-100 bg-white">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-slate-500">Active:</span>
          <span className="font-semibold text-green-600">{stats.active}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-slate-500">Paused:</span>
          <span className="font-semibold text-amber-600">{stats.paused}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-slate-500">Replied:</span>
          <span className="font-semibold text-blue-600">{stats.replied}</span>
        </div>
        
        <div className="flex-1" />
        
        {/* Filter dropdown */}
        <div className="relative">
          <button
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
          >
            <Filter className="h-4 w-4" />
            Filter
            <ChevronDown className={`h-3 w-3 transition-transform ${isFilterOpen ? 'rotate-180' : ''}`} />
          </button>
          
          {isFilterOpen && (
            <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-slate-200 z-50 py-1">
              <div className="px-3 py-1 text-xs font-semibold text-slate-400 uppercase">Status</div>
              {['all', 'active', 'paused', 'replied', 'completed'].map(status => (
                <button
                  key={status}
                  onClick={() => {
                    setStatusFilter(status as 'all' | EnrollmentStatus);
                    setIsFilterOpen(false);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-sm hover:bg-slate-50 ${
                    statusFilter === status ? 'bg-blue-50 text-blue-700' : 'text-slate-700'
                  }`}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              ))}
              
              <div className="border-t border-slate-100 mt-1 pt-1">
                <div className="px-3 py-1 text-xs font-semibold text-slate-400 uppercase">Sequence</div>
                <button
                  onClick={() => {
                    setSequenceFilter('all');
                    setIsFilterOpen(false);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-sm hover:bg-slate-50 ${
                    sequenceFilter === 'all' ? 'bg-blue-50 text-blue-700' : 'text-slate-700'
                  }`}
                >
                  All Sequences
                </button>
                {sequences.map(seq => (
                  <button
                    key={seq.id}
                    onClick={() => {
                      setSequenceFilter(seq.id);
                      setIsFilterOpen(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 text-sm hover:bg-slate-50 truncate ${
                      sequenceFilter === seq.id ? 'bg-blue-50 text-blue-700' : 'text-slate-700'
                    }`}
                  >
                    {seq.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <RefreshCw className="h-6 w-6 text-blue-500 animate-spin" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-48 text-red-500">
            <AlertCircle className="h-8 w-8 mb-2" />
            <p>{error}</p>
          </div>
        ) : enrollments.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-slate-400">
            <Users className="h-8 w-8 mb-2" />
            <p>No enrollments found</p>
            <p className="text-sm">Start a sequence on a prospect to see it here</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50 sticky top-0">
              <tr className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <th className="px-4 py-2">Prospect</th>
                <th className="px-4 py-2">Sequence</th>
                <th className="px-4 py-2">Step</th>
                <th className="px-4 py-2">Next Send</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {enrollments.map(enrollment => {
                const statusBadge = getStatusBadge(enrollment.status);
                
                return (
                  <tr key={enrollment.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <button
                        onClick={() => onProspectClick?.(enrollment.prospectId)}
                        className="text-left hover:text-blue-600"
                      >
                        <div className="font-medium text-sm text-slate-800">
                          {enrollment.prospectName}
                        </div>
                        <div className="text-xs text-slate-500">
                          {enrollment.companyName}
                        </div>
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-slate-700">{enrollment.sequenceName}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-slate-600">
                        {enrollment.currentStepIndex + 1} / {enrollment.totalSteps}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 text-sm text-slate-600">
                        <Clock className="h-3 w-3" />
                        {formatNextSend(enrollment.nextSendAt)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${statusBadge.bg} ${statusBadge.text}`}>
                        {statusBadge.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {enrollment.status === 'active' && (
                          <button
                            onClick={() => handlePause(enrollment.id)}
                            className="p-1.5 text-amber-600 hover:bg-amber-50 rounded"
                            title="Pause sequence"
                          >
                            <Pause className="h-4 w-4" />
                          </button>
                        )}
                        {enrollment.status === 'paused' && (
                          <button
                            onClick={() => handleResume(enrollment.id)}
                            className="p-1.5 text-green-600 hover:bg-green-50 rounded"
                            title="Resume sequence"
                          >
                            <Play className="h-4 w-4" />
                          </button>
                        )}
                        {(enrollment.status === 'active' || enrollment.status === 'paused') && (
                          <button
                            onClick={() => handleCancel(enrollment.id)}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                            title="Cancel sequence"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
