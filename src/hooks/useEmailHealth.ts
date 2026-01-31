/**
 * useEmailHealth Hook
 * 
 * Sprint 101: T101.3 - Email Health Indicator
 * 
 * Shows which email backend is currently active (Railway vs Vercel)
 * and its health status. This helps Jake understand at a glance
 * whether emails will work.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  featureFlags, 
  shouldUseRailwayEmail,
  getFeatureFlagSummary 
} from '@/config/featureFlags';

// =============================================================================
// Types
// =============================================================================

export type EmailBackend = 'railway' | 'vercel';
export type EmailHealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'checking';

export interface EmailHealthState {
  /** Which backend is currently active */
  backend: EmailBackend;
  /** Current health status */
  status: EmailHealthStatus;
  /** Human-readable status message */
  message: string;
  /** Whether email sending is available */
  canSendEmail: boolean;
  /** Last health check time */
  lastCheck: Date | null;
  /** Error details if unhealthy */
  error: string | null;
  /** Detailed checks for debugging */
  checks: {
    sendgridApiKey: boolean;
    sendgridFromEmail: boolean;
    trackingSecret: boolean;
    unsubscribeSecret: boolean;
    firebaseConfigured: boolean;
  } | null;
}

export interface UseEmailHealthReturn {
  /** Current health state */
  data: EmailHealthState;
  /** Whether a health check is in progress */
  isLoading: boolean;
  /** Trigger a manual health check */
  refresh: () => Promise<void>;
  /** Start automatic polling */
  startPolling: () => void;
  /** Stop automatic polling */
  stopPolling: () => void;
}

// =============================================================================
// Default State
// =============================================================================

const DEFAULT_STATE: EmailHealthState = {
  backend: 'vercel',
  status: 'checking',
  message: 'Checking email health...',
  canSendEmail: false,
  lastCheck: null,
  error: null,
  checks: null,
};

// =============================================================================
// Hook Implementation
// =============================================================================

export function useEmailHealth(pollInterval = 60000): UseEmailHealthReturn {
  const [data, setData] = useState<EmailHealthState>(DEFAULT_STATE);
  const [isLoading, setIsLoading] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isCheckingRef = useRef(false);

  const checkHealth = useCallback(async () => {
    if (isCheckingRef.current) return;
    isCheckingRef.current = true;
    
    try {
      // Determine which backend is configured
      const useRailway = shouldUseRailwayEmail();
      const backend: EmailBackend = useRailway ? 'railway' : 'vercel';
      console.log(`📧 Email Health Check: Using ${backend} backend`);
      
      if (useRailway) {
        // Check Railway health
        const response = await fetch('/api/railway/health');
        
        if (response.ok) {
          const health = await response.json();
          setData({
            backend: 'railway',
            status: health.status === 'healthy' ? 'healthy' : 'degraded',
            message: health.status === 'healthy' 
              ? 'Railway email service is healthy' 
              : 'Railway email service is degraded',
            canSendEmail: health.status === 'healthy',
            lastCheck: new Date(),
            error: null,
            checks: null,
          });
        } else {
          setData({
            backend: 'railway',
            status: 'unhealthy',
            message: 'Railway email service is unavailable',
            canSendEmail: false,
            lastCheck: new Date(),
            error: `Health check failed: ${response.status}`,
            checks: null,
          });
        }
      } else {
        // Check Vercel SendGrid health
        const response = await fetch('/api/email/health');
        
        if (response.ok) {
          const health = await response.json();
          setData({
            backend: 'vercel',
            status: health.status === 'healthy' ? 'healthy' : 'degraded',
            message: health.status === 'healthy' 
              ? 'Vercel SendGrid is ready' 
              : 'Vercel email has configuration issues',
            canSendEmail: health.status === 'healthy',
            lastCheck: new Date(),
            error: health.missing?.length ? `Missing: ${health.missing.join(', ')}` : null,
            checks: health.checks || null,
          });
        } else {
          setData({
            backend: 'vercel',
            status: 'unhealthy',
            message: 'Vercel email service is unavailable',
            canSendEmail: false,
            lastCheck: new Date(),
            error: `Health check failed: ${response.status}`,
            checks: null,
          });
        }
      }
    } catch (err) {
      setData(prev => ({
        ...prev,
        status: 'unhealthy',
        message: 'Failed to check email health',
        canSendEmail: false,
        lastCheck: new Date(),
        error: err instanceof Error ? err.message : 'Unknown error',
      }));
    } finally {
      isCheckingRef.current = false;
      setIsLoading(false);
    }
  }, []);

  const startPolling = useCallback(() => {
    if (intervalRef.current) return;
    intervalRef.current = setInterval(checkHealth, pollInterval);
  }, [checkHealth, pollInterval]);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Initial check and start polling
  useEffect(() => {
    checkHealth();
    startPolling();
    
    return () => stopPolling();
  }, [checkHealth, startPolling, stopPolling]);

  // Log feature flag summary in dev mode
  useEffect(() => {
    if (featureFlags.DEBUG_FEATURE_FLAGS) {
      console.log('📧 Email Health - Feature Flags:', getFeatureFlagSummary());
    }
  }, []);

  return {
    data,
    isLoading,
    refresh: checkHealth,
    startPolling,
    stopPolling,
  };
}

export default useEmailHealth;
