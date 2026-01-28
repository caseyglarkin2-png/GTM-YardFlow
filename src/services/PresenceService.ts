/**
 * Presence Service
 * Sprint 27 - T27.5
 * 
 * Real-time presence system showing who's online, idle, or offline.
 */

export type PresenceStatus = 'online' | 'idle' | 'offline';

export interface UserPresence {
  userId: string;
  displayName: string;
  email?: string;
  avatarUrl?: string;
  status: PresenceStatus;
  lastActive: string;
  currentView?: string;
  viewingDocId?: string;
}

export interface PresenceUpdate {
  status: PresenceStatus;
  currentView?: string;
  viewingDocId?: string;
}

export interface PresenceServiceConfig {
  tenantId: string;
  userId: string;
  displayName: string;
  email?: string;
  avatarUrl?: string;
  heartbeatInterval?: number; // ms
  idleTimeout?: number; // ms
  offlineTimeout?: number; // ms
}

const DEFAULT_CONFIG = {
  heartbeatInterval: 30000, // 30 seconds
  idleTimeout: 120000, // 2 minutes
  offlineTimeout: 300000, // 5 minutes
};

export type PresenceCallback = (users: UserPresence[]) => void;
export type Unsubscribe = () => void;

/**
 * Create Presence Service
 */
