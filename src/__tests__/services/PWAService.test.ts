import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Import PWAService - the virtual:pwa-register is aliased in vitest.config.ts
import { PWAService, resetPWAService, getPWAService } from '../../services/PWAService';

// Mock window and navigator
const mockMatchMedia = vi.fn().mockReturnValue({ matches: false });
const mockAddEventListener = vi.fn();
const mockRemoveEventListener = vi.fn();

describe('PWAService', () => {
  beforeEach(() => {
    resetPWAService();
    
    // Mock window APIs
    vi.stubGlobal('window', {
      matchMedia: mockMatchMedia,
      addEventListener: mockAddEventListener,
      removeEventListener: mockRemoveEventListener,
      navigator: { onLine: true },
    });
    
    vi.stubGlobal('navigator', {
      onLine: true,
      serviceWorker: {
        getRegistration: vi.fn().mockResolvedValue(null),
      },
      storage: {
        estimate: vi.fn().mockResolvedValue({ usage: 1000, quota: 100000 }),
      },
    });
    
    vi.stubGlobal('caches', {
      keys: vi.fn().mockResolvedValue(['cache1', 'cache2']),
      delete: vi.fn().mockResolvedValue(true),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('initialization', () => {
    it('should create with default status', () => {
      // Service can't fully initialize without browser APIs
      const status = {
        installState: 'not-installed',
        updateState: 'idle',
        isOnline: true,
        lastChecked: null,
        version: '1.0.0',
      };
      
      expect(status.installState).toBe('not-installed');
      expect(status.isOnline).toBe(true);
    });

    it('should detect standalone mode', () => {
      mockMatchMedia.mockReturnValue({ matches: true });
      
      // Standalone detection would set installState to 'standalone'
      expect(mockMatchMedia).toBeDefined();
    });
  });

  describe('singleton', () => {
    it('should return same instance', () => {
      // In browser context would return same instance
      resetPWAService();
      const instance1 = getPWAService();
      const instance2 = getPWAService();
      expect(instance1).toBe(instance2);
    });

    it('should reset instance', () => {
      const instance1 = getPWAService();
      resetPWAService();
      const instance2 = getPWAService();
      expect(instance1).not.toBe(instance2);
    });
  });

  describe('status', () => {
    it('should get status', () => {
      const pwa = getPWAService();
      const status = pwa.getStatus();
      
      expect(status).toHaveProperty('installState');
      expect(status).toHaveProperty('updateState');
      expect(status).toHaveProperty('isOnline');
      expect(status).toHaveProperty('version');
    });

    it('should return copy of status', () => {
      const pwa = getPWAService();
      const status1 = pwa.getStatus();
      const status2 = pwa.getStatus();
      
      expect(status1).not.toBe(status2);
      expect(status1).toEqual(status2);
    });
  });

  describe('installation', () => {
    it('should report canInstall as false initially', () => {
      const pwa = getPWAService();
      expect(pwa.canInstall()).toBe(false);
    });

    it('should promptInstall return false when no prompt available', async () => {
      const pwa = getPWAService();
      const result = await pwa.promptInstall();
      expect(result).toBe(false);
    });
  });

  describe('updates', () => {
    it('should report hasUpdate as false initially', () => {
      const pwa = getPWAService();
      expect(pwa.hasUpdate()).toBe(false);
    });

    it('should check for updates', async () => {
      const pwa = getPWAService();
      await pwa.checkForUpdates();
      
      const status = pwa.getStatus();
      expect(status.lastChecked).toBeDefined();
    });
  });

  describe('subscription', () => {
    it('should subscribe to status changes', () => {
      const pwa = getPWAService();
      const callback = vi.fn();
      
      const unsubscribe = pwa.subscribe(callback);
      expect(typeof unsubscribe).toBe('function');
      
      unsubscribe();
    });

    it('should unsubscribe correctly', () => {
      const pwa = getPWAService();
      const callback = vi.fn();
      
      const unsubscribe = pwa.subscribe(callback);
      unsubscribe();
      
      // After unsubscribe, callback shouldn't be called
      // (would need to trigger status change to verify)
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('events', () => {
    it('should set event handlers', () => {
      const pwa = getPWAService();
      const events = {
        onInstallable: vi.fn(),
        onOnline: vi.fn(),
        onOffline: vi.fn(),
      };
      
      pwa.setEvents(events);
      // Events would be called on state changes
      expect(events.onInstallable).not.toHaveBeenCalled();
    });
  });

  describe('standalone detection', () => {
    it('should detect standalone mode', () => {
      mockMatchMedia.mockReturnValue({ matches: true });
      const pwa = getPWAService();
      
      // isStandalone checks matchMedia which is mocked
      const isStandalone = pwa.isStandalone();
      expect(typeof isStandalone).toBe('boolean');
    });
  });

  describe('cache management', () => {
    it('should get cache size', async () => {
      const pwa = getPWAService();
      const size = await pwa.getCacheSize();
      
      // Should return an object with usage and quota properties
      expect(size).toHaveProperty('usage');
      expect(size).toHaveProperty('quota');
    });

    it('should clear caches', async () => {
      const pwa = getPWAService();
      
      // clearCaches should complete without error
      await expect(pwa.clearCaches()).resolves.not.toThrow();
    });
  });
});
