/**
 * HubSpot Settings Component
 * Sprint 26 - T26.8 / Sprint 34 - OAuth UI Wiring Update
 * 
 * User interface for managing HubSpot integration settings.
 */

import { useState, useEffect, useCallback } from 'react';
import { type HubSpotErrorCode } from '../hooks/useHubSpot';
import { SendTestEmail } from './SendTestEmail';

/**
 * Connection status type
 */
type ConnectionStatus = 'connected' | 'disconnected' | 'error' | 'connecting';

/**
 * Sync direction options
 */
type SyncDirection = 'push' | 'pull' | 'bidirectional';

/**
 * Conflict record for display
 */
interface ConflictDisplay {
  id: string;
  field: string;
  localValue: string;
  remoteValue: string;
  detectedAt: string;
}

/**
 * Error record for display
 */
interface ErrorDisplay {
  id: string;
  message: string;
  timestamp: string;
}

/**
 * Sync status
 */
interface SyncStatus {
  lastSyncAt: string | null;
  duration?: number;
  itemsProcessed: number;
  itemsFailed: number;
  inProgress: boolean;
}

/**
 * OAuth Error from URL parameters
 */
interface OAuthUrlError {
  error: string;
  message: string;
}

/**
 * Get user-friendly error message based on error code
 */
function getErrorMessage(code: HubSpotErrorCode, rawMessage?: string): { title: string; description: string } {
  switch (code) {
    case 'not_configured':
      return {
        title: 'HubSpot Not Configured',
        description: 'OAuth credentials are not set up. Please configure HUBSPOT_CLIENT_ID and HUBSPOT_CLIENT_SECRET in your environment.',
      };
    case 'token_expired':
      return {
        title: 'Session Expired',
        description: 'Your HubSpot session has expired. Please reconnect to continue.',
      };
    case 'auth_failed':
      return {
        title: 'Authorization Failed',
        description: rawMessage || 'Failed to authorize with HubSpot. Please try again.',
      };
    case 'refresh_failed':
      return {
        title: 'Token Refresh Failed',
        description: 'Unable to refresh your session. Please reconnect to HubSpot.',
      };
    case 'network_error':
      return {
        title: 'Connection Error',
        description: 'Unable to connect to the server. Please check your internet connection.',
      };
    default:
      return {
        title: 'Error',
        description: rawMessage || 'An unexpected error occurred.',
      };
  }
}

/**
 * HubSpot Settings Props
 */
interface HubSpotSettingsProps {
  /** Current connection status */
  connectionStatus: ConnectionStatus;
  /** Portal ID when connected */
  portalId?: string;
  /** Hub domain when connected */
  hubDomain?: string;
  /** Account name when connected */
  accountName?: string;
  /** Sync status */
  syncStatus: SyncStatus;
  /** Current sync direction setting */
  syncDirection: SyncDirection;
  /** Recent conflicts */
  conflicts: ConflictDisplay[];
  /** Recent errors */
  errors: ErrorDisplay[];
  /** Called when user clicks connect */
  onConnect: () => void;
  /** Called when user clicks disconnect */
  onDisconnect: () => void;
  /** Called when user triggers manual sync */
  onSync: () => Promise<void>;
  /** Called when sync direction changes */
  onSyncDirectionChange: (direction: SyncDirection) => void;
  /** Called when user resolves a conflict */
  onResolveConflict: (id: string, resolution: 'local' | 'remote') => void;
  /** Called when test connection is requested */
  onTestConnection?: () => Promise<{ valid: boolean; error?: string }>;
  /** Whether test connection is in progress */
  isTestingConnection?: boolean;
  /** Test connection result */
  testConnectionResult?: { valid: boolean; error?: string } | null;
  /** OAuth error from URL */
  oauthError?: OAuthUrlError | null;
  /** Clear OAuth error */
  onClearOAuthError?: () => void;
  /** Error code for detailed error display */
  errorCode?: HubSpotErrorCode | null;
  /** Optional className */
  className?: string;
}

/**
 * Format relative time
 */
function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

/**
 * Status indicator component
 */
function StatusIndicator({ status }: { status: ConnectionStatus }) {
  const statusConfig = {
    connected: { color: 'bg-green-500', label: 'Connected', textColor: 'text-green-700' },
    disconnected: { color: 'bg-gray-400', label: 'Disconnected', textColor: 'text-gray-600' },
    error: { color: 'bg-red-500', label: 'Error', textColor: 'text-red-700' },
    connecting: { color: 'bg-yellow-500 animate-pulse', label: 'Connecting...', textColor: 'text-yellow-700' },
  };

  const config = statusConfig[status];

  return (
    <div className="flex items-center gap-2">
      <div className={`w-3 h-3 rounded-full ${config.color}`} />
      <span className={`text-sm font-medium ${config.textColor}`}>{config.label}</span>
    </div>
  );
}

