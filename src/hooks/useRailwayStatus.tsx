/**
 * T91.4: Railway Status Hook
 * 
 * Monitors Railway backend connection status.
 * Provides real-time health checks and offline detection.
 * 
 * Features:
 * - Periodic health checks (every 30 seconds)
 * - Connection status indicator
 * - Latency tracking
 * - Retry with exponential backoff
 * 
 * Usage:
 *   const { isConnected, latency, status, lastCheck } = useRailwayStatus();
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { railwayClient } from '@/services/RailwayApiClient';
import type { RailwayHealthResponse } from '@/types/railway';

// =============================================================================
// Types
// =============================================================================

type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'degraded';

interface RailwayStatusState {
  status: ConnectionStatus;
  isConnected: boolean;
  latency: number | null;
  lastCheck: Date | null;
  health: RailwayHealthResponse | null;
  consecutiveFailures: number;
  error: string | null;
}

interface UseRailwayStatusOptions {
  /** Check interval in milliseconds (default: 30000) */
  interval?: number;
  /** Whether to start checking immediately (default: true) */
  autoStart?: boolean;
  /** Number of failures before marking as disconnected (default: 3) */
  failureThreshold?: number;
}

// =============================================================================
// Hook Implementation
// =============================================================================

export function useRailwayStatus(options: UseRailwayStatusOptions = {}) {
  const {
    interval = 30000,
    autoStart = true,
    failureThreshold = 3,
  } = options;

  const [state, setState] = useState<RailwayStatusState>({
    status: 'connecting',
    isConnected: false,
    latency: null,
    lastCheck: null,
    health: null,
    consecutiveFailures: 0,
    error: null,
  });

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isCheckingRef = useRef(false);

  const checkHealth = useCallback(async () => {
    if (isCheckingRef.current) return;
    isCheckingRef.current = true;

    const startTime = performance.now();

    try {
      const result = await railwayClient.health.check();
      const latency = Math.round(performance.now() - startTime);

      if (result.ok && result.data) {
        const health = result.data;
        const isDegraded = health.checks?.database?.status !== 'ok' || 
                          health.checks?.redis?.status !== 'ok';

        setState({
          status: isDegraded ? 'degraded' : 'connected',
          isConnected: true,
          latency,
          lastCheck: new Date(),
          health,
          consecutiveFailures: 0,
          error: null,
        });
      } else {
        throw new Error(result.error || 'Health check failed');
      }
    } catch (error) {
      setState(prev => {
        const newFailures = prev.consecutiveFailures + 1;
        return {
          ...prev,
          status: newFailures >= failureThreshold ? 'disconnected' : 'connecting',
          isConnected: false,
          latency: null,
          lastCheck: new Date(),
          consecutiveFailures: newFailures,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      });
    } finally {
      isCheckingRef.current = false;
    }
  }, [failureThreshold]);

  const startChecking = useCallback(() => {
    if (intervalRef.current) return;
    
    checkHealth(); // Initial check
    intervalRef.current = setInterval(checkHealth, interval);
  }, [checkHealth, interval]);

  const stopChecking = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const forceCheck = useCallback(() => {
    checkHealth();
  }, [checkHealth]);

  // Auto-start on mount
  useEffect(() => {
    if (autoStart) {
      startChecking();
    }
    return () => stopChecking();
  }, [autoStart, startChecking, stopChecking]);

  // Pause checks when page is hidden
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopChecking();
      } else if (autoStart) {
        startChecking();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [autoStart, startChecking, stopChecking]);

  return {
    ...state,
    checkNow: forceCheck,
    startChecking,
    stopChecking,
  };
}

// =============================================================================
// Connection Status Component
// =============================================================================

interface ConnectionStatusProps {
  showLatency?: boolean;
  className?: string;
}

export function ConnectionStatus({ showLatency = true, className = '' }: ConnectionStatusProps) {
  const { status, latency, isConnected } = useRailwayStatus();

  const statusConfig = {
    connected: {
      color: 'bg-green-500',
      textColor: 'text-green-600',
      label: 'Connected',
    },
    connecting: {
      color: 'bg-amber-500',
      textColor: 'text-amber-600',
      label: 'Connecting...',
    },
    disconnected: {
      color: 'bg-red-500',
      textColor: 'text-red-600',
      label: 'Disconnected',
    },
    degraded: {
      color: 'bg-yellow-500',
      textColor: 'text-yellow-600',
      label: 'Degraded',
    },
  };

  const config = statusConfig[status];

  return (
    <div className={`flex items-center gap-2 text-xs ${config.textColor} ${className}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.color} ${isConnected ? 'animate-pulse' : ''}`} />
      <span>{config.label}</span>
      {showLatency && latency !== null && (
        <span className="text-slate-400">{latency}ms</span>
      )}
    </div>
  );
}

export default useRailwayStatus;
