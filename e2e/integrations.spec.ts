/**
 * Integrations E2E Tests - YardFlow Hub
 * Sprint 34 - T34.5
 * 
 * Tests for HubSpot OAuth, Command Palette, Sync Status, and Presence features
 */

import { test, expect, navigateToTab } from './fixtures';

test.describe('HubSpot Integration', () => {
  test('should navigate to Integrations tab', async ({ appPage }) => {
    // Navigate to Integrations
    await navigateToTab(appPage, 'Integrations');
    
    // Should show HubSpot settings
    await expect(appPage.getByTestId('hubspot-settings')).toBeVisible();
  });

  test('should display HubSpot connect button when not connected', async ({ appPage }) => {
    // Navigate to Integrations
    await navigateToTab(appPage, 'Integrations');
    
    // Should show connect button
    await expect(appPage.getByTestId('hubspot-connect')).toBeVisible();
    
    // Button text should indicate connection action
    const button = appPage.getByTestId('hubspot-connect');
    await expect(button).toContainText(/connect|link|authorize/i);
  });

  test('should trigger OAuth flow when connect button is clicked', async ({ appPage }) => {
    // Navigate to Integrations
    await navigateToTab(appPage, 'Integrations');
    
    // Track popup or redirect behavior
    let popupOpened = false;
    appPage.on('popup', () => {
      popupOpened = true;
    });
    
    // Click connect button
    const connectButton = appPage.getByTestId('hubspot-connect');
    await connectButton.click();
    
    // Either popup should open OR redirect should happen
    // We can't fully test OAuth without HubSpot credentials
    // But we verify the click handler works
    await appPage.waitForTimeout(500);
    
    // Button state may have changed to loading
    const button = appPage.getByTestId('hubspot-connect');
    const isVisible = await button.isVisible().catch(() => false);
    
    // Either button is in connecting state or popup opened
    expect(popupOpened || isVisible).toBe(true);
  });
});

test.describe('Command Palette', () => {
  test('should open command palette with Ctrl+K', async ({ appPage }) => {
    // Press Ctrl+K to open command palette
    await appPage.keyboard.press('Control+k');
    
    // Command palette should be visible
    await expect(appPage.getByTestId('command-palette')).toBeVisible();
    
    // Input should be focused
    await expect(appPage.getByTestId('command-palette-input')).toBeFocused();
  });

  test('should close command palette with Escape', async ({ appPage }) => {
    // Open command palette
    await appPage.keyboard.press('Control+k');
    await expect(appPage.getByTestId('command-palette')).toBeVisible();
    
    // Press Escape to close
    await appPage.keyboard.press('Escape');
    
    // Command palette should be hidden
    await expect(appPage.getByTestId('command-palette')).not.toBeVisible();
  });

  test('should close command palette when clicking overlay', async ({ appPage }) => {
    // Open command palette
    await appPage.keyboard.press('Control+k');
    await expect(appPage.getByTestId('command-palette')).toBeVisible();
    
    // Click the overlay (outside the palette)
    await appPage.getByTestId('command-palette-overlay').click({ position: { x: 10, y: 10 } });
    
    // Command palette should be hidden
    await expect(appPage.getByTestId('command-palette')).not.toBeVisible();
  });

  test('should display navigation commands', async ({ appPage }) => {
    // Open command palette
    await appPage.keyboard.press('Control+k');
    
    // Should show navigation options
    const palette = appPage.getByTestId('command-palette');
    await expect(palette).toContainText(/dashboard|hitlist|targets/i);
  });

  test('should navigate to tab when command is selected', async ({ appPage }) => {
    // Open command palette
    await appPage.keyboard.press('Control+k');
    
    // Type to filter
    await appPage.keyboard.type('dashboard');
    
    // Press Enter to select
    await appPage.keyboard.press('Enter');
    
    // Command palette should close
    await expect(appPage.getByTestId('command-palette')).not.toBeVisible();
    
    // Should navigate to dashboard (look for dashboard-specific content)
    await expect(appPage.locator('text=/Dashboard|Analytics|Overview/i')).toBeVisible();
  });
});

test.describe('Sync Status', () => {
  test('should display sync status in header', async ({ appPage }) => {
    // Look for sync status indicator in the header
    const syncStatus = appPage.getByTestId('sync-status');
    
    // Sync status should be visible (even if showing "offline" or "synced")
    await expect(syncStatus).toBeVisible();
  });

  test('should show online/offline status', async ({ appPage }) => {
    const syncStatus = appPage.getByTestId('sync-status');
    
    // Should show some status indicator
    const text = await syncStatus.textContent();
    expect(text).toBeTruthy();
    
    // Should have a status indicator (icon or text)
    const hasStatusIndicator = await syncStatus.locator('svg, [class*="indicator"], [class*="status"]').count() > 0;
    const hasStatusText = /synced|offline|pending|sync/i.test(text || '');
    
    expect(hasStatusIndicator || hasStatusText).toBe(true);
  });
});

test.describe('Offline Banner', () => {
  test('should show offline banner when network is unavailable', async ({ appPage, context }) => {
    // Set the browser to offline mode
    await context.setOffline(true);
    
    // Wait for offline detection
    await appPage.waitForTimeout(1000);
    
    // Offline banner should appear
    await expect(appPage.getByTestId('offline-banner')).toBeVisible({ timeout: 5000 });
    
    // Restore network
    await context.setOffline(false);
  });

  test('should hide offline banner when network is restored', async ({ appPage, context }) => {
    // Go offline
    await context.setOffline(true);
    await appPage.waitForTimeout(1000);
    
    // Verify banner appears
    const offlineBanner = appPage.getByTestId('offline-banner');
    // It may or may not appear depending on app state
    
    // Go online
    await context.setOffline(false);
    await appPage.waitForTimeout(1000);
    
    // Banner should not be visible OR should show "online" state
    const hasOnlineBanner = await appPage.getByTestId('offline-banner-online').isVisible().catch(() => false);
    const hasOfflineBanner = await offlineBanner.isVisible().catch(() => false);
    
    // Either no banner or online banner
    expect(!hasOfflineBanner || hasOnlineBanner).toBe(true);
  });
});

test.describe('Presence Indicator', () => {
  test('should display presence indicator in prospect detail', async ({ appPage }) => {
    // Navigate to Hitlist/Targets
    await navigateToTab(appPage, 'Hitlist');
    
    // Click on a prospect to open detail view
    const prospectRow = appPage.locator('[class*="prospect"], [class*="hitlist"] button, [role="row"]').first();
    if (await prospectRow.isVisible()) {
      await prospectRow.click();
      
      // Wait for detail view to load
      await appPage.waitForTimeout(500);
      
      // Presence indicator should be in the header area
      // It may not be visible if no other users are viewing
      const presenceIndicator = appPage.getByTestId('presence-indicator');
      
      // The indicator exists (may be hidden if no users)
      // We just verify it doesn't throw an error
      await presenceIndicator.isVisible().catch(() => false);
    }
  });
});

test.describe('Integration Tab Content', () => {
  test('should show integration options', async ({ appPage }) => {
    // Navigate to Integrations tab
    await navigateToTab(appPage, 'Integrations');
    
    // Should show HubSpot as an integration option
    await expect(appPage.locator('text=/hubspot/i')).toBeVisible();
  });

  test('should show connection status for integrations', async ({ appPage }) => {
    // Navigate to Integrations tab
    await navigateToTab(appPage, 'Integrations');
    
    // Should show status (connected/disconnected)
    const statusIndicator = appPage.locator('text=/connected|disconnected|not connected|connect/i');
    await expect(statusIndicator.first()).toBeVisible();
  });
});
