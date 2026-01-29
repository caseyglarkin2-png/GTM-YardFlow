/**
 * HubSpot OAuth Callback Handler
 * Sprint 34 - A.2
 * 
 * Vercel Serverless Function for secure OAuth token exchange.
 * Exchanges authorization code for tokens SERVER-SIDE, never exposing client_secret.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

// =============================================================================
// Configuration
// =============================================================================

const HUBSPOT_TOKEN_URL = 'https://api.hubapi.com/oauth/v1/token';
const HUBSPOT_ACCOUNT_INFO_URL = 'https://api.hubapi.com/account-info/v3/details';
const SESSION_COOKIE_NAME = 'yardflow_hubspot_session';
const STATE_COOKIE_NAME = 'yardflow_hubspot_state';

// Cookie settings for secure token storage
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'Lax' as const,
  path: '/',
  maxAge: 60 * 60 * 24 * 30, // 30 days
};

// =============================================================================
// Types
// =============================================================================

interface HubSpotTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

interface HubSpotAccountInfo {
  portalId: number;
  accountType: string;
  timeZone: string;
  companyCurrency: string;
  additionalCurrencies: string[];
  utcOffset: string;
  utcOffsetMilliseconds: number;
  uiDomain: string;
  dataHostingLocation: string;
}

interface TokenData {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  portalId: string;
  hubDomain: string;
}

// =============================================================================
// Utilities
// =============================================================================

/**
 * Simple encryption for cookie data using AES-like transformation
 * In production, use a proper encryption library
 */
