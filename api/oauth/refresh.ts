/**
 * HubSpot OAuth Token Refresh Handler
 * Sprint 34 - A.6
 * 
 * Vercel Serverless Function for refreshing HubSpot access tokens.
 * Uses refresh_token to get new access token without user interaction.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { decryptTokenData, encryptTokenData, getAccountInfo, buildCookie, clearTokenCookie as clearCookieHelper, parseCookies, SESSION_COOKIE_NAME, appendCookie } from './callback';
import type { TokenData } from './callback';

// =============================================================================
// Configuration
// =============================================================================

const HUBSPOT_TOKEN_URL = 'https://api.hubapi.com/oauth/v1/token';

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

interface RefreshResponse {
  success: boolean;
  accessToken?: string;
  expiresAt?: number;
  portalId?: string;
  hubDomain?: string;
  error?: string;
}

// =============================================================================
// Utilities
// =============================================================================

/**
 * Set secure HttpOnly cookie
 */
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
  clearCookieHelper(res);
}

// =============================================================================
// Main Handler
// =============================================================================

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  // Only allow POST requests
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // Get configuration from environment
  const clientId = process.env.VITE_HUBSPOT_CLIENT_ID;
  const clientSecret = process.env.HUBSPOT_CLIENT_SECRET;

  // Validate configuration
  if (!clientId || !clientSecret) {
    res.status(500).json({ 
      success: false, 
      error: 'OAuth not configured' 
    } as RefreshResponse);
    return;
  }

  // Parse existing token from cookie
  const cookies = parseCookies(req.headers.cookie);
  const encryptedSession = cookies[SESSION_COOKIE_NAME];

  if (!encryptedSession) {
    res.status(401).json({ 
      success: false, 
      error: 'No active session' 
    } as RefreshResponse);
    return;
  }

  const tokenData = decryptTokenData(encryptedSession, clientSecret);

  if (!tokenData) {
    clearTokenCookie(res);
    res.status(401).json({ 
      success: false, 
      error: 'Invalid session' 
    } as RefreshResponse);
    return;
  }

  // Check if refresh is actually needed (5 minute buffer)
  const REFRESH_BUFFER_MS = 5 * 60 * 1000;
  if (tokenData.expiresAt > Date.now() + REFRESH_BUFFER_MS) {
    // Token is still valid, return current expiry and access token
    res.status(200).json({
      success: true,
      accessToken: tokenData.accessToken,
      expiresAt: tokenData.expiresAt,
      portalId: tokenData.portalId,
      hubDomain: tokenData.hubDomain,
    } as RefreshResponse);
    return;
  }

  try {
    // Exchange refresh token for new access token
    const tokenResponse = await fetch(HUBSPOT_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: tokenData.refreshToken,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json().catch(() => ({}));
      console.error('Token refresh failed:', tokenResponse.status, errorData);
      
      // If refresh fails, clear the session
      clearTokenCookie(res);
      
      res.status(401).json({ 
        success: false, 
        error: 'Token refresh failed - please reconnect' 
      } as RefreshResponse);
      return;
    }

    const tokens = await tokenResponse.json() as HubSpotTokenResponse;

    // Update token data with new tokens
    const newTokenData: TokenData = {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: Date.now() + tokens.expires_in * 1000,
      portalId: tokenData.portalId,
      hubDomain: tokenData.hubDomain,
    };

    // Store updated tokens in cookie
    setTokenCookie(res, newTokenData);

    res.status(200).json({
      success: true,
      accessToken: newTokenData.accessToken,
      expiresAt: newTokenData.expiresAt,
      portalId: newTokenData.portalId,
      hubDomain: newTokenData.hubDomain,
    } as RefreshResponse);
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'An unexpected error occurred' 
    } as RefreshResponse);
  }
}

// =============================================================================
// Additional endpoints for session management
// =============================================================================

/**
 * Check if user has valid HubSpot session
 * Called by frontend to determine connection status
 */
export async function checkSession(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  const clientSecret = process.env.HUBSPOT_CLIENT_SECRET;
  
  if (!clientSecret) {
    res.status(500).json({ connected: false, error: 'Not configured' });
    return;
  }

  const cookies = parseCookies(req.headers.cookie);
  const encryptedSession = cookies['yardflow_hubspot_session'];

  if (!encryptedSession) {
    res.status(200).json({ connected: false });
    return;
  }

  const tokenData = decryptTokenData(encryptedSession, clientSecret);

  if (!tokenData) {
    res.status(200).json({ connected: false });
    return;
  }

  // Check if token is expired
  const isExpired = tokenData.expiresAt < Date.now();
  
  res.status(200).json({
    connected: !isExpired,
    portalId: tokenData.portalId,
    hubDomain: tokenData.hubDomain,
    expiresAt: tokenData.expiresAt,
    needsRefresh: tokenData.expiresAt < Date.now() + 5 * 60 * 1000,
  });
}