/**
 * HubSpot Settings Panel
 */
export function HubSpotSettings({
  connectionStatus,
  portalId,
  hubDomain,
  accountName,
  syncStatus,
  syncDirection,
  conflicts,
  errors,
  onConnect,
  onDisconnect,
  onSync,
  onSyncDirectionChange,
  onResolveConflict,
  onTestConnection,
  isTestingConnection = false,
  testConnectionResult,
  oauthError,
  onClearOAuthError,
  errorCode,
  className = '',
}: HubSpotSettingsProps) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState<'settings' | 'conflicts' | 'errors'>('settings');

  // Update syncing state from props
  useEffect(() => {
    setIsSyncing(syncStatus.inProgress);
  }, [syncStatus.inProgress]);

  // Handle sync button click
  const handleSync = useCallback(async () => {
    setIsSyncing(true);
    try {
      await onSync();
    } finally {
      setIsSyncing(false);
    }
  }, [onSync]);

  const isConnected = connectionStatus === 'connected';
  const hasError = connectionStatus === 'error';
  const errorInfo = errorCode ? getErrorMessage(errorCode) : null;

  return (
    <div className={`bg-white rounded-lg shadow-md border border-gray-200 ${className}`} data-testid="hubspot-settings">
      {/* OAuth Error Banner from URL params */}
      {oauthError && (
        <div className="bg-red-50 border-b border-red-200 px-6 py-4" data-testid="oauth-error-banner">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-red-800">OAuth Error: {oauthError.error}</h4>
              {oauthError.message && (
                <p className="text-sm text-red-600 mt-1">{oauthError.message}</p>
              )}
            </div>
            {onClearOAuthError && (
              <button
                onClick={onClearOAuthError}
                className="text-red-500 hover:text-red-700"
                aria-label="Dismiss error"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg className="w-8 h-8 text-orange-500" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
            </svg>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">HubSpot Integration</h2>
              {isConnected && (
                <p className="text-sm text-gray-500">
                  {accountName && `${accountName} • `}
                  Portal: {portalId}
                  {hubDomain && ` • ${hubDomain}`}
                </p>
              )}
            </div>
          </div>
          <StatusIndicator status={connectionStatus} />
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex -mb-px" aria-label="Tabs">
          {(['settings', 'conflicts', 'errors'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              {tab === 'conflicts' && conflicts.length > 0 && (
                <span className="ml-2 px-2 py-0.5 text-xs bg-yellow-100 text-yellow-800 rounded-full">
                  {conflicts.length}
                </span>
              )}
              {tab === 'errors' && errors.length > 0 && (
                <span className="ml-2 px-2 py-0.5 text-xs bg-red-100 text-red-800 rounded-full">
                  {errors.length}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="p-6">
        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="space-y-6">
            {/* Connection Section */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-3">Connection</h3>
              {isConnected ? (
                <button
                  onClick={onDisconnect}
                  className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 transition-colors"
                  data-testid="hubspot-disconnect"
                >
                  Disconnect HubSpot
                </button>
              ) : (
                <button
                  onClick={onConnect}
                  disabled={connectionStatus === 'connecting'}
                  className="px-4 py-2 text-sm font-medium text-white bg-orange-500 rounded-md hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  data-testid="hubspot-connect"
                >
                  {connectionStatus === 'connecting' ? 'Connecting...' : 'Connect to HubSpot'}
                </button>
              )}

              {/* Error Display */}
              {hasError && errorInfo && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg" data-testid="hubspot-error-info">
                  <h4 className="text-sm font-semibold text-red-800">{errorInfo.title}</h4>
                  <p className="text-xs text-red-600 mt-1">{errorInfo.description}</p>
                </div>
              )}

              {/* Test Connection Button */}
              {isConnected && onTestConnection && (
                <div className="mt-3">
                  <button
                    onClick={onTestConnection}
                    disabled={isTestingConnection}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-200 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    data-testid="hubspot-test-connection"
                  >
                    {isTestingConnection ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-gray-500 inline" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Testing...
                      </>
                    ) : (
                      'Test Connection'
                    )}
                  </button>
                  {testConnectionResult && (
                    <div className={`mt-2 text-sm ${testConnectionResult.valid ? 'text-green-600' : 'text-red-600'}`}>
                      {testConnectionResult.valid ? (
                        <span className="flex items-center gap-1">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Connection verified
                        </span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          {testConnectionResult.error || 'Connection failed'}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Sync Direction */}
            {isConnected && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">Sync Direction</h3>
                <div className="flex gap-2">
                  {(['push', 'pull', 'bidirectional'] as const).map((dir) => (
                    <button
                      key={dir}
                      onClick={() => onSyncDirectionChange(dir)}
                      className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                        syncDirection === dir
                          ? 'bg-orange-500 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {dir === 'push' && '→ Push Only'}
                      {dir === 'pull' && '← Pull Only'}
                      {dir === 'bidirectional' && '↔ Bidirectional'}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  {syncDirection === 'push' && 'Changes in YardFlow will sync to HubSpot.'}
                  {syncDirection === 'pull' && 'Changes in HubSpot will sync to YardFlow.'}
                  {syncDirection === 'bidirectional' && 'Changes sync both ways. Conflicts resolved by timestamp.'}
                </p>
              </div>
            )}

            {/* Sync Status */}
            {isConnected && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">Sync Status</h3>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Last Sync:</span>
                      <span className="ml-2 font-medium">
                        {syncStatus.lastSyncAt 
                          ? formatRelativeTime(syncStatus.lastSyncAt)
                          : 'Never'
                        }
                      </span>
                    </div>
                    {syncStatus.duration !== undefined && (
                      <div>
                        <span className="text-gray-500">Duration:</span>
                        <span className="ml-2 font-medium">{syncStatus.duration}ms</span>
                      </div>
                    )}
                    <div>
                      <span className="text-gray-500">Processed:</span>
                      <span className="ml-2 font-medium text-green-600">
                        {syncStatus.itemsProcessed}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Failed:</span>
                      <span className={`ml-2 font-medium ${syncStatus.itemsFailed > 0 ? 'text-red-600' : 'text-gray-600'}`}>
                        {syncStatus.itemsFailed}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={handleSync}
                    disabled={isSyncing}
                    className="mt-4 w-full px-4 py-2 text-sm font-medium text-white bg-orange-500 rounded-md hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                  >
                    {isSyncing ? (
                      <>
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Syncing...
                      </>
                    ) : (
                      'Sync Now'
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Email Test Section */}
            <div className="pt-4 border-t border-gray-200">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Email Infrastructure Test</h3>
              <SendTestEmail 
                className="border-0 p-0 shadow-none"
                onSuccess={(emailId) => console.log('Test email sent:', emailId)}
                onError={(error) => console.error('Test email failed:', error)}
              />
            </div>
          </div>
        )}

        {/* Conflicts Tab */}
        {activeTab === 'conflicts' && (
          <div>
            {conflicts.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="mt-2">No conflicts to resolve</p>
              </div>
            ) : (
              <div className="space-y-3">
                {conflicts.slice(0, 10).map((conflict) => (
                  <div key={conflict.id} className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-gray-900">{conflict.field}</p>
                        <p className="text-sm text-gray-500 mt-1">
                          Detected {formatRelativeTime(conflict.detectedAt)}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => onResolveConflict(conflict.id, 'local')}
                          className="px-3 py-1 text-xs font-medium text-blue-700 bg-blue-100 rounded hover:bg-blue-200"
                        >
                          Use Local
                        </button>
                        <button
                          onClick={() => onResolveConflict(conflict.id, 'remote')}
                          className="px-3 py-1 text-xs font-medium text-orange-700 bg-orange-100 rounded hover:bg-orange-200"
                        >
                          Use HubSpot
                        </button>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
                      <div className="bg-white p-2 rounded border">
                        <span className="text-gray-500">YardFlow:</span>
                        <span className="ml-2 font-mono">{conflict.localValue}</span>
                      </div>
                      <div className="bg-white p-2 rounded border">
                        <span className="text-gray-500">HubSpot:</span>
                        <span className="ml-2 font-mono">{conflict.remoteValue}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Errors Tab */}
        {activeTab === 'errors' && (
          <div>
            {errors.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="mt-2">No errors</p>
              </div>
            ) : (
              <div className="space-y-2">
                {errors.slice(0, 10).map((error) => (
                  <div key={error.id} className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <div className="flex justify-between">
                      <p className="text-sm text-red-700">{error.message}</p>
                      <span className="text-xs text-red-500">
                        {formatRelativeTime(error.timestamp)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default HubSpotSettings;
