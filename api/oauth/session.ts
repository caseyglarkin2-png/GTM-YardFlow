/**
 * HubSpot OAuth Session Check Handler
 * Sprint 34 - A.6
 * 
 * Vercel Serverless Function to check HubSpot session status.
 * Returns connection status and portal info without exposing tokens.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { decryptTokenData, clearTokenCookie as clearCookieHelper, parseCookies, SESSION_COOKIE_NAME } from './callback';
import type { TokenData } from './callback';

// =============================================================================
// Types
// =============================================================================

interface SessionResponse {
  connected: boolean;
  portalId?: string;
  hubDomain?: string;
  expiresAt?: number;
  needsRefresh?: boolean;
  error?: string;
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
  // Handle both GET and DELETE methods
  if (req.method !== 'GET' && req.method !== 'DELETE') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // Handle DELETE - disconnect session
  if (req.method === 'DELETE') {
    clearTokenCookie(res);
    res.status(200).json({ success: true, message: 'Session cleared' });
    return;
  }

  // GET - check session status
  const clientSecret = process.env.HUBSPOT_CLIENT_SECRET;
  
  if (!clientSecret) {
    res.status(200).json({ 
      connected: false, 
      error: 'OAuth not configured' 
    } as SessionResponse);
    return;
  }

  const cookies = parseCookies(req.headers.cookie);
  const encryptedSession = cookies[SESSION_COOKIE_NAME];

  if (!encryptedSession) {
    res.status(200).json({ connected: false } as SessionResponse);
    return;
  }

  const tokenData = decryptTokenData(encryptedSession, clientSecret);

  if (!tokenData) {
    // Invalid session, clear it
    clearTokenCookie(res);
    res.status(200).json({ connected: false } as SessionResponse);
    return;
  }

  // Check if token is expired
  const now = Date.now();
  const isExpired = tokenData.expiresAt < now;
  const needsRefresh = tokenData.expiresAt < now + 5 * 60 * 1000; // 5 minute buffer
  
  if (isExpired) {
    // Token is expired, user needs to refresh
    res.status(200).json({
      connected: false,
      portalId: tokenData.portalId,
      needsRefresh: true,
    } as SessionResponse);
    return;
  }

  res.status(200).json({
    connected: true,
    portalId: tokenData.portalId,
    hubDomain: tokenData.hubDomain,
    expiresAt: tokenData.expiresAt,
    needsRefresh,
  } as SessionResponse);
}
