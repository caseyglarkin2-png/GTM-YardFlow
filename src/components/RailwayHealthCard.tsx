/**
 * T1.1: RailwayHealthCard Component
 * 
 * Displays Railway backend health status including:
 * - Overall status (healthy/degraded/unhealthy)
 * - Database and Redis latency
 * - Queue status
 * - AI provider status with quota info
 * - Auto-refresh every 30 seconds
 */

import { useState, useEffect, useCallback } from 'react';
import { railwayClient } from '@/services/RailwayApiClient';
import type { RailwayHealthResponse, HealthCheckResult, AIProviderHealthCheck } from '@/types/railway';

const REFRESH_INTERVAL_MS = 30000; // 30 seconds

type OverallStatus = 'healthy' | 'degraded' | 'unhealthy';

interface RailwayHealthCardProps {
  /** Optional className for styling */
  className?: string;
  /** Show compact view (hides queues) */
  compact?: boolean;
}

export function RailwayHealthCard({ className = '', compact = false }: RailwayHealthCardProps) {
  const [health, setHealth] = useState<RailwayHealthResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchHealth = useCallback(async () => {
    try {
      const result = await railwayClient.health.check(true); // Force refresh
      if (result.ok && result.data) {
        setHealth(result.data);
        setError(null);
      } else {
        setError(result.error || 'Failed to fetch health');
      }
    } catch {
      setError('Railway unreachable');
    } finally {
      setIsLoading(false);
      setLastRefresh(new Date());
    }
  }, []);

  useEffect(() => {
    void fetchHealth();
    const interval = setInterval(() => void fetchHealth(), REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  if (isLoading) {
    return <HealthCardSkeleton className={className} />;
  }

  if (error) {
    return <HealthCardError error={error} onRetry={fetchHealth} className={className} />;
  }

  return (
    <div className={`bg-white rounded-lg shadow p-4 ${className}`} data-testid="railway-health-card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-medium text-gray-900">Railway Backend</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void fetchHealth()}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            title="Refresh"
            aria-label="Refresh health status"
          >
            <RefreshIcon />
          </button>
          <StatusBadge status={health?.status} />
        </div>
      </div>

      <div className="space-y-2">
        {/* Core Infrastructure */}
        <HealthRow
          label="Database"
          status={health?.checks.database.status}
          latencyMs={health?.checks.database.latencyMs}
        />
        <HealthRow
          label="Redis"
          status={health?.checks.redis.status}
          latencyMs={health?.checks.redis.latencyMs}
        />

        {/* AI Providers (if available) */}
        {health?.checks.ai && (
          <>
            <div className="border-t pt-2 mt-2">
              <span className="text-xs text-gray-500 uppercase tracking-wider">AI Providers</span>
            </div>
            <AIProviderRow
              label="Gemini"
              check={health.checks.ai.gemini}
            />
            <AIProviderRow
              label="OpenAI (fallback)"
              check={health.checks.ai.openai}
            />
          </>
        )}

        {/* Queue Status (if not compact) */}
        {!compact && health?.checks.queues && (
          <>
            <div className="border-t pt-2 mt-2">
              <span className="text-xs text-gray-500 uppercase tracking-wider">Queues</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <QueueStatus label="Enrichment" status={health.checks.queues.enrichment} />
              <QueueStatus label="Outreach" status={health.checks.queues.outreach} />
              <QueueStatus label="Emails" status={health.checks.queues.emails} />
              <QueueStatus label="Sequence" status={health.checks.queues.sequence} />
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-4 pt-2 border-t text-xs text-gray-400">
        {health?.version && <span>v{health.version}</span>}
        {lastRefresh && (
          <span>
            Updated {formatRelativeTime(lastRefresh)}
          </span>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Sub-components
// =============================================================================

function StatusBadge({ status }: { status?: OverallStatus }) {
  const colors: Record<OverallStatus, string> = {
    healthy: 'bg-green-100 text-green-800',
    degraded: 'bg-yellow-100 text-yellow-800',
    unhealthy: 'bg-red-100 text-red-800',
  };

  return (
    <span
      className={`px-2 py-1 text-xs font-medium rounded-full ${colors[status || 'unhealthy']}`}
      data-testid="status-badge"
    >
      {status || 'unknown'}
    </span>
  );
}

interface HealthRowProps {
  label: string;
  status?: HealthCheckResult['status'];
  latencyMs?: number;
}

function HealthRow({ label, status, latencyMs }: HealthRowProps) {
  const { icon, color } = getStatusIndicator(status);

  return (
    <div className="flex items-center justify-between text-sm" data-testid={`health-row-${label.toLowerCase()}`}>
      <span className="text-gray-600">{label}</span>
      <div className="flex items-center gap-2">
        {latencyMs !== undefined && (
          <span className="text-xs text-gray-400">{latencyMs}ms</span>
        )}
        <span className={color}>{icon}</span>
      </div>
    </div>
  );
}

interface AIProviderRowProps {
  label: string;
  check: AIProviderHealthCheck;
}

function AIProviderRow({ label, check }: AIProviderRowProps) {
  const { icon, color } = getStatusIndicator(check.status);

  return (
    <div className="flex items-center justify-between text-sm" data-testid={`ai-provider-${label.toLowerCase().replace(/\s+/g, '-')}`}>
      <span className="text-gray-600">{label}</span>
      <div className="flex items-center gap-2">
        {check.quotaRemaining !== undefined && (
          <span className="text-xs text-gray-400">
            {check.quotaRemaining} remaining
          </span>
        )}
        {check.latencyMs !== undefined && (
          <span className="text-xs text-gray-400">{check.latencyMs}ms</span>
        )}
        <span className={color}>{icon}</span>
      </div>
    </div>
  );
}

function QueueStatus({ label, status }: { label: string; status: 'ready' | 'paused' | 'error' }) {
  const colors: Record<string, string> = {
    ready: 'text-green-600',
    paused: 'text-yellow-600',
    error: 'text-red-600',
  };

  const icons: Record<string, string> = {
    ready: '●',
    paused: '⏸',
    error: '✗',
  };

  return (
    <div className="flex items-center gap-1">
      <span className={colors[status]}>{icons[status]}</span>
      <span className="text-gray-600">{label}</span>
    </div>
  );
}

function HealthCardSkeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`bg-white rounded-lg shadow p-4 animate-pulse ${className}`} data-testid="health-card-skeleton">
      <div className="flex items-center justify-between mb-4">
        <div className="h-5 w-32 bg-gray-200 rounded" />
        <div className="h-6 w-16 bg-gray-200 rounded-full" />
      </div>
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center justify-between">
            <div className="h-4 w-20 bg-gray-200 rounded" />
            <div className="h-4 w-12 bg-gray-200 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

interface HealthCardErrorProps {
  error: string;
  onRetry: () => void;
  className?: string;
}

function HealthCardError({ error, onRetry, className = '' }: HealthCardErrorProps) {
  return (
    <div className={`bg-white rounded-lg shadow p-4 ${className}`} data-testid="health-card-error">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-medium text-gray-900">Railway Backend</h3>
        <StatusBadge status="unhealthy" />
      </div>
      <div className="bg-red-50 border border-red-200 rounded p-3">
        <p className="text-sm text-red-700">{error}</p>
        <button
          onClick={onRetry}
          className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
        >
          Retry
        </button>
      </div>
    </div>
  );
}

function RefreshIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
      />
    </svg>
  );
}

// =============================================================================
// Helpers
// =============================================================================

function getStatusIndicator(status?: HealthCheckResult['status']): { icon: string; color: string } {
  switch (status) {
    case 'ok':
      return { icon: '✓', color: 'text-green-600' };
    case 'degraded':
      return { icon: '⚠', color: 'text-yellow-600' };
    case 'error':
    default:
      return { icon: '✗', color: 'text-red-600' };
  }
}

function formatRelativeTime(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

export default RailwayHealthCard;
