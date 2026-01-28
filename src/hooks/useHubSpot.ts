/**
 * useHubSpot Hook
 * Sprint 34 - T34.1a/b
 * 
 * React hook for HubSpot OAuth integration.
 * Wraps HubSpotAuthService with React state management.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  createHubSpotAuthService, 
  HubSpotAuthService, 
  HubSpotAuthConfig 
} from '../services/HubSpotAuthService';

// =============================================================================
// Types
// =============================================================================

export type HubSpotConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface UseHubSpotReturn {
  /** Current connection status */
  status: HubSpotConnectionStatus;
  /** Portal ID when connected */
  portalId: string | null;
  /** Error message if status is 'error' */
  error: string | null;
  /** Whether currently connected */
  isConnected: boolean;
  /** Initiate OAuth connection */
  connect: () => Promise<void>;
  /** Disconnect and clear tokens */
  disconnect: () => void;
  /** Retry connection after error */
  retry: () => void;
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
function extractPortalId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('yardflow_hubspot_portal_id');
}

function storePortalId(portalId: string): void {
  localStorage.setItem('yardflow_hubspot_portal_id', portalId);
}

function clearPortalId(): void {
  localStorage.removeItem('yardflow_hubspot_portal_id');
}

// =============================================================================
// Hook Implementation
// =============================================================================

export function useHubSpot(options: UseHubSpotOptions = {}): UseHubSpotReturn {
  const {
    clientId = DEFAULT_CONFIG.clientId,
    redirectUri = DEFAULT_CONFIG.redirectUri,
    scopes = DEFAULT_CONFIG.scopes,
    autoCheck = true,
  } = options;

  // State
  const [status, setStatus] = useState<HubSpotConnectionStatus>('disconnected');
  const [portalId, setPortalId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Service ref (stable across renders)
  const serviceRef = useRef<HubSpotAuthService | null>(null);
  const initializingRef = useRef(false);

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

  // Check existing connection status
  const checkConnection = useCallback(async () => {
    const service = getService();
    if (!service) return;

    if (service.isConnected()) {
      setStatus('connected');
      setPortalId(extractPortalId());
    } else {
      setStatus('disconnected');
      setPortalId(null);
    }
  }, [getService]);

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
      
      // Store portal ID (would come from HubSpot API in production)
      // For now, extract from token or generate placeholder
      const newPortalId = 'portal-' + Date.now().toString(36);
      storePortalId(newPortalId);
      
      setPortalId(newPortalId);
      setStatus('connected');
      clearCallbackParams();
      
      console.log('[useHubSpot] OAuth callback successful, tokens received');
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'OAuth callback failed';
      setError(message);
      setStatus('error');
      clearCallbackParams();
      console.error('[useHubSpot] OAuth callback failed:', message);
      return false;
    }
  }, [getService]);

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
              
              if (code && state) {
                clearInterval(checkPopup);
                popup.close();
                
                // Handle callback
                service.handleCallback(code, state)
                  .then((tokens) => {
                    const newPortalId = 'portal-' + Date.now().toString(36);
                    storePortalId(newPortalId);
                    setPortalId(newPortalId);
                    setStatus('connected');
                  })
                  .catch((err) => {
                    setError(err.message);
                    setStatus('error');
                  });
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
        console.log('[useHubSpot] Popup blocked, redirecting...');
        window.location.href = authUrl;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start OAuth';
      setError(message);
      setStatus('error');
    }
  }, [getService, status]);

  // Disconnect function
  const disconnect = useCallback(() => {
    const service = getService();
    if (service) {
      service.disconnect();
    }
    clearPortalId();
    setPortalId(null);
    setStatus('disconnected');
    setError(null);
  }, [getService]);

  // Retry function
  const retry = useCallback(() => {
    setError(null);
    setStatus('disconnected');
  }, []);

  return {
    status,
    portalId,
    error,
    isConnected: status === 'connected',
    connect,
    disconnect,
    retry,
  };
}

export default useHubSpot;
