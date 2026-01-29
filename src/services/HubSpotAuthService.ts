/**
 * HubSpot OAuth 2.0 Authentication Service
 * Sprint 26 - T26.2
 * 
 * Implements OAuth 2.0 authorization code flow with PKCE for SPAs.
 */

import { HubSpotTokens, HubSpotTokensSchema, AuthenticationError } from '../types/hubspot';

// =============================================================================
// Configuration
// =============================================================================

const HUBSPOT_AUTH_URL = 'https://app.hubspot.com/oauth/authorize';
const BACKEND_TOKEN_URL = '/api/oauth/token';
const BACKEND_REFRESH_URL = '/api/oauth/refresh';

const DEFAULT_SCOPES = [
  'crm.objects.contacts.read',
  'crm.objects.contacts.write',
  'crm.objects.deals.read',
  'crm.objects.deals.write',
];

const STORAGE_KEYS = {
  state: 'yardflow_hubspot_state',
  codeVerifier: 'yardflow_hubspot_code_verifier',
  tokens: 'yardflow_hubspot_tokens',
} as const;

// Token refresh buffer (5 minutes before expiry)
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;

function setStateCookie(state: string): void {
  if (typeof document === 'undefined') return;
  const secure = typeof window !== 'undefined' && window.location.protocol === 'https:';
  document.cookie = `${STORAGE_KEYS.state}=${state}; Path=/; SameSite=Lax; Max-Age=600${secure ? '; Secure' : ''}`;
}

// =============================================================================
// PKCE Utilities
// =============================================================================

/**
 * Generate cryptographically secure random string for PKCE
 */
function generateRandomString(length: number): string {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const randomValues = new Uint8Array(length);
  crypto.getRandomValues(randomValues);
  return Array.from(randomValues)
    .map((v) => charset[v % charset.length])
    .join('');
}

/**
 * Generate SHA-256 hash for PKCE code challenge
 */
async function sha256(plain: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  return crypto.subtle.digest('SHA-256', data);
}

/**
 * Base64URL encode for PKCE
 */
function base64UrlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Generate PKCE code challenge from verifier
 */
async function generateCodeChallenge(verifier: string): Promise<string> {
  const hash = await sha256(verifier);
  return base64UrlEncode(hash);
}

// =============================================================================
// HubSpot Auth Service
// =============================================================================

export interface HubSpotAuthConfig {
  clientId: string;
  redirectUri: string;
  scopes?: string[];
  tenantId?: string;
}

export interface HubSpotTokensWithMetadata extends HubSpotTokens {
  portalId?: string;
  hubDomain?: string;
}

export interface HubSpotAuthService {
  getAuthUrl(): Promise<string>;
  handleCallback(code: string, state: string): Promise<HubSpotTokensWithMetadata>;
  getAccessToken(): Promise<string | null>;
  refreshToken(): Promise<HubSpotTokens>;
  isConnected(): boolean;
  getTokens(): Promise<HubSpotTokens | null>;
  disconnect(): void;
}

