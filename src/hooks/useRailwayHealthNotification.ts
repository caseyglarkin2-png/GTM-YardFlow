/**
 * useRailwayHealthNotification Hook - Sprint V34 P1.1
 * 
 * Shows toast notification when Railway backend becomes unhealthy,
 * letting users know the app is operating in fallback mode.
 */

import { useEffect, useRef } from 'react';
import { useRailwayHealth, type RailwayHealthStatus } from './useRailwayHealth';
import { shouldUseRailwayEmail } from '@/config/featureFlags';

interface UseRailwayHealthNotificationProps {
  /** Toast function to show warning */
  showWarning: (title: string, description?: string) => void;
  /** Toast function to show info/success */
  showInfo: (title: string, description?: string) => void;
}

/**
 * Hook that monitors Railway health and shows toast notifications
 * when connection status changes.
 * 
 * Usage:
 * ```tsx
 * const { warning, info } = useToast();
 * useRailwayHealthNotification({ showWarning: warning, showInfo: info });
 * ```
 */
export function useRailwayHealthNotification({
  showWarning,
  showInfo,
}: UseRailwayHealthNotificationProps): void {
  const { status } = useRailwayHealth();
  const prevStatusRef = useRef<RailwayHealthStatus>('checking');
  const hasNotifiedUnhealthy = useRef(false);

  useEffect(() => {
    // Skip if Railway email is not enabled
    if (!shouldUseRailwayEmail()) {
      return;
    }

    const prevStatus = prevStatusRef.current;
    prevStatusRef.current = status;

    // Skip initial checking state
    if (prevStatus === 'checking') {
      return;
    }

    // Went from healthy to unhealthy
    if (status === 'unhealthy' && prevStatus === 'healthy' && !hasNotifiedUnhealthy.current) {
      hasNotifiedUnhealthy.current = true;
      showWarning(
        'Railway Offline',
        'Using local fallback mode. Email features may be limited.'
      );
    }

    // Recovered from unhealthy to healthy
    if (status === 'healthy' && prevStatus === 'unhealthy' && hasNotifiedUnhealthy.current) {
      hasNotifiedUnhealthy.current = false;
      showInfo(
        'Railway Connected',
        'Full email functionality restored.'
      );
    }
  }, [status, showWarning, showInfo]);
}

export default useRailwayHealthNotification;