function encryptTokenData(data: TokenData, secret: string): string {
  const json = JSON.stringify(data);
  const encoded = Buffer.from(json).toString('base64');
  // Simple XOR with secret for basic obfuscation
  // In production, use proper AES encryption
  const key = secret.slice(0, 32).padEnd(32, '0');
  let result = '';
  for (let i = 0; i < encoded.length; i++) {
    result += String.fromCharCode(encoded.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return Buffer.from(result).toString('base64');
}

/**
 * Decrypt token data from cookie
 */
function decryptTokenData(encrypted: string, secret: string): TokenData | null {
  try {
    const key = secret.slice(0, 32).padEnd(32, '0');
    const decoded = Buffer.from(encrypted, 'base64').toString();
    let result = '';
    for (let i = 0; i < decoded.length; i++) {
      result += String.fromCharCode(decoded.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    const json = Buffer.from(result, 'base64').toString();
    return JSON.parse(json) as TokenData;
  } catch {
    return null;
  }
}

/**
 * Parse cookies from request header
 */
function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;

  cookieHeader.split(';').forEach(cookie => {
    const [name, ...rest] = cookie.split('=');
    if (name && rest.length > 0) {
      cookies[name.trim()] = rest.join('=').trim();
    }
  });

  return cookies;
}

/**
 * Set secure HttpOnly cookie
 */
function buildCookie(name: string, value: string, options?: { maxAge?: number; httpOnly?: boolean }): string {
  const parts = [
    `${name}=${value}`,
    options?.httpOnly === false ? '' : 'HttpOnly',
    `Path=${COOKIE_OPTIONS.path}`,
    `Max-Age=${options?.maxAge ?? COOKIE_OPTIONS.maxAge}`,
    `SameSite=${COOKIE_OPTIONS.sameSite}`,
  ].filter(Boolean);
  if (COOKIE_OPTIONS.secure) parts.push('Secure');
  return parts.join('; ');
}

function appendCookie(res: VercelResponse, cookie: string): void {
  const existing = res.getHeader('Set-Cookie');
  if (!existing) {
    res.setHeader('Set-Cookie', cookie);
    return;
  }
  if (Array.isArray(existing)) {
    res.setHeader('Set-Cookie', [...existing, cookie]);
  } else {
    res.setHeader('Set-Cookie', [existing as string, cookie]);
  }
}

function setTokenCookie(res: VercelResponse, tokenData: TokenData): void {
  const secret = process.env.HUBSPOT_CLIENT_SECRET;
  if (!secret) {
    throw new Error('Missing HUBSPOT_CLIENT_SECRET');
  }

  const encrypted = encryptTokenData(tokenData, secret);
  appendCookie(res, buildCookie(SESSION_COOKIE_NAME, encrypted));
}

/**
 * Clear the token cookie
 */
function clearTokenCookie(res: VercelResponse): void {
  appendCookie(res, buildCookie(SESSION_COOKIE_NAME, '', { maxAge: 0 }));
}

function clearStateCookie(res: VercelResponse): void {
  appendCookie(res, buildCookie(STATE_COOKIE_NAME, '', { maxAge: 0, httpOnly: false }));
}

/**
 * Validate state parameter to prevent CSRF attacks
 */
function validateState(receivedState: string, storedState: string | undefined): boolean {
  if (!receivedState || !storedState) {
    return false;
  }
  // Timing-safe comparison
  if (receivedState.length !== storedState.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < receivedState.length; i++) {
    result |= receivedState.charCodeAt(i) ^ storedState.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Get account info from HubSpot API
 */
async function getAccountInfo(accessToken: string): Promise<HubSpotAccountInfo | null> {
  try {
    const response = await fetch(HUBSPOT_ACCOUNT_INFO_URL, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      console.error('Failed to get account info:', response.status);
      return null;
    }
    
    return await response.json() as HubSpotAccountInfo;
  } catch (error) {
    console.error('Error fetching account info:', error);
    return null;
  }
}

// =============================================================================
// Main Handler
// =============================================================================

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  // Only allow GET requests (OAuth redirects)
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { code, state, error, error_description } = req.query;

  // Get configuration from environment
  const clientId = process.env.VITE_HUBSPOT_CLIENT_ID;
  const clientSecret = process.env.HUBSPOT_CLIENT_SECRET;
  const redirectUri = process.env.VITE_HUBSPOT_REDIRECT_URI;
  const frontendUrl = process.env.VITE_FRONTEND_URL || 
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:5173');

  // Validate configuration
  if (!clientId || !clientSecret || !redirectUri) {
    console.error('Missing HubSpot OAuth configuration');
    res.redirect(`${frontendUrl}/integrations?error=configuration_error&message=${encodeURIComponent('OAuth not configured')}`);
    return;
  }

  // Handle OAuth errors from HubSpot
  if (error) {
    const errorMessage = typeof error_description === 'string' 
      ? error_description 
      : 'Authorization failed';
    
    console.error('HubSpot OAuth error:', error, errorMessage);
    res.redirect(`${frontendUrl}/integrations?error=${error}&message=${encodeURIComponent(errorMessage)}`);
    return;
  }

  // Validate required parameters
  if (!code || typeof code !== 'string') {
    res.redirect(`${frontendUrl}/integrations?error=missing_code&message=${encodeURIComponent('No authorization code received')}`);
    return;
  }

  if (!state || typeof state !== 'string') {
    res.redirect(`${frontendUrl}/integrations?error=missing_state&message=${encodeURIComponent('No state parameter received')}`);
    return;
  }

  // Validate state from double-submit cookie
  const cookies = parseCookies(req.headers.cookie);
  const storedState = cookies[STATE_COOKIE_NAME];
  if (!validateState(state, storedState)) {
    clearStateCookie(res);
    res.redirect(`${frontendUrl}/integrations?error=invalid_state&message=${encodeURIComponent('State validation failed')}`);
    return;
  }

  try {
    // Exchange code for tokens SERVER-SIDE
    const tokenResponse = await fetch(HUBSPOT_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret, // Server-side only!
        redirect_uri: redirectUri,
        code: code,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json().catch(() => ({}));
      console.error('Token exchange failed:', tokenResponse.status, errorData);
      
      const errorMessage = (errorData as { message?: string }).message || 'Token exchange failed';
      res.redirect(`${frontendUrl}/integrations?error=token_exchange_failed&message=${encodeURIComponent(errorMessage)}`);
      return;
    }

    const tokens = await tokenResponse.json() as HubSpotTokenResponse;

    // Get account info for portal ID
    const accountInfo = await getAccountInfo(tokens.access_token);
    const portalId = accountInfo?.portalId?.toString() || 'unknown';
    const hubDomain = accountInfo?.uiDomain || 'app.hubspot.com';

    // Store tokens in secure HttpOnly cookie
    const tokenData: TokenData = {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: Date.now() + tokens.expires_in * 1000,
      portalId,
      hubDomain,
    };

    setTokenCookie(res, tokenData);
    clearStateCookie(res);

    // Redirect to frontend with success
    res.redirect(`${frontendUrl}/integrations?success=true&portalId=${portalId}`);
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.redirect(`${frontendUrl}/integrations?error=server_error&message=${encodeURIComponent('An unexpected error occurred')}`);
  }
}

// =============================================================================
// Exported utilities for other API routes
// =============================================================================

export { decryptTokenData, encryptTokenData, getAccountInfo, setTokenCookie, buildCookie, clearTokenCookie, parseCookies, STATE_COOKIE_NAME, SESSION_COOKIE_NAME, clearStateCookie, appendCookie, validateState };
export type { TokenData, HubSpotAccountInfo };
