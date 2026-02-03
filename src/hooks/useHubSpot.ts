/**
 * useHubSpot Hook
 * Sprint 34 - T34.1a/b (Updated for OAuth UI Wiring)
 * 
 * React hook for HubSpot OAuth integration.
 * Uses server-side session management - frontend checks status via API.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  createHubSpotAuthService, 
  HubSpotAuthService, 
  HubSpotAuthConfig 
} from '../services/HubSpotAuthService';
import { createHubSpotClient } from '../services/HubSpotClient';

// =============================================================================
// Types
// =============================================================================

export type HubSpotConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

/** Error codes for specific OAuth failure states */
export type HubSpotErrorCode = 
  | 'not_configured'    // OAuth credentials not set up
  | 'token_expired'     // Token expired, needs refresh or reconnect
  | 'auth_failed'       // OAuth authorization failed
  | 'refresh_failed'    // Token refresh failed
  | 'network_error'     // Network/API error
  | 'unknown';          // Unknown error

export interface HubSpotError {
  code: HubSpotErrorCode;
  message: string;
}

export interface SessionInfo {
  connected: boolean;
  portalId?: string;
  hubDomain?: string;
  expiresAt?: number;
  needsRefresh?: boolean;
  error?: string;
}

export interface UseHubSpotReturn {
  /** Current connection status */
  status: HubSpotConnectionStatus;
  /** Portal ID when connected */
  portalId: string | null;
  /** Hub domain when connected */
  hubDomain: string | null;
  /** Error message if status is 'error' */
  error: string | null;
  /** Structured error info */
  errorInfo: HubSpotError | null;
  /** Whether currently connected */
  isConnected: boolean;
  /** Token expiration time */
  expiresAt: number | null;
  /** Whether session needs refresh */
  needsRefresh: boolean;
  /** Whether loading session */
  isLoading: boolean;
  /** Initiate OAuth connection */
  connect: () => Promise<void>;
  /** Disconnect and clear tokens (calls server DELETE) */
  disconnect: () => Promise<void>;
  /** Retry connection after error */
  retry: () => void;
  /** Manually refresh token via server */
  refreshToken: () => Promise<void>;
  /** Test connection validity */
  testConnection: () => Promise<{ valid: boolean; portalId?: string; error?: string }>;
  /** Check session status from server */
  checkSession: () => Promise<SessionInfo>;
}

export interface UseHubSpotOptions {
  /** HubSpot OAuth Client ID */
  clientId?: string;
  /** OAuth redirect URI */
  redirectUri?: string;
  /** OAuth scopes */
  scopes?: string[];
  /** Auto-check connection on mount */
  autoCheck?: boolean;
  /** Auto-refresh tokens before expiry (default: true) */
  autoRefresh?: boolean;
  /** Refresh buffer in ms (default: 5 minutes) */
  refreshBuffer?: number;
}

// =============================================================================
// Default Configuration
// =============================================================================

const DEFAULT_CONFIG: Partial<HubSpotAuthConfig> = {
  clientId: import.meta.env.VITE_HUBSPOT_CLIENT_ID || '',
  redirectUri: import.meta.env.VITE_HUBSPOT_REDIRECT_URI || 
    (typeof window !== 'undefined' ? `${window.location.origin}/oauth/callback` : ''),
  scopes: [
    'crm.objects.contacts.read',
    'crm.objects.contacts.write',
    'crm.objects.deals.read',
    'crm.objects.deals.write',
  ],
};

// =============================================================================
// URL Parameter Parsing
// =============================================================================

/**
 * Parse OAuth callback parameters from URL
 */
function parseCallbackParams(): { code: string; state: string } | null {
  if (typeof window === 'undefined') return null;
  
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const state = params.get('state');
  
  if (code && state) {
    return { code, state };
  }
  
  return null;
}

/**
 * Clear OAuth parameters from URL without page reload
 */
function clearCallbackParams(): void {
  if (typeof window === 'undefined') return;
  
  const url = new URL(window.location.href);
  url.searchParams.delete('code');
  url.searchParams.delete('state');
  url.searchParams.delete('error');
  url.searchParams.delete('error_description');
  
  window.history.replaceState({}, document.title, url.pathname + url.hash);
}

/**
 * Extract portal ID from access token (JWT decode)
 * Note: For demo purposes, we'll store portal ID separately after successful auth
 */
function _extractPortalId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('yardflow_hubspot_portal_id');
}

// Re-export for external use if needed
export const extractPortalId = _extractPortalId;