export function createHubSpotAuthService(config: HubSpotAuthConfig): HubSpotAuthService {
  const { 
    clientId, 
    redirectUri, 
    scopes = DEFAULT_SCOPES,
    // tenantId reserved for future multi-tenant support
  } = config;

  // In-memory token cache for faster access
  let cachedTokens: HubSpotTokens | null = null;
  let refreshPromise: Promise<HubSpotTokens> | null = null;

  /**
   * Generate authorization URL with PKCE
   */
  async function getAuthUrl(): Promise<string> {
    const state = generateRandomString(32);
    sessionStorage.setItem(STORAGE_KEYS.state, state);
    setStateCookie(state);

    // When redirecting to our server callback, we do not need PKCE because the
    // client secret is used server-side. For SPA callbacks, keep PKCE enabled.
    const usePkce = !redirectUri.includes('/api/oauth/callback');
    let codeChallenge: string | undefined;
    let codeVerifier: string | undefined;

    if (usePkce) {
      codeVerifier = generateRandomString(64);
      codeChallenge = await generateCodeChallenge(codeVerifier);
      sessionStorage.setItem(STORAGE_KEYS.codeVerifier, codeVerifier);
    } else {
      sessionStorage.removeItem(STORAGE_KEYS.codeVerifier);
    }

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: scopes.join(' '),
      state,
    });

    if (codeChallenge) {
      params.set('code_challenge', codeChallenge);
      params.set('code_challenge_method', 'S256');
    }

    return `${HUBSPOT_AUTH_URL}?${params.toString()}`;
  }

  /**
   * Handle OAuth callback
   */
  async function handleCallback(code: string, state: string): Promise<HubSpotTokensWithMetadata> {
    // Verify state parameter
    const storedState = sessionStorage.getItem(STORAGE_KEYS.state);
    if (!storedState || storedState !== state) {
      throw new AuthenticationError('Invalid state parameter - possible CSRF attack');
    }

    const codeVerifier = sessionStorage.getItem(STORAGE_KEYS.codeVerifier);

    const response = await fetch(BACKEND_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        code,
        state,
        redirectUri,
        codeVerifier: codeVerifier || undefined,
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !(data as { success?: boolean }).success) {
      const message = (data as { error?: string; message?: string }).error || (data as { message?: string }).message || 'Token exchange failed';
      throw new AuthenticationError(message);
    }

    const expiresAt = (data as { expiresAt?: number }).expiresAt || Date.now();
    const tokens: HubSpotTokens = {
      accessToken: (data as { accessToken: string }).accessToken,
      refreshToken: (data as { refreshToken?: string }).refreshToken || '',
      expiresIn: Math.max(0, Math.floor((expiresAt - Date.now()) / 1000)),
      expiresAt,
      tokenType: 'bearer',
    };

    const validated = HubSpotTokensSchema.parse(tokens);
    await storeTokens(validated);

    // Clear OAuth session data
    sessionStorage.removeItem(STORAGE_KEYS.state);
    sessionStorage.removeItem(STORAGE_KEYS.codeVerifier);

    return {
      ...validated,
      portalId: (data as { portalId?: string }).portalId,
      hubDomain: (data as { hubDomain?: string }).hubDomain,
    };
  }

  /**
   * Store tokens securely
   */
  async function storeTokens(tokens: HubSpotTokens): Promise<void> {
    cachedTokens = tokens;
    // Also persist to localStorage for isConnected() check
    try {
      const data = JSON.stringify(tokens);
      // Simple base64 encoding - actual token security is via HttpOnly cookies from server
      const encoded = btoa(data);
      localStorage.setItem(STORAGE_KEYS.tokens, encoded);
    } catch {
      // Silent fail - cache is primary storage now
    }
  }

  /**
   * Load tokens from storage
   */
  async function loadTokens(): Promise<HubSpotTokens | null> {
    if (cachedTokens) {
      return cachedTokens;
    }

    const encoded = localStorage.getItem(STORAGE_KEYS.tokens);
    if (!encoded) {
      return null;
    }

    try {
      // Decode base64 stored tokens (matches storeTokens encoding)
      const decoded = atob(encoded);
      const tokens = HubSpotTokensSchema.parse(JSON.parse(decoded));
      cachedTokens = tokens;
      return tokens;
    } catch {
      // Invalid or corrupted tokens
      localStorage.removeItem(STORAGE_KEYS.tokens);
      return null;
    }
  }

  /**
   * Get valid access token, refreshing if needed
   */
  async function getAccessToken(): Promise<string | null> {
    let tokens = await loadTokens();

    // If we do not have cached tokens but a server session exists, try refreshing to bootstrap
    if (!tokens) {
      try {
        tokens = await refreshTokenInternal();
      } catch {
        return null;
      }
    }

    if (!tokens) {
      return null;
    }

    // Check if token needs refresh
    const needsRefresh = Date.now() >= tokens.expiresAt - TOKEN_REFRESH_BUFFER_MS;
    
    if (needsRefresh) {
      try {
        const refreshed = await refreshTokenInternal();
        return refreshed.accessToken;
      } catch {
        // Refresh failed, token is invalid
        disconnect();
        return null;
      }
    }

    return tokens.accessToken;
  }

  /**
   * Refresh the access token
   */
  async function refreshTokenInternal(): Promise<HubSpotTokens> {
    // Dedupe concurrent refresh requests
    if (refreshPromise) {
      return refreshPromise;
    }

    refreshPromise = (async () => {
      const existing = await loadTokens();

      const response = await fetch(BACKEND_REFRESH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !(data as { success?: boolean }).success) {
        const message = (data as { error?: string }).error || 'Failed to refresh token';
        throw new AuthenticationError(message);
      }

      const expiresAt = (data as { expiresAt?: number }).expiresAt || Date.now();
      const refreshed: HubSpotTokens = {
        accessToken: (data as { accessToken: string }).accessToken,
        refreshToken: (data as { refreshToken?: string }).refreshToken || existing?.refreshToken || '',
        expiresIn: Math.max(0, Math.floor((expiresAt - Date.now()) / 1000)),
        expiresAt,
        tokenType: 'bearer',
      };

      const validated = HubSpotTokensSchema.parse(refreshed);
      await storeTokens(validated);

      return validated;
    })();

    try {
      return await refreshPromise;
    } finally {
      refreshPromise = null;
    }
  }

  /**
   * Public refresh token method
   */
  async function refreshToken(): Promise<HubSpotTokens> {
    return refreshTokenInternal();
  }

  /**
   * Check if connected (has valid tokens)
   */
  function isConnected(): boolean {
    const encrypted = localStorage.getItem(STORAGE_KEYS.tokens);
    return encrypted !== null;
  }

  /**
   * Get current tokens
   */
  async function getTokens(): Promise<HubSpotTokens | null> {
    return loadTokens();
  }

  /**
   * Disconnect / clear all tokens
   */
  function disconnect(): void {
    cachedTokens = null;
    localStorage.removeItem(STORAGE_KEYS.tokens);
    sessionStorage.removeItem(STORAGE_KEYS.state);
    sessionStorage.removeItem(STORAGE_KEYS.codeVerifier);
  }

  return {
    getAuthUrl,
    handleCallback,
    getAccessToken,
    refreshToken,
    isConnected,
    getTokens,
    disconnect,
  };
}

// =============================================================================
// Export default instance factory
// =============================================================================

let defaultInstance: HubSpotAuthService | null = null;

export function getHubSpotAuthService(config?: HubSpotAuthConfig): HubSpotAuthService {
  if (!defaultInstance && config) {
    defaultInstance = createHubSpotAuthService(config);
  }
  
  if (!defaultInstance) {
    throw new Error('HubSpot Auth Service not initialized. Call with config first.');
  }
  
  return defaultInstance;
}

export function resetHubSpotAuthService(): void {
  defaultInstance = null;
}
