import { useCallback, useEffect, useRef, useState } from 'react';
import { shouldUseRailwayEmail } from '@/config/featureFlags';

export type RailwayHealthStatus = 'checking' | 'healthy' | 'unhealthy';

interface HealthState {
  status: RailwayHealthStatus;
  lastCheck: number | null;
}

const DEFAULT_INTERVAL_MS = 60000;
const HEALTH_ENDPOINT = '/api/railway/health';
const REQUEST_TIMEOUT_MS = 5000;

export function useRailwayHealth(intervalMs: number = DEFAULT_INTERVAL_MS) {
  const [health, setHealth] = useState<HealthState>({ status: 'checking', lastCheck: null });
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<number | null>(null);

  const checkHealth = useCallback(async () => {
    if (!shouldUseRailwayEmail()) {
      // If Railway email is disabled, treat as healthy to avoid blocking UI.
      setHealth({ status: 'healthy', lastCheck: Date.now() });
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(HEALTH_ENDPOINT, { signal: controller.signal });
      setHealth({ status: response.ok ? 'healthy' : 'unhealthy', lastCheck: Date.now() });
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setHealth({ status: 'unhealthy', lastCheck: Date.now() });
      }
    } finally {
      clearTimeout(timeout);
    }
  }, []);

  useEffect(() => {
    void checkHealth();
    timerRef.current = window.setInterval(() => void checkHealth(), intervalMs);
    return () => {
      abortRef.current?.abort();
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [checkHealth, intervalMs]);

  const refresh = useCallback(() => {
    void checkHealth();
  }, [checkHealth]);

  return {
    status: health.status,
    lastCheck: health.lastCheck,
    isHealthy: health.status === 'healthy',
    refresh,
  };
}