function storePortalId(portalId: string): void {
  localStorage.setItem('yardflow_hubspot_portal_id', portalId);
}

function clearPortalId(): void {
  localStorage.removeItem('yardflow_hubspot_portal_id');
}

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_REFRESH_BUFFER_MS = 5 * 60 * 1000; // 5 minutes

// =============================================================================
// Hook Implementation
// =============================================================================

export function useHubSpot(options: UseHubSpotOptions = {}): UseHubSpotReturn {
  const {
    clientId = DEFAULT_CONFIG.clientId,
    redirectUri = DEFAULT_CONFIG.redirectUri,
    scopes = DEFAULT_CONFIG.scopes,
    autoCheck = true,
    autoRefresh = true,
    refreshBuffer = DEFAULT_REFRESH_BUFFER_MS,
  } = options;

  // State
  const [status, setStatus] = useState<HubSpotConnectionStatus>('disconnected');
  const [portalId, setPortalId] = useState<string | null>(null);
  const [hubDomain, setHubDomain] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorInfo, setErrorInfo] = useState<HubSpotError | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Service ref (stable across renders)
  const serviceRef = useRef<HubSpotAuthService | null>(null);
  const initializingRef = useRef(false);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initialize service
  const getService = useCallback((): HubSpotAuthService | null => {
    if (!clientId || !redirectUri) {
      console.warn('[useHubSpot] Missing clientId or redirectUri configuration');
      return null;
    }

    if (!serviceRef.current) {
      serviceRef.current = createHubSpotAuthService({
        clientId,
        redirectUri,
        scopes,
      });
    }

    return serviceRef.current;
  }, [clientId, redirectUri, scopes]);

  // Verify connection against HubSpot API using server-managed token
  const runConnectionTest = useCallback(async () => {
    const service = getService();
    if (!service) return null;

    try {
      const client = createHubSpotClient({ authService: service });
      const result = await client.testConnection();
      if (result.valid && result.portalId) {
        storePortalId(result.portalId);
        setPortalId(result.portalId);
      }
      return result;
    } catch (err) {
      console.error('[useHubSpot] Connection test failed:', err);
      return null;
    }
  }, [getService]);

  // Helper to parse error codes from messages
  const parseErrorCode = useCallback((errorMsg: string): HubSpotErrorCode => {
    const lowerMsg = errorMsg.toLowerCase();
    if (lowerMsg.includes('not configured') || lowerMsg.includes('missing')) {
      return 'not_configured';
    }
    if (lowerMsg.includes('expired') || lowerMsg.includes('token_expired')) {
      return 'token_expired';
    }
    if (lowerMsg.includes('refresh failed') || lowerMsg.includes('refresh_failed')) {
      return 'refresh_failed';
    }
    if (lowerMsg.includes('denied') || lowerMsg.includes('auth') || lowerMsg.includes('unauthorized')) {
      return 'auth_failed';
    }
    if (lowerMsg.includes('network') || lowerMsg.includes('fetch')) {
      return 'network_error';
    }
    return 'unknown';
  }, []);

  // Set error with structured info
  const setErrorState = useCallback((message: string, code?: HubSpotErrorCode) => {
    setError(message);
    setErrorInfo({
      code: code || parseErrorCode(message),
      message,
    });
  }, [parseErrorCode]);

  // Clear error state
  const clearErrorState = useCallback(() => {
    setError(null);
    setErrorInfo(null);
  }, []);

  // Check session status from server (GET /api/oauth/session)
  const checkSession = useCallback(async (): Promise<SessionInfo> => {
    // Skip session check if HubSpot not configured (prefer provided clientId)
    if (!clientId) {
      setStatus('disconnected');
      return { connected: false, error: 'HubSpot not configured' };
    }

    try {
      const response = await fetch('/api/oauth/session', {
        method: 'GET',
        credentials: 'include',
      });
      
      const session: SessionInfo = await response.json();
      
      if (session.connected) {
        setStatus('connected');
        if (session.portalId) {
          storePortalId(session.portalId);
          setPortalId(session.portalId);
        }
        if (session.hubDomain) {
          setHubDomain(session.hubDomain);
        }
        setExpiresAt(session.expiresAt ?? null);
        setNeedsRefresh(session.needsRefresh ?? false);
        clearErrorState();
      } else {
        setStatus('disconnected');
        setPortalId(null);
        setHubDomain(null);
        setExpiresAt(null);
        setNeedsRefresh(false);
        
        if (session.error) {
          const code = session.error.toLowerCase().includes('not configured') 
            ? 'not_configured' 
            : session.needsRefresh 
              ? 'token_expired'
              : 'unknown';
          setErrorState(session.error, code);
        }
      }
      
      return session;
    } catch (err) {
      console.error('[useHubSpot] Session check failed:', err);
      const message = err instanceof Error ? err.message : 'Failed to check session';
      setErrorState(message, 'network_error');
      return { connected: false, error: message };
    }
  }, [clearErrorState, setErrorState]);

  // Test connection - validates the session is actually working
  const testConnection = useCallback(async (): Promise<{ valid: boolean; portalId?: string; error?: string }> => {
    try {
      // First check session status
      const session = await checkSession();
      
      if (!session.connected) {
        return { 
          valid: false, 
          error: session.error || 'Not connected' 
        };
      }

      // Then run actual API test
      const result = await runConnectionTest();
      
      if (result?.valid) {
        return { 
          valid: true, 
          portalId: result.portalId 
        };
      }
      
      return { 
        valid: false, 
        error: 'Connection test failed' 
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Connection test failed';
      return { valid: false, error: message };
    }
  }, [checkSession, runConnectionTest]);

  // Check existing connection status (legacy, uses checkSession internally)
  const checkConnection = useCallback(async () => {
    setIsLoading(true);
    try {
      await checkSession();
    } finally {
      setIsLoading(false);
    }
  }, [checkSession]);

  // Handle OAuth callback
  const handleCallback = useCallback(async () => {
    const callbackParams = parseCallbackParams();
    if (!callbackParams) return false;

    const service = getService();
    if (!service) return false;

    setStatus('connecting');
    setError(null);

    try {
      const tokens = await service.handleCallback(
        callbackParams.code,
        callbackParams.state
      );

      setExpiresAt(tokens.expiresAt);

      if (tokens.portalId) {
        storePortalId(tokens.portalId);
        setPortalId(tokens.portalId);
      } else {
        await runConnectionTest();
      }

      setStatus('connected');
      clearCallbackParams();
      
      if (import.meta.env.DEV) console.log('[useHubSpot] OAuth callback successful, tokens received');
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'OAuth callback failed';
      setError(message);
      setStatus('error');
      clearCallbackParams();
      console.error('[useHubSpot] OAuth callback failed:', message);
      return false;
    }
  }, [getService, runConnectionTest]);

  // Initialize on mount
  useEffect(() => {
    if (initializingRef.current) return;
    initializingRef.current = true;

    const initialize = async () => {
      // First check for OAuth callback
      const wasCallback = await handleCallback();
      
      // If not a callback, check existing connection
      if (!wasCallback && autoCheck) {
        await checkConnection();
      }
    };

    initialize();
  }, [handleCallback, checkConnection, autoCheck]);

  // Connect function - opens OAuth flow
  const connect = useCallback(async () => {
    const service = getService();
    if (!service) {
      setError('HubSpot not configured. Missing clientId or redirectUri.');
      setStatus('error');
      return;
    }

    setStatus('connecting');
    setError(null);

    try {
      const authUrl = await service.getAuthUrl();
      
      // Try popup first, fall back to redirect
      const popup = window.open(
        authUrl,
        'hubspot-oauth',
        'width=600,height=700,scrollbars=yes'
      );

      if (popup) {
        // Monitor popup for redirect back
        const checkPopup = setInterval(() => {
          try {
            // Check if popup has navigated back to our domain
            if (popup.location.origin === window.location.origin) {
              const url = new URL(popup.location.href);
              const code = url.searchParams.get('code');
              const state = url.searchParams.get('state');
              const success = url.searchParams.get('success');
              const portalFromUrl = url.searchParams.get('portalId');
              const oauthError = url.searchParams.get('error') || url.searchParams.get('oauth_error');

              if (oauthError) {
                clearInterval(checkPopup);
                popup.close();
                setError(oauthError);
                setStatus('error');
              } else if (code && state) {
                clearInterval(checkPopup);
                popup.close();
                
                service.handleCallback(code, state)
                  .then(async (tokens) => {
                    if (tokens.portalId) {
                      storePortalId(tokens.portalId);
                      setPortalId(tokens.portalId);
                    } else {
                      await runConnectionTest();
                    }
                    setExpiresAt(tokens.expiresAt);
                    setStatus('connected');
                  })
                  .catch((err) => {
                    setError(err.message);
                    setStatus('error');
                  });
              } else if (success === 'true') {
                clearInterval(checkPopup);
                popup.close();
                if (portalFromUrl) {
                  storePortalId(portalFromUrl);
                  setPortalId(portalFromUrl);
                }
                checkConnection();
              }
            }
          } catch {
            // Cross-origin error is expected until redirect back
          }

          // Check if popup was closed without completing
          if (popup.closed) {
            clearInterval(checkPopup);
            if (status === 'connecting') {
              setStatus('disconnected');
              setError('Popup closed before authorization.');
            }
          }
        }, 500);

        // Timeout after 5 minutes
        setTimeout(() => {
          clearInterval(checkPopup);
          if (!popup.closed) {
            popup.close();
          }
          if (status === 'connecting') {
            setError('OAuth timed out');
            setStatus('error');
          }
        }, 5 * 60 * 1000);
      } else {
        // Popup was blocked, fall back to redirect
        if (import.meta.env.DEV) console.log('[useHubSpot] Popup blocked, redirecting...');
        window.location.href = authUrl;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start OAuth';
      setError(message);
      setStatus('error');
    }
  }, [getService, status, runConnectionTest, checkConnection]);

  // Disconnect function - calls server DELETE and clears local state
  const disconnect = useCallback(async () => {
    // Clear refresh timer
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
    
    try {
      // Call server to clear session cookie
      await fetch('/api/oauth/session', {
        method: 'DELETE',
        credentials: 'include',
      });
    } catch (err) {
      console.error('[useHubSpot] Server disconnect failed:', err);
      // Continue with local cleanup even if server call fails
    }
    
    const service = getService();
    if (service) {
      service.disconnect();
    }
    clearPortalId();
    setPortalId(null);
    setHubDomain(null);
    setExpiresAt(null);
    setNeedsRefresh(false);
    setStatus('disconnected');
    clearErrorState();
  }, [getService, clearErrorState]);

  // Refresh token function via server
  const refreshToken = useCallback(async () => {
    try {
      if (import.meta.env.DEV) console.log('[useHubSpot] Refreshing token via server...');
      
      const response = await fetch('/api/oauth/refresh', {
        method: 'POST',
        credentials: 'include',
      });
      
      const data = await response.json();
      
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Token refresh failed');
      }
      
      // Update state with new session info
      if (data.expiresAt) {
        setExpiresAt(data.expiresAt);
      }
      if (data.portalId) {
        storePortalId(data.portalId);
        setPortalId(data.portalId);
      }
      if (data.hubDomain) {
        setHubDomain(data.hubDomain);
      }
      setNeedsRefresh(false);
      clearErrorState();
      
      if (import.meta.env.DEV) console.log('[useHubSpot] Token refreshed successfully');
    } catch (err) {
      console.error('[useHubSpot] Token refresh failed:', err);
      const message = err instanceof Error ? err.message : 'Session expired. Please reconnect.';
      setErrorState(message, 'refresh_failed');
      setStatus('error');
    }
  }, [clearErrorState, setErrorState]);

  // Schedule auto-refresh before token expires
  const scheduleRefresh = useCallback((tokenExpiresAt: number) => {
    // Clear any existing timer
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }

    const now = Date.now();
    const refreshAt = tokenExpiresAt - refreshBuffer;
    const delay = refreshAt - now;

    if (delay <= 0) {
      // Token is already expired or about to expire, refresh immediately
      if (import.meta.env.DEV) console.log('[useHubSpot] Token expired or expiring soon, refreshing now');
      refreshToken();
    } else {
      // Schedule refresh
      if (import.meta.env.DEV) console.log(`[useHubSpot] Scheduling token refresh in ${Math.round(delay / 1000 / 60)} minutes`);
      refreshTimerRef.current = setTimeout(() => {
        refreshToken().then(() => {
          // After successful refresh, schedule next refresh
          if (expiresAt) {
            scheduleRefresh(expiresAt);
          }
        });
      }, delay);
    }
  }, [refreshBuffer, refreshToken, expiresAt]);

  // Auto-refresh effect
  useEffect(() => {
    if (!autoRefresh || status !== 'connected' || !expiresAt) {
      return;
    }

    scheduleRefresh(expiresAt);

    // Cleanup timer on unmount
    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
  }, [autoRefresh, status, expiresAt, scheduleRefresh]);

  // Retry function
  const retry = useCallback(() => {
    clearErrorState();
    setStatus('disconnected');
  }, [clearErrorState]);

  return {
    status,
    portalId,
    hubDomain,
    error,
    errorInfo,
    expiresAt,
    needsRefresh,
    isLoading,
    isConnected: status === 'connected',
    connect,
    disconnect,
    retry,
    refreshToken,
    testConnection,
    checkSession,
  };
}

export default useHubSpot;
