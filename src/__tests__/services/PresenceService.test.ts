/**
 * Presence Service Tests
 * Sprint 27 - T27.5
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createPresenceService, type PresenceService } from '../../services/PresenceService';

describe('PresenceService', () => {
  let service: PresenceService;

  beforeEach(() => {
    vi.useFakeTimers();
    
    service = createPresenceService({
      tenantId: 'test-tenant',
      userId: 'user1',
      displayName: 'Test User',
      email: 'test@example.com',
      heartbeatInterval: 30000,
      idleTimeout: 120000,
      offlineTimeout: 300000,
    });
  });

  afterEach(() => {
    service.destroy();
    vi.useRealTimers();
  });

  describe('createPresenceService', () => {
    it('creates service with config', () => {
      expect(service).toBeDefined();
      expect(service.getMyPresence).toBeDefined();
      expect(service.subscribe).toBeDefined();
    });

    it('initializes with online status', () => {
      expect(service.getMyStatus()).toBe('online');
    });

    it('sets initial presence', () => {
      const presence = service.getMyPresence();
      expect(presence).toBeDefined();
      expect(presence?.userId).toBe('user1');
      expect(presence?.displayName).toBe('Test User');
      expect(presence?.status).toBe('online');
    });
  });

  describe('updateMyPresence', () => {
    it('updates status', () => {
      service.updateMyPresence({ status: 'idle' });
      expect(service.getMyStatus()).toBe('idle');
    });

    it('updates current view', () => {
      service.setCurrentView('prospects', 'p1');
      
      const presence = service.getMyPresence();
      expect(presence?.currentView).toBe('prospects');
      expect(presence?.viewingDocId).toBe('p1');
    });

    it('clears current view', () => {
      service.setCurrentView('prospects', 'p1');
      service.clearCurrentView();
      
      const presence = service.getMyPresence();
      expect(presence?.currentView).toBeUndefined();
      expect(presence?.viewingDocId).toBeUndefined();
    });
  });

  describe('subscribe', () => {
    it('notifies on subscribe', () => {
      const callback = vi.fn();
      service.subscribe(callback);
      
      expect(callback).toHaveBeenCalledWith(expect.arrayContaining([
        expect.objectContaining({ userId: 'user1' }),
      ]));
    });

    it('notifies on presence update', () => {
      const callback = vi.fn();
      service.subscribe(callback);
      
      callback.mockClear();
      service.updateMyPresence({ status: 'idle' });
      
      expect(callback).toHaveBeenCalled();
    });

    it('unsubscribes correctly', () => {
      const callback = vi.fn();
      const unsubscribe = service.subscribe(callback);
      
      unsubscribe();
      callback.mockClear();
      
      service.updateMyPresence({ status: 'idle' });
      
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('external user presence', () => {
    it('updates external user presence', () => {
      service.updateUserPresence('user2', {
        userId: 'user2',
        displayName: 'Other User',
        status: 'online',
        lastActive: new Date().toISOString(),
      });

      const presence = service.getUserPresence('user2');
      expect(presence).toBeDefined();
      expect(presence?.displayName).toBe('Other User');
    });

    it('removes external user presence', () => {
      service.updateUserPresence('user2', {
        userId: 'user2',
        displayName: 'Other User',
        status: 'online',
        lastActive: new Date().toISOString(),
      });

      service.removeUserPresence('user2');
      
      const presence = service.getUserPresence('user2');
      expect(presence).toBeUndefined();
    });

    it('does not overwrite own presence', () => {
      service.updateUserPresence('user1', {
        userId: 'user1',
        displayName: 'Fake Name',
        status: 'offline',
        lastActive: new Date().toISOString(),
      });

      const presence = service.getMyPresence();
      expect(presence?.displayName).toBe('Test User');
      expect(presence?.status).toBe('online');
    });

    it('sets all presences', () => {
      service.setAllPresences([
        { userId: 'user2', displayName: 'User 2', status: 'online', lastActive: new Date().toISOString() },
        { userId: 'user3', displayName: 'User 3', status: 'idle', lastActive: new Date().toISOString() },
      ]);

      expect(service.getAllPresences()).toHaveLength(3); // Including self
      expect(service.getUserPresence('user2')).toBeDefined();
      expect(service.getUserPresence('user3')).toBeDefined();
    });
  });

  describe('queries', () => {
    beforeEach(() => {
      service.setAllPresences([
        { userId: 'user2', displayName: 'User 2', status: 'online', lastActive: new Date().toISOString() },
        { userId: 'user3', displayName: 'User 3', status: 'idle', lastActive: new Date().toISOString() },
        { userId: 'user4', displayName: 'User 4', status: 'offline', lastActive: new Date().toISOString() },
      ]);
    });

    it('gets all presences', () => {
      expect(service.getAllPresences()).toHaveLength(4);
    });

    it('gets online users', () => {
      const online = service.getOnlineUsers();
      expect(online).toHaveLength(2); // user1 and user2
      expect(online.every(u => u.status === 'online')).toBe(true);
    });

    it('gets idle users', () => {
      const idle = service.getIdleUsers();
      expect(idle).toHaveLength(1);
      expect(idle[0].userId).toBe('user3');
    });

    it('gets active users', () => {
      const active = service.getActiveUsers();
      expect(active).toHaveLength(3); // Excludes offline
    });

    it('gets presence count', () => {
      const count = service.getPresenceCount();
      expect(count.online).toBe(2);
      expect(count.idle).toBe(1);
      expect(count.offline).toBe(1);
      expect(count.total).toBe(4);
    });
  });

  describe('view filtering', () => {
    beforeEach(() => {
      service.setCurrentView('prospects', 'p1');
      service.setAllPresences([
        { 
          userId: 'user2', 
          displayName: 'User 2', 
          status: 'online', 
          lastActive: new Date().toISOString(),
          currentView: 'prospects',
          viewingDocId: 'p1',
        },
        { 
          userId: 'user3', 
          displayName: 'User 3', 
          status: 'online', 
          lastActive: new Date().toISOString(),
          currentView: 'prospects',
          viewingDocId: 'p2',
        },
        { 
          userId: 'user4', 
          displayName: 'User 4', 
          status: 'online', 
          lastActive: new Date().toISOString(),
          currentView: 'dashboard',
        },
      ]);
    });

    it('gets users viewing specific doc', () => {
      const viewers = service.getUsersViewingDoc('p1');
      expect(viewers).toHaveLength(2); // user1 and user2
    });

    it('gets users in specific view', () => {
      const viewers = service.getUsersInView('prospects');
      expect(viewers).toHaveLength(3); // user1, user2, user3
    });

    it('excludes offline users from view queries', () => {
      service.updateUserPresence('user2', {
        userId: 'user2',
        displayName: 'User 2',
        status: 'offline',
        lastActive: new Date().toISOString(),
        currentView: 'prospects',
        viewingDocId: 'p1',
      });

      const viewers = service.getUsersViewingDoc('p1');
      expect(viewers).toHaveLength(1);
    });
  });

  describe('activity tracking', () => {
    it('tracks time since activity', () => {
      expect(service.getTimeSinceActive()).toBe(0);
      
      vi.advanceTimersByTime(1000);
      
      expect(service.getTimeSinceActive()).toBe(1000);
    });

    it('resets on activity', () => {
      vi.advanceTimersByTime(5000);
      expect(service.getTimeSinceActive()).toBe(5000);
      
      service._handleActivity();
      
      expect(service.getTimeSinceActive()).toBe(0);
    });

    it('transitions to idle after timeout', () => {
      expect(service.getMyStatus()).toBe('online');
      
      // The idle timeout is set in resetIdleTimeout, which is called during handleActivity
      // We need to trigger activity first to start the idle timer, then advance past it
      service._handleActivity();
      
      // Advance past idle timeout (2 minutes = 120000ms)
      vi.advanceTimersByTime(130000);
      
      expect(service.getMyStatus()).toBe('idle');
    });

    it('transitions back to online on activity', () => {
      // Start the idle timer
      service._handleActivity();
      
      // Go idle
      vi.advanceTimersByTime(130000);
      expect(service.getMyStatus()).toBe('idle');
      
      // Activity
      service._handleActivity();
      
      expect(service.getMyStatus()).toBe('online');
    });
  });

  describe('heartbeat', () => {
    it('updates lastActive on heartbeat', () => {
      const initialPresence = service.getMyPresence();
      const initialTime = initialPresence?.lastActive;
      
      vi.advanceTimersByTime(30000); // Heartbeat interval
      
      const updatedPresence = service.getMyPresence();
      expect(updatedPresence?.lastActive).not.toBe(initialTime);
    });

    it('marks stale users as offline', () => {
      const pastTime = new Date(Date.now() - 400000).toISOString(); // 6+ minutes ago
      
      service.updateUserPresence('staleUser', {
        userId: 'staleUser',
        displayName: 'Stale User',
        status: 'online',
        lastActive: pastTime,
      });

      // Trigger heartbeat cleanup
      service._sendHeartbeat();
      
      const stalePresence = service.getUserPresence('staleUser');
      expect(stalePresence?.status).toBe('offline');
    });

    it('marks inactive users as idle', () => {
      const pastTime = new Date(Date.now() - 150000).toISOString(); // 2.5 minutes ago
      
      service.updateUserPresence('inactiveUser', {
        userId: 'inactiveUser',
        displayName: 'Inactive User',
        status: 'online',
        lastActive: pastTime,
      });

      service._sendHeartbeat();
      
      const presence = service.getUserPresence('inactiveUser');
      expect(presence?.status).toBe('idle');
    });
  });

  describe('destroy', () => {
    it('sets offline status on destroy', () => {
      const callback = vi.fn();
      service.subscribe(callback);
      
      service.destroy();
      
      // Last call should have offline status
      const lastCall = callback.mock.calls[callback.mock.calls.length - 1][0];
      const myPresence = lastCall.find((p: { userId: string }) => p.userId === 'user1');
      expect(myPresence?.status).toBe('offline');
    });

    it('clears subscribers on destroy', () => {
      const callback = vi.fn();
      service.subscribe(callback);
      
      service.destroy();
      callback.mockClear();
      
      // After destroy, no more updates
      // Create new service to test isolation
      const newService = createPresenceService({
        tenantId: 'test',
        userId: 'newUser',
        displayName: 'New',
      });
      
      expect(callback).not.toHaveBeenCalled();
      newService.destroy();
    });
  });
});
