/**
 * Firebase Client Configuration Tests
 * 
 * Sprint 901: App.tsx Decomposition - T901.1
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Firebase modules before importing
vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(() => ({ name: 'test-app' })),
  getApps: vi.fn(() => []),
}));

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({ currentUser: null })),
}));

vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(() => ({ type: 'firestore' })),
}));

describe('Firebase Client Configuration', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  describe('hasFirebaseConfig', () => {
    it('should be false when no config is provided', async () => {
      vi.stubEnv('VITE_FIREBASE_API_KEY', '');
      vi.stubEnv('VITE_FIREBASE_PROJECT_ID', '');
      
      const { hasFirebaseConfig } = await import('../../lib/firebase');
      expect(hasFirebaseConfig).toBe(false);
    });

    it('should be true when config is provided', async () => {
      vi.stubEnv('VITE_FIREBASE_API_KEY', 'test-api-key');
      vi.stubEnv('VITE_FIREBASE_PROJECT_ID', 'test-project');
      
      // Need to reset the module to pick up new env vars
      vi.resetModules();
      const { hasFirebaseConfig } = await import('../../lib/firebase');
      expect(hasFirebaseConfig).toBe(true);
    });
  });

  describe('singleton pattern', () => {
    it('should reuse existing Firebase app', async () => {
      const { getApps, initializeApp } = await import('firebase/app');
      
      // Simulate existing app
      vi.mocked(getApps).mockReturnValue([{ name: 'existing-app' } as never]);
      
      vi.stubEnv('VITE_FIREBASE_API_KEY', 'test-key');
      vi.stubEnv('VITE_FIREBASE_PROJECT_ID', 'test-project');
      
      vi.resetModules();
      await import('../../lib/firebase');
      
      // initializeApp should not be called when app already exists
      expect(initializeApp).not.toHaveBeenCalled();
    });
  });

  describe('requireFirestore', () => {
    it('should throw when Firestore is not configured', async () => {
      vi.stubEnv('VITE_FIREBASE_API_KEY', '');
      vi.stubEnv('VITE_FIREBASE_PROJECT_ID', '');
      
      vi.resetModules();
      const { requireFirestore } = await import('../../lib/firebase');
      
      expect(() => requireFirestore()).toThrow('Firestore is not configured');
    });
  });

  describe('requireAuth', () => {
    it('should throw when Auth is not configured', async () => {
      vi.stubEnv('VITE_FIREBASE_API_KEY', '');
      vi.stubEnv('VITE_FIREBASE_PROJECT_ID', '');
      
      vi.resetModules();
      const { requireAuth } = await import('../../lib/firebase');
      
      expect(() => requireAuth()).toThrow('Firebase Auth is not configured');
    });
  });

  describe('appId', () => {
    it('should default to "default-app-id" when not set', async () => {
      vi.stubEnv('VITE_FIREBASE_APP_ID', '');
      
      vi.resetModules();
      const { appId } = await import('../../lib/firebase');
      
      expect(appId).toBe('default-app-id');
    });

    it('should use env variable when set', async () => {
      vi.stubEnv('VITE_FIREBASE_APP_ID', 'custom-app-id');
      
      vi.resetModules();
      const { appId } = await import('../../lib/firebase');
      
      expect(appId).toBe('custom-app-id');
    });
  });
});
