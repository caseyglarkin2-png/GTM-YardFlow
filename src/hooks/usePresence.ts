/**
 * Presence Hook
 * Sprint 34 - T34.4
 * 
 * React hook for managing real-time user presence.
 * Wraps PresenceService and tracks view navigation.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { createPresenceService, type PresenceService, type UserPresence, type PresenceStatus } from '../services/PresenceService';

export interface UsePresenceConfig {
  tenantId: string;
  userId: string;
  displayName: string;
  email?: string;
  avatarUrl?: string;
  enabled?: boolean;
}

export interface UsePresenceResult {
  /** The presence service instance (for PresenceIndicator) */
  service: PresenceService | null;
  /** Current user's status */
  myStatus: PresenceStatus;
  /** All active users */
  activeUsers: UserPresence[];
  /** Count of online users */
  onlineCount: number;
  /** Is presence service ready */
  isReady: boolean;
  /** Set the current view (for tracking navigation) */
  setView: (view: string, docId?: string) => void;
  /** Clear current view */
  clearView: () => void;
  /** Get users viewing a specific document */
  getUsersViewingDoc: (docId: string) => UserPresence[];
  /** Get users in a specific view */
  getUsersInView: (view: string) => UserPresence[];
}

/**
 * Hook for managing presence with real-time updates
 */
export function usePresence(config: UsePresenceConfig): UsePresenceResult {
  const [service, setService] = useState<PresenceService | null>(null);
  const [myStatus, setMyStatus] = useState<PresenceStatus>('offline');
  const [activeUsers, setActiveUsers] = useState<UserPresence[]>([]);
  const [isReady, setIsReady] = useState(false);
  
  const serviceRef = useRef<PresenceService | null>(null);

  // Initialize presence service
  useEffect(() => {
    // Skip if disabled or missing required config
    if (config.enabled === false || !config.userId || !config.tenantId) {
      setService(null);
      setIsReady(false);
      return;
    }

    // Create the presence service
    const presenceService = createPresenceService({
      tenantId: config.tenantId,
      userId: config.userId,
      displayName: config.displayName,
      email: config.email,
      avatarUrl: config.avatarUrl,
    });

    serviceRef.current = presenceService;
    setService(presenceService);
    setIsReady(true);

    // Subscribe to presence updates
    const unsubscribe = presenceService.subscribe((users) => {
      setActiveUsers(users.filter(u => u.status !== 'offline'));
      
      // Update my status
      const myPresence = users.find(u => u.userId === config.userId);
      if (myPresence) {
        setMyStatus(myPresence.status);
      }
    });

    return () => {
      unsubscribe();
      presenceService.destroy();
      serviceRef.current = null;
      setService(null);
      setIsReady(false);
    };
  }, [config.tenantId, config.userId, config.displayName, config.email, config.avatarUrl, config.enabled]);

  // Set current view
  const setView = useCallback((view: string, docId?: string) => {
    serviceRef.current?.setCurrentView(view, docId);
  }, []);

  // Clear current view
  const clearView = useCallback(() => {
    serviceRef.current?.clearCurrentView();
  }, []);

  // Get users viewing a specific document
  const getUsersViewingDoc = useCallback((docId: string): UserPresence[] => {
    return serviceRef.current?.getUsersViewingDoc(docId) ?? [];
  }, []);

  // Get users in a specific view
  const getUsersInView = useCallback((view: string): UserPresence[] => {
    return serviceRef.current?.getUsersInView(view) ?? [];
  }, []);

  // Calculate online count
  const onlineCount = activeUsers.filter(u => u.status === 'online').length;

  return {
    service,
    myStatus,
    activeUsers,
    onlineCount,
    isReady,
    setView,
    clearView,
    getUsersViewingDoc,
    getUsersInView,
  };
}

/**
 * Hook for tracking view changes and updating presence
 */
export function usePresenceViewTracker(
  service: PresenceService | null,
  view: string,
  docId?: string
): void {
  useEffect(() => {
    if (!service) return;
    
    service.setCurrentView(view, docId);
    
    return () => {
      // Only clear if we're unmounting (not on view change)
      // The next view will override this anyway
    };
  }, [service, view, docId]);
}

export default usePresence;
