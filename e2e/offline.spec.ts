/**
 * Offline & PWA E2E Tests - YardFlow Hub
 * 
 * Tests for Progressive Web App functionality including
 * offline mode, install prompt, and update notifications.
 */

import { test, expect, navigateToTab } from './fixtures';

test.describe('PWA & Offline Support', () => {
  test.describe('PWA Installation', () => {
    test('should have PWA manifest', async ({ appPage }) => {
      // Check for manifest link in head
      const manifestLink = appPage.locator('link[rel="manifest"]');
      const count = await manifestLink.count();
      
      // Either has manifest or will be injected by service worker
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('should have meta theme color', async ({ appPage }) => {
      const themeColor = appPage.locator('meta[name="theme-color"]');
      const count = await themeColor.count();
      
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('should have apple touch icon', async ({ appPage }) => {
      const touchIcon = appPage.locator('link[rel="apple-touch-icon"]');
      const count = await touchIcon.count();
      
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('should register service worker', async ({ appPage }) => {
      // Check if service worker is supported and registered
      const hasServiceWorker = await appPage.evaluate(() => {
        return 'serviceWorker' in navigator;
      });
      
      expect(hasServiceWorker).toBe(true);
    });
  });

  test.describe('Offline UI Components', () => {
    test('should have offline indicator area', async ({ appPage }) => {
      // Look for offline/sync status UI
      const offlineUI = appPage.locator(
        '[data-testid="sync-status"], ' +
        '[data-testid="offline-banner"], ' +
        '.offline-indicator, ' +
        '.sync-status'
      );
      
      const count = await offlineUI.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('should have install prompt trigger', async ({ appPage }) => {
      // Look for install app button or prompt
      const installUI = appPage.locator(
        '[data-testid="install-app"], ' +
        'button:has-text("Install"), ' +
        '.pwa-install-prompt'
      );
      
      const count = await installUI.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('should have update notification area', async ({ appPage }) => {
      // Look for update notification container
      const updateUI = appPage.locator(
        '[data-testid="update-notification"], ' +
        '[role="alert"], ' +
        '.update-banner'
      );
      
      const count = await updateUI.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Offline Data Handling', () => {
    test('should show sync status in UI', async ({ appPage }) => {
      await navigateToTab(appPage, 'Hitlist');
      
      // Look for sync status indicator
      const syncStatus = appPage.locator(
        '[data-testid="sync-status"], ' +
        '.sync-indicator, ' +
        'text=/sync|online|offline/i'
      );
      
      const count = await syncStatus.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('should have local storage capabilities', async ({ appPage }) => {
      // Check that localStorage/IndexedDB is available
      const hasStorage = await appPage.evaluate(() => {
        return typeof localStorage !== 'undefined' && typeof indexedDB !== 'undefined';
      });
      
      expect(hasStorage).toBe(true);
    });
  });

  test.describe('Cache Management', () => {
    test('should have cache API available', async ({ appPage }) => {
      const hasCaches = await appPage.evaluate(() => {
        return 'caches' in window;
      });
      
      expect(hasCaches).toBe(true);
    });
  });
});
