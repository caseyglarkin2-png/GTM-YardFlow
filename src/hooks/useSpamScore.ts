/**
 * useSpamScore Hook
 * 
 * Sprint 39C.3: Real-time spam score analysis for email compose
 * 
 * Features:
 * - Debounced analysis to avoid excessive computation
 * - Local analysis for immediate feedback (no API)
 * - Optional API mode for server-side analysis
 * - Computed helpers for UI integration
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { SpamScoreService, type SpamScoreResult, type SpamIssue } from '@/services/SpamScoreService';
import { auth } from '@/lib/firebase';

/** Options for the useSpamScore hook */
export interface UseSpamScoreOptions {
  /** Email subject line */
  subject: string;
  /** Email body content */
  body: string;
  /** Whether body is HTML */
  isHtml?: boolean;
  /** Debounce delay in ms (default: 500) */
  debounceMs?: number;
  /** Enable analysis (default: true) */
  enabled?: boolean;
  /** Use API instead of local analysis (default: false) */
  useApi?: boolean;
}

/** Return value from the hook */
export interface UseSpamScoreReturn {
  /** Analysis result (null while loading or disabled) */
  result: SpamScoreResult | null;
  /** Loading state */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
  /** Trigger manual refresh */
  refresh: () => void;
  /** Score color class for UI */
  scoreColor: string;
  /** Level badge color class */
  levelColor: string;
  /** Whether the email is safe to send (low risk) */
  isSafeToSend: boolean;
  /** Whether there are critical issues */
  hasCriticalIssues: boolean;
  /** Get top N issues */
  getTopIssues: (n?: number) => SpamIssue[];
  /** Check if a specific category has issues */
  hasIssueCategory: (category: string) => boolean;
}

/**
 * useSpamScore - Real-time spam analysis for email content
 */
export function useSpamScore({
  subject,
  body,
  isHtml = false,
  debounceMs = 500,
  enabled = true,
  useApi = false,
}: UseSpamScoreOptions): UseSpamScoreReturn {
  const [result, setResult] = useState<SpamScoreResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Track last analyzed content to avoid redundant analysis
  const lastContentRef = useRef<string>('');
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Get spam score service instance (for local analysis)
  const spamService = useMemo(() => SpamScoreService.getInstance(), []);

  /**
   * Perform local analysis (synchronous, no API call)
   */
  const analyzeLocal = useCallback(() => {
    try {
      const analysisResult = spamService.analyze({
        subject,
        body,
        isHtml,
      });
      setResult(analysisResult);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
      setResult(null);
    } finally {
      setIsLoading(false);
    }
  }, [subject, body, isHtml, spamService]);

  /**
   * Perform API-based analysis
   */
  const analyzeApi = useCallback(async () => {
    // Cancel any pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      // Get auth token
      if (!auth?.currentUser) {
        throw new Error('Authentication required');
      }
      const token = await auth.currentUser.getIdToken();

      const response = await fetch('/api/email/spam-check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          subject,
          body,
          isHtml,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      setResult(data);
      setError(null);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        // Request was cancelled, ignore
        return;
      }
      setError(err instanceof Error ? err.message : 'Analysis failed');
      setResult(null);
    } finally {
      setIsLoading(false);
    }
  }, [subject, body, isHtml]);

  /**
   * Run analysis with debouncing
   */
  const runAnalysis = useCallback(() => {
    // Create content hash to check for changes
    const contentHash = `${subject}|${body}|${isHtml}`;
    
    // Skip if content hasn't changed
    if (contentHash === lastContentRef.current && result !== null) {
      return;
    }
    
    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Don't analyze if content is too short
    if (subject.length === 0 && body.length === 0) {
      setResult(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    // Debounce the analysis
    debounceTimerRef.current = setTimeout(() => {
      lastContentRef.current = contentHash;
      
      if (useApi) {
        analyzeApi();
      } else {
        analyzeLocal();
      }
    }, debounceMs);
  }, [subject, body, isHtml, debounceMs, useApi, result, analyzeLocal, analyzeApi]);

  /**
   * Manual refresh function
   */
  const refresh = useCallback(() => {
    lastContentRef.current = ''; // Reset to force re-analysis
    runAnalysis();
  }, [runAnalysis]);

  // Run analysis when content changes
  useEffect(() => {
    if (!enabled) {
      setResult(null);
      setIsLoading(false);
      return;
    }

    runAnalysis();

    // Cleanup on unmount
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [enabled, runAnalysis]);

  // Computed: Score color
  const scoreColor = useMemo(() => {
    if (!result) return 'text-slate-500';
    if (result.score <= 20) return 'text-green-600';
    if (result.score <= 40) return 'text-yellow-600';
    if (result.score <= 60) return 'text-orange-600';
    return 'text-red-600';
  }, [result]);

  // Computed: Level badge color
  const levelColor = useMemo(() => {
    if (!result) return 'bg-slate-100 text-slate-600';
    switch (result.level) {
      case 'low':
        return 'bg-green-100 text-green-700';
      case 'medium':
        return 'bg-yellow-100 text-yellow-700';
      case 'high':
        return 'bg-orange-100 text-orange-700';
      case 'critical':
        return 'bg-red-100 text-red-700';
    }
  }, [result]);

  // Computed: Is safe to send
  const isSafeToSend = useMemo(() => {
    return result?.level === 'low';
  }, [result]);

  // Computed: Has critical issues
  const hasCriticalIssues = useMemo(() => {
    return result?.level === 'critical' || 
           (result?.issues.some(i => i.severity >= 5) ?? false);
  }, [result]);

  // Helper: Get top N issues by severity
  const getTopIssues = useCallback((n = 3): SpamIssue[] => {
    if (!result) return [];
    return [...result.issues]
      .sort((a, b) => b.severity - a.severity)
      .slice(0, n);
  }, [result]);

  // Helper: Check if category has issues
  const hasIssueCategory = useCallback((category: string): boolean => {
    return result?.issues.some(i => i.category === category) ?? false;
  }, [result]);

  return {
    result,
    isLoading,
    error,
    refresh,
    scoreColor,
    levelColor,
    isSafeToSend,
    hasCriticalIssues,
    getTopIssues,
    hasIssueCategory,
  };
}

export type { SpamScoreResult, SpamIssue };