export function createPresenceService(config: PresenceServiceConfig) {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  
  // In-memory presence store
  const presenceMap = new Map<string, UserPresence>();
  
  // Subscriptions
  const subscribers = new Set<PresenceCallback>();
  
  // Heartbeat interval
  let heartbeatId: ReturnType<typeof setInterval> | null = null;
  
  // Last activity timestamp
  let lastActivity = Date.now();
  
  // Current presence state
  let currentStatus: PresenceStatus = 'online';
  let currentView: string | undefined;
  let viewingDocId: string | undefined;
  
  // Idle detection
  let idleTimeoutId: ReturnType<typeof setTimeout> | null = null;

  // ==========================================================================
  // Initialization
  // ==========================================================================

  function init(): void {
    // Set initial presence
    updateMyPresence({ status: 'online' });
    
    // Start heartbeat
    startHeartbeat();
    
    // Set up activity listeners
    if (typeof window !== 'undefined') {
      const activityEvents = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'];
      activityEvents.forEach(event => {
        window.addEventListener(event, handleActivity, { passive: true });
      });
      
      // Visibility change
      document.addEventListener('visibilitychange', handleVisibilityChange);
      
      // Unload
      window.addEventListener('beforeunload', handleUnload);
    }
  }

  function destroy(): void {
    // Set offline status
    updateMyPresence({ status: 'offline' });
    
    // Stop heartbeat
    stopHeartbeat();
    
    // Clear idle timeout
    if (idleTimeoutId) {
      clearTimeout(idleTimeoutId);
      idleTimeoutId = null;
    }
    
    // Remove activity listeners
    if (typeof window !== 'undefined') {
      const activityEvents = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'];
      activityEvents.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
      
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleUnload);
    }
    
    // Clear subscribers
    subscribers.clear();
    presenceMap.clear();
  }

  // ==========================================================================
  // Activity Tracking
  // ==========================================================================

  function handleActivity(): void {
    lastActivity = Date.now();
    
    // If was idle, go back to online
    if (currentStatus === 'idle') {
      updateMyPresence({ status: 'online' });
    }
    
    // Reset idle timeout
    resetIdleTimeout();
  }

  function resetIdleTimeout(): void {
    if (idleTimeoutId) {
      clearTimeout(idleTimeoutId);
    }
    
    idleTimeoutId = setTimeout(() => {
      if (currentStatus === 'online') {
        updateMyPresence({ status: 'idle' });
      }
    }, cfg.idleTimeout);
  }

  function handleVisibilityChange(): void {
    if (document.hidden) {
      // Tab hidden - mark as idle after a short delay
      setTimeout(() => {
        if (document.hidden && currentStatus === 'online') {
          updateMyPresence({ status: 'idle' });
        }
      }, 5000);
    } else {
      // Tab visible - mark as online
      handleActivity();
    }
  }

  function handleUnload(): void {
    updateMyPresence({ status: 'offline' });
  }

  // ==========================================================================
  // Heartbeat
  // ==========================================================================

  function startHeartbeat(): void {
    if (heartbeatId) return;
    
    heartbeatId = setInterval(() => {
      sendHeartbeat();
    }, cfg.heartbeatInterval);
  }

  function stopHeartbeat(): void {
    if (heartbeatId) {
      clearInterval(heartbeatId);
      heartbeatId = null;
    }
  }

  function sendHeartbeat(): void {
    // Update last active
    const myPresence = getMyPresence();
    if (myPresence) {
      myPresence.lastActive = new Date().toISOString();
      presenceMap.set(cfg.userId, myPresence);
      notifySubscribers();
    }
    
    // Check for stale presences
    cleanupStalePresences();
  }

  function cleanupStalePresences(): void {
    const now = Date.now();
    const staleThreshold = cfg.offlineTimeout;
    
    for (const [userId, presence] of presenceMap.entries()) {
      if (userId === cfg.userId) continue; // Don't cleanup self
      
      const lastActiveTime = new Date(presence.lastActive).getTime();
      const timeSinceActive = now - lastActiveTime;
      
      if (timeSinceActive > staleThreshold) {
        // Mark as offline or remove
        if (presence.status !== 'offline') {
          presenceMap.set(userId, { ...presence, status: 'offline' });
        }
      } else if (timeSinceActive > cfg.idleTimeout && presence.status === 'online') {
        // Mark as idle
        presenceMap.set(userId, { ...presence, status: 'idle' });
      }
    }
    
    notifySubscribers();
  }

  // ==========================================================================
  // Presence Management
  // ==========================================================================

  function updateMyPresence(update: PresenceUpdate): void {
    currentStatus = update.status ?? currentStatus;
    currentView = update.currentView ?? currentView;
    viewingDocId = update.viewingDocId ?? viewingDocId;
    
    const presence: UserPresence = {
      userId: cfg.userId,
      displayName: cfg.displayName,
      email: cfg.email,
      avatarUrl: cfg.avatarUrl,
      status: currentStatus,
      lastActive: new Date().toISOString(),
      currentView,
      viewingDocId,
    };
    
    presenceMap.set(cfg.userId, presence);
    notifySubscribers();
  }

  function getMyPresence(): UserPresence | undefined {
    return presenceMap.get(cfg.userId);
  }

  function setCurrentView(view: string, docId?: string): void {
    updateMyPresence({ 
      status: currentStatus, 
      currentView: view, 
      viewingDocId: docId 
    });
  }

  function clearCurrentView(): void {
    currentView = undefined;
    viewingDocId = undefined;
    updateMyPresence({ status: currentStatus });
  }

  // ==========================================================================
  // External Presence Updates
  // ==========================================================================

  function updateUserPresence(userId: string, presence: UserPresence): void {
    if (userId === cfg.userId) return; // Don't overwrite own presence
    presenceMap.set(userId, presence);
    notifySubscribers();
  }

  function removeUserPresence(userId: string): void {
    if (userId === cfg.userId) return;
    presenceMap.delete(userId);
    notifySubscribers();
  }

  function setAllPresences(presences: UserPresence[]): void {
    // Keep own presence, replace others
    const myPresence = presenceMap.get(cfg.userId);
    presenceMap.clear();
    
    if (myPresence) {
      presenceMap.set(cfg.userId, myPresence);
    }
    
    for (const p of presences) {
      if (p.userId !== cfg.userId) {
        presenceMap.set(p.userId, p);
      }
    }
    
    notifySubscribers();
  }

  // ==========================================================================
  // Subscriptions
  // ==========================================================================

  function subscribe(callback: PresenceCallback): Unsubscribe {
    subscribers.add(callback);
    
    // Immediately call with current state
    callback(getAllPresences());
    
    return () => {
      subscribers.delete(callback);
    };
  }

  function notifySubscribers(): void {
    const presences = getAllPresences();
    for (const callback of subscribers) {
      try {
        callback(presences);
      } catch {
        // Callback error
      }
    }
  }

  // ==========================================================================
  // Queries
  // ==========================================================================

  function getAllPresences(): UserPresence[] {
    return Array.from(presenceMap.values());
  }

  function getOnlineUsers(): UserPresence[] {
    return getAllPresences().filter(p => p.status === 'online');
  }

  function getIdleUsers(): UserPresence[] {
    return getAllPresences().filter(p => p.status === 'idle');
  }

  function getActiveUsers(): UserPresence[] {
    return getAllPresences().filter(p => p.status !== 'offline');
  }

  function getUsersViewingDoc(docId: string): UserPresence[] {
    return getAllPresences().filter(
      p => p.viewingDocId === docId && p.status !== 'offline'
    );
  }

  function getUsersInView(view: string): UserPresence[] {
    return getAllPresences().filter(
      p => p.currentView === view && p.status !== 'offline'
    );
  }

  function getUserPresence(userId: string): UserPresence | undefined {
    return presenceMap.get(userId);
  }

  function getPresenceCount(): { online: number; idle: number; offline: number; total: number } {
    const all = getAllPresences();
    return {
      online: all.filter(p => p.status === 'online').length,
      idle: all.filter(p => p.status === 'idle').length,
      offline: all.filter(p => p.status === 'offline').length,
      total: all.length,
    };
  }

  // ==========================================================================
  // Status
  // ==========================================================================

  function getMyStatus(): PresenceStatus {
    return currentStatus;
  }

  function getTimeSinceActive(): number {
    return Date.now() - lastActivity;
  }

  // Initialize
  init();

  return {
    // Presence management
    updateMyPresence,
    getMyPresence,
    setCurrentView,
    clearCurrentView,
    getMyStatus,
    getTimeSinceActive,
    
    // External updates (for Firestore sync)
    updateUserPresence,
    removeUserPresence,
    setAllPresences,
    
    // Subscriptions
    subscribe,
    
    // Queries
    getAllPresences,
    getOnlineUsers,
    getIdleUsers,
    getActiveUsers,
    getUsersViewingDoc,
    getUsersInView,
    getUserPresence,
    getPresenceCount,
    
    // Lifecycle
    destroy,
    
    // Testing
    _handleActivity: handleActivity,
    _sendHeartbeat: sendHeartbeat,
  };
}

export type PresenceService = ReturnType<typeof createPresenceService>;
