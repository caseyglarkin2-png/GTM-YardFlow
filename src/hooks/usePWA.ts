/**
 * usePWA - YardFlow Hub
 * 
 * React hook for PWA installation, updates, and offline state.
 */

import { useState, useEffect, useCallback } from 'react';
import { getPWAService, type PWAStatus, type PWAEvents } from '../services/PWAService';

/**
 * Hook return type
 */
export interface UsePWAReturn {
  /** Current PWA status */
  status: PWAStatus;
  /** Whether app can be installed */
  canInstall: boolean;
  /** Whether an update is available */
  hasUpdate: boolean;
  /** Whether app is running as standalone PWA */
  isStandalone: boolean;
  /** Whether device is online */
  isOnline: boolean;
  /** Prompt user to install the app */
  promptInstall: () => Promise<boolean>;
  /** Apply available update */
  applyUpdate: () => Promise<void>;
  /** Check for updates manually */
  checkForUpdates: () => Promise<void>;
  /** Clear all service worker caches */
  clearCaches: () => Promise<void>;
}

/**
 * PWA management hook
 */
export function usePWA(events?: PWAEvents): UsePWAReturn {
  const [status, setStatus] = useState<PWAStatus>(() => {
    try {
      return getPWAService().getStatus();
    } catch {
      return {
        installState: 'not-installed',
        updateState: 'idle',
        isOnline: true,
        lastChecked: null,
        version: '1.0.0',
      };
    }
  });

  useEffect(() => {
    try {
      const pwa = getPWAService();

      // Subscribe to status changes
      const unsubscribe = pwa.subscribe(setStatus);

      // Set event handlers
      if (events) {
        pwa.setEvents(events);
      }

      return unsubscribe;
    } catch {
      // PWA not available
      return () => {};
    }
  }, [events]);

  const promptInstall = useCallback(async (): Promise<boolean> => {
    try {
      return await getPWAService().promptInstall();
    } catch {
      return false;
    }
  }, []);

  const applyUpdate = useCallback(async (): Promise<void> => {
    try {
      await getPWAService().applyUpdate();
    } catch {
      // Ignore errors
    }
  }, []);

  const checkForUpdates = useCallback(async (): Promise<void> => {
    try {
      await getPWAService().checkForUpdates();
    } catch {
      // Ignore errors
    }
  }, []);

  const clearCaches = useCallback(async (): Promise<void> => {
    try {
      await getPWAService().clearCaches();
    } catch {
      // Ignore errors
    }
  }, []);

  const canInstall = status.installState === 'installable';
  const hasUpdate = status.updateState === 'ready';
  const isStandalone = status.installState === 'standalone';
  const isOnline = status.isOnline;

  return {
    status,
    canInstall,
    hasUpdate,
    isStandalone,
    isOnline,
    promptInstall,
    applyUpdate,
    checkForUpdates,
    clearCaches,
  };
}
