/**
 * HubSpot Settings Component Tests
 * Sprint 26 - T26.8
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { HubSpotSettings } from '../../components/HubSpotSettings';

describe('HubSpot Settings - T26.8', () => {
  const defaultProps = {
    connectionStatus: 'disconnected' as const,
    syncStatus: {
      lastSyncAt: null,
      itemsProcessed: 0,
      itemsFailed: 0,
      inProgress: false,
    },
    syncDirection: 'bidirectional' as const,
    conflicts: [],
    errors: [],
    onConnect: vi.fn(),
    onDisconnect: vi.fn(),
    onSync: vi.fn().mockResolvedValue(undefined),
    onSyncDirectionChange: vi.fn(),
    onResolveConflict: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Connection Status', () => {
    it('should show disconnected state with connect button', () => {
      render(<HubSpotSettings {...defaultProps} />);

      expect(screen.getByText('Disconnected')).toBeInTheDocument();
      expect(screen.getByText('Connect to HubSpot')).toBeInTheDocument();
    });

    it('should show connected state with disconnect button', () => {
      render(
        <HubSpotSettings
          {...defaultProps}
          connectionStatus="connected"
          portalId="12345"
          accountName="Acme Corp"
        />
      );

      expect(screen.getByText('Connected')).toBeInTheDocument();
      expect(screen.getByText('Disconnect HubSpot')).toBeInTheDocument();
      expect(screen.getByText(/Acme Corp/)).toBeInTheDocument();
      expect(screen.getByText(/12345/)).toBeInTheDocument();
    });

    it('should show connecting state', () => {
      render(<HubSpotSettings {...defaultProps} connectionStatus="connecting" />);

      expect(screen.getAllByText('Connecting...').length).toBeGreaterThanOrEqual(1);
    });

    it('should show error state', () => {
      render(<HubSpotSettings {...defaultProps} connectionStatus="error" />);

      expect(screen.getByText('Error')).toBeInTheDocument();
    });

    it('should call onConnect when connect button clicked', () => {
      render(<HubSpotSettings {...defaultProps} />);

      fireEvent.click(screen.getByText('Connect to HubSpot'));

      expect(defaultProps.onConnect).toHaveBeenCalledTimes(1);
    });

    it('should call onDisconnect when disconnect button clicked', () => {
      render(<HubSpotSettings {...defaultProps} connectionStatus="connected" />);

      fireEvent.click(screen.getByText('Disconnect HubSpot'));

      expect(defaultProps.onDisconnect).toHaveBeenCalledTimes(1);
    });
  });

  describe('Sync Direction', () => {
    it('should show sync direction options when connected', () => {
      render(<HubSpotSettings {...defaultProps} connectionStatus="connected" />);

      expect(screen.getByText('→ Push Only')).toBeInTheDocument();
      expect(screen.getByText('← Pull Only')).toBeInTheDocument();
      expect(screen.getByText('↔ Bidirectional')).toBeInTheDocument();
    });

    it('should highlight active sync direction', () => {
      render(
        <HubSpotSettings
          {...defaultProps}
          connectionStatus="connected"
          syncDirection="push"
        />
      );

      const pushButton = screen.getByText('→ Push Only');
      expect(pushButton.className).toContain('bg-orange-500');
    });

    it('should call onSyncDirectionChange when direction changed', () => {
      render(<HubSpotSettings {...defaultProps} connectionStatus="connected" />);

      fireEvent.click(screen.getByText('→ Push Only'));

      expect(defaultProps.onSyncDirectionChange).toHaveBeenCalledWith('push');
    });
  });

  describe('Sync Status', () => {
    it('should show last sync time', () => {
      const now = new Date();
      render(
        <HubSpotSettings
          {...defaultProps}
          connectionStatus="connected"
          syncStatus={{
            lastSyncAt: now.toISOString(),
            itemsProcessed: 50,
            itemsFailed: 2,
            inProgress: false,
          }}
        />
      );

      expect(screen.getByText('Just now')).toBeInTheDocument();
      expect(screen.getByText('50')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
    });

    it('should show "Never" when no sync has occurred', () => {
      render(<HubSpotSettings {...defaultProps} connectionStatus="connected" />);

      expect(screen.getByText('Never')).toBeInTheDocument();
    });

    it('should call onSync when sync button clicked', async () => {
      render(<HubSpotSettings {...defaultProps} connectionStatus="connected" />);

      fireEvent.click(screen.getByText('Sync Now'));

      await waitFor(() => {
        expect(defaultProps.onSync).toHaveBeenCalledTimes(1);
      });
    });

    it('should show spinner during sync', () => {
      render(
        <HubSpotSettings
          {...defaultProps}
          connectionStatus="connected"
          syncStatus={{
            ...defaultProps.syncStatus,
            inProgress: true,
          }}
        />
      );

      expect(screen.getByText('Syncing...')).toBeInTheDocument();
    });
  });

  describe('Conflicts Tab', () => {
    it('should show conflict count badge', () => {
      render(
        <HubSpotSettings
          {...defaultProps}
          connectionStatus="connected"
          conflicts={[
            {
              id: 'c1',
              field: 'company',
              localValue: 'Acme Corp',
              remoteValue: 'Acme Inc',
              detectedAt: new Date().toISOString(),
            },
          ]}
        />
      );

      expect(screen.getByText('1')).toBeInTheDocument();
    });

    it('should show conflicts when tab clicked', () => {
      render(
        <HubSpotSettings
          {...defaultProps}
          connectionStatus="connected"
          conflicts={[
            {
              id: 'c1',
              field: 'company',
              localValue: 'Acme Corp',
              remoteValue: 'Acme Inc',
              detectedAt: new Date().toISOString(),
            },
          ]}
        />
      );

      fireEvent.click(screen.getByText('Conflicts'));

      expect(screen.getByText('company')).toBeInTheDocument();
      expect(screen.getByText('Acme Corp')).toBeInTheDocument();
      expect(screen.getByText('Acme Inc')).toBeInTheDocument();
    });

    it('should show no conflicts message when empty', () => {
      render(<HubSpotSettings {...defaultProps} connectionStatus="connected" />);

      fireEvent.click(screen.getByText('Conflicts'));

      expect(screen.getByText('No conflicts to resolve')).toBeInTheDocument();
    });

    it('should call onResolveConflict with local resolution', () => {
      render(
        <HubSpotSettings
          {...defaultProps}
          connectionStatus="connected"
          conflicts={[
            {
              id: 'c1',
              field: 'company',
              localValue: 'Acme Corp',
              remoteValue: 'Acme Inc',
              detectedAt: new Date().toISOString(),
            },
          ]}
        />
      );

      fireEvent.click(screen.getByText('Conflicts'));
      fireEvent.click(screen.getByText('Use Local'));

      expect(defaultProps.onResolveConflict).toHaveBeenCalledWith('c1', 'local');
    });

    it('should call onResolveConflict with remote resolution', () => {
      render(
        <HubSpotSettings
          {...defaultProps}
          connectionStatus="connected"
          conflicts={[
            {
              id: 'c1',
              field: 'company',
              localValue: 'Acme Corp',
              remoteValue: 'Acme Inc',
              detectedAt: new Date().toISOString(),
            },
          ]}
        />
      );

      fireEvent.click(screen.getByText('Conflicts'));
      fireEvent.click(screen.getByText('Use HubSpot'));

      expect(defaultProps.onResolveConflict).toHaveBeenCalledWith('c1', 'remote');
    });
  });

  describe('Errors Tab', () => {
    it('should show error count badge', () => {
      render(
        <HubSpotSettings
          {...defaultProps}
          connectionStatus="connected"
          errors={[
            {
              id: 'e1',
              message: 'Rate limit exceeded',
              timestamp: new Date().toISOString(),
            },
          ]}
        />
      );

      // Find the badge with "1" in the errors tab
      const tabs = screen.getAllByRole('button');
      const errorsTab = tabs.find(tab => tab.textContent?.includes('Errors'));
      expect(errorsTab?.textContent).toContain('1');
    });

    it('should show errors when tab clicked', () => {
      render(
        <HubSpotSettings
          {...defaultProps}
          connectionStatus="connected"
          errors={[
            {
              id: 'e1',
              message: 'Rate limit exceeded',
              timestamp: new Date().toISOString(),
            },
          ]}
        />
      );

      fireEvent.click(screen.getByText('Errors'));

      expect(screen.getByText('Rate limit exceeded')).toBeInTheDocument();
    });

    it('should show no errors message when empty', () => {
      render(<HubSpotSettings {...defaultProps} connectionStatus="connected" />);

      fireEvent.click(screen.getByText('Errors'));

      expect(screen.getByText('No errors')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper tab navigation', () => {
      render(<HubSpotSettings {...defaultProps} connectionStatus="connected" />);

      const tabs = screen.getAllByRole('button').filter(
        btn => ['Settings', 'Conflicts', 'Errors'].some(t => btn.textContent?.includes(t))
      );

      expect(tabs.length).toBeGreaterThanOrEqual(3);
    });
  });
});
