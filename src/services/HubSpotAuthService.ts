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
const HUBSPOT_TOKEN_URL = 'https://api.hubapi.com/oauth/v1/token';

const DEFAULT_SCOPES = [
  'crm.objects.contacts.read',
  'crm.objects.contacts.write',
  'crm.objects.deals.read',
  'crm.objects.deals.write',
];

const STORAGE_KEYS = {
  tokens: 'yardflow_hubspot_tokens',
  state: 'yardflow_hubspot_state',
  codeVerifier: 'yardflow_hubspot_code_verifier',
} as const;

// Token refresh buffer (5 minutes before expiry)
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;

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
// Simple Encryption (for token storage)
// Using Web Crypto API with AES-GCM
// =============================================================================

async function getEncryptionKey(tenantId: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(tenantId.padEnd(32, '0').slice(0, 32)),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode('yardflow-hubspot-salt'),
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function encryptData(data: string, tenantId: string): Promise<string> {
  const key = await getEncryptionKey(tenantId);
  const encoder = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(data)
  );
  
  // Combine IV and encrypted data
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), iv.length);
  
  return base64UrlEncode(combined.buffer);
}

async function decryptData(encryptedData: string, tenantId: string): Promise<string> {
  const key = await getEncryptionKey(tenantId);
  
  // Decode base64url
  const binary = atob(encryptedData.replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  
  // Extract IV and encrypted data
  const iv = bytes.slice(0, 12);
  const data = bytes.slice(12);
  
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );
  
  return new TextDecoder().decode(decrypted);
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

export interface HubSpotAuthService {
  getAuthUrl(): Promise<string>;
  handleCallback(code: string, state: string): Promise<HubSpotTokens>;
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
    tenantId = 'default',
  } = config;

  // In-memory token cache for faster access
  let cachedTokens: HubSpotTokens | null = null;
  let refreshPromise: Promise<HubSpotTokens> | null = null;

  /**
   * Generate authorization URL with PKCE
   */
  async function getAuthUrl(): Promise<string> {
    // Generate PKCE values
    const codeVerifier = generateRandomString(64);
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    const state = generateRandomString(32);

    // Store for callback verification
    sessionStorage.setItem(STORAGE_KEYS.codeVerifier, codeVerifier);
    sessionStorage.setItem(STORAGE_KEYS.state, state);

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: scopes.join(' '),
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    return `${HUBSPOT_AUTH_URL}?${params.toString()}`;
  }

  /**
   * Handle OAuth callback
   */
  async function handleCallback(code: string, state: string): Promise<HubSpotTokens> {
    // Verify state parameter
    const storedState = sessionStorage.getItem(STORAGE_KEYS.state);
    if (!storedState || storedState !== state) {
      throw new AuthenticationError('Invalid state parameter - possible CSRF attack');
    }

    // Get code verifier
    const codeVerifier = sessionStorage.getItem(STORAGE_KEYS.codeVerifier);
    if (!codeVerifier) {
      throw new AuthenticationError('Code verifier not found - restart OAuth flow');
    }

    // Exchange code for tokens
    const response = await fetch(HUBSPOT_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId,
        redirect_uri: redirectUri,
        code,
        code_verifier: codeVerifier,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Token exchange failed' }));
      throw new AuthenticationError(error.message || 'Failed to exchange code for tokens');
    }

    const data = await response.json();
    
    // Build tokens object
    const tokens: HubSpotTokens = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
      expiresAt: Date.now() + data.expires_in * 1000,
      tokenType: 'bearer',
    };

    // Validate tokens
    const validated = HubSpotTokensSchema.parse(tokens);

    // Store tokens
    await storeTokens(validated);

    // Clear OAuth session data
    sessionStorage.removeItem(STORAGE_KEYS.state);
    sessionStorage.removeItem(STORAGE_KEYS.codeVerifier);

    return validated;
  }

  /**
   * Store tokens securely
   */
  async function storeTokens(tokens: HubSpotTokens): Promise<void> {
    cachedTokens = tokens;
    const encrypted = await encryptData(JSON.stringify(tokens), tenantId);
    localStorage.setItem(STORAGE_KEYS.tokens, encrypted);
  }

  /**
   * Load tokens from storage
   */
  async function loadTokens(): Promise<HubSpotTokens | null> {
    if (cachedTokens) {
      return cachedTokens;
    }

    const encrypted = localStorage.getItem(STORAGE_KEYS.tokens);
    if (!encrypted) {
      return null;
    }

    try {
      const decrypted = await decryptData(encrypted, tenantId);
      const tokens = HubSpotTokensSchema.parse(JSON.parse(decrypted));
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
    const tokens = await loadTokens();
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
      const tokens = await loadTokens();
      if (!tokens) {
        throw new AuthenticationError('No tokens to refresh');
      }

      const response = await fetch(HUBSPOT_TOKEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: clientId,
          refresh_token: tokens.refreshToken,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Token refresh failed' }));
        throw new AuthenticationError(error.message || 'Failed to refresh token');
      }

      const data = await response.json();
      
      const newTokens: HubSpotTokens = {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresIn: data.expires_in,
        expiresAt: Date.now() + data.expires_in * 1000,
        tokenType: 'bearer',
      };

      const validated = HubSpotTokensSchema.parse(newTokens);
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
