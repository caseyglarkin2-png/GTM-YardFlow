/**
 * PWAService - YardFlow Hub
 * 
 * Progressive Web App service for installation, updates,
 * and offline capability management.
 */

import { registerSW } from 'virtual:pwa-register';

// ============================================
// Types
// ============================================

/**
 * PWA installation state
 */
export type InstallState = 'not-installed' | 'installable' | 'installed' | 'standalone';

/**
 * PWA update state
 */
export type UpdateState = 'idle' | 'checking' | 'available' | 'downloading' | 'ready';

/**
 * PWA events
 */
export interface PWAEvents {
  onInstallable?: () => void;
  onInstalled?: () => void;
  onUpdateAvailable?: () => void;
  onUpdateReady?: () => void;
  onOffline?: () => void;
  onOnline?: () => void;
}

/**
 * PWA status
 */
export interface PWAStatus {
  installState: InstallState;
  updateState: UpdateState;
  isOnline: boolean;
  lastChecked: Date | null;
  version: string;
}

// ============================================
// PWAService
// ============================================

export class PWAService {
  private installPrompt: BeforeInstallPromptEvent | null = null;
  private updateSW: ((reloadPage?: boolean) => Promise<void>) | null = null;
  private status: PWAStatus = {
    installState: 'not-installed',
    updateState: 'idle',
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    lastChecked: null,
    version: '1.0.0',
  };
  private listeners: Set<(status: PWAStatus) => void> = new Set();
  private events: PWAEvents = {};

  constructor() {
    if (typeof window !== 'undefined') {
      this.init();
    }
  }

  /**
   * Initialize PWA service
   */
  private init(): void {
    // Check if already installed as standalone
    if (window.matchMedia('(display-mode: standalone)').matches) {
      this.status.installState = 'standalone';
    }

    // Listen for install prompt
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.installPrompt = e as BeforeInstallPromptEvent;
      this.status.installState = 'installable';
      this.events.onInstallable?.();
      this.notify();
    });

    // Listen for successful install
    window.addEventListener('appinstalled', () => {
      this.installPrompt = null;
      this.status.installState = 'installed';
      this.events.onInstalled?.();
      this.notify();
    });

    // Listen for online/offline
    window.addEventListener('online', () => {
      this.status.isOnline = true;
      this.events.onOnline?.();
      this.notify();
    });

    window.addEventListener('offline', () => {
      this.status.isOnline = false;
      this.events.onOffline?.();
      this.notify();
    });

    // Register service worker
    this.registerServiceWorker();
  }

  /**
   * Register service worker with update handling
   */
  private registerServiceWorker(): void {
    try {
      this.updateSW = registerSW({
        onNeedRefresh: () => {
          this.status.updateState = 'ready';
          this.events.onUpdateReady?.();
          this.notify();
        },
        onOfflineReady: () => {
          console.log('[PWA] Offline ready');
        },
        onRegistered: (registration) => {
          if (registration) {
            // Check for updates periodically
            setInterval(() => {
              registration.update();
            }, 60 * 60 * 1000); // Every hour
          }
        },
        onRegisterError: (error) => {
          console.error('[PWA] Registration error:', error);
        },
      });
    } catch (e) {
      // Service worker registration not supported or failed
      console.warn('[PWA] Service worker not available:', e);
    }
  }

  /**
   * Get current status
   */
  getStatus(): PWAStatus {
    return { ...this.status };
  }

  /**
   * Check if app can be installed
   */
  canInstall(): boolean {
    return this.installPrompt !== null;
  }

  /**
   * Prompt user to install
   */
  async promptInstall(): Promise<boolean> {
    if (!this.installPrompt) {
      return false;
    }

    this.installPrompt.prompt();
    const result = await this.installPrompt.userChoice;

    if (result.outcome === 'accepted') {
      this.installPrompt = null;
      return true;
    }

    return false;
  }

  /**
   * Check if update is available
   */
  hasUpdate(): boolean {
    return this.status.updateState === 'ready';
  }

  /**
   * Apply update and reload
   */
  async applyUpdate(): Promise<void> {
    if (this.updateSW) {
      await this.updateSW(true);
    }
  }

  /**
   * Check for updates manually
   */
  async checkForUpdates(): Promise<void> {
    this.status.updateState = 'checking';
    this.status.lastChecked = new Date();
    this.notify();

    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        await registration.update();
      }
    }

    this.status.updateState = 'idle';
    this.notify();
  }

  /**
   * Subscribe to status changes
   */
  subscribe(callback: (status: PWAStatus) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Set event handlers
   */
  setEvents(events: PWAEvents): void {
    this.events = { ...this.events, ...events };
  }

  /**
   * Notify listeners
   */
  private notify(): void {
    const status = this.getStatus();
    for (const listener of this.listeners) {
      listener(status);
    }
  }

  /**
   * Check if running as PWA
   */
  isStandalone(): boolean {
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true
    );
  }

  /**
   * Get cache storage estimate
   */
  async getCacheSize(): Promise<{ usage: number; quota: number } | null> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      return {
        usage: estimate.usage || 0,
        quota: estimate.quota || 0,
      };
    }
    return null;
  }

  /**
   * Clear all caches
   */
  async clearCaches(): Promise<void> {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
  }
}

// ============================================
// BeforeInstallPromptEvent Type
// ============================================

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
  prompt(): Promise<void>;
}

// ============================================
// Singleton
// ============================================

let pwaInstance: PWAService | null = null;

export function getPWAService(): PWAService {
  if (!pwaInstance) {
    pwaInstance = new PWAService();
  }
  return pwaInstance;
}

export function resetPWAService(): void {
  pwaInstance = null;
}
