/**
 * HubSpot OAuth Session Check Handler
 * Sprint 34 - A.6
 * 
 * Vercel Serverless Function to check HubSpot session status.
 * Returns connection status and portal info without exposing tokens.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

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

// =============================================================================
// Main Handler
// =============================================================================

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  try {
    // Handle both GET and DELETE methods
    if (req.method !== 'GET' && req.method !== 'DELETE') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    // Check if HubSpot is configured BEFORE loading crypto-heavy module
    const clientSecret = process.env.HUBSPOT_CLIENT_SECRET;
    
    if (!clientSecret) {
      // Not configured - return gracefully without loading callback module
      if (req.method === 'DELETE') {
        res.status(200).json({ success: true, message: 'Session cleared (no HubSpot configured)' });
        return;
      }
      res.status(200).json({ 
        connected: false, 
        error: 'OAuth not configured' 
      } as SessionResponse);
      return;
    }

    // Only load the callback module if HubSpot is configured
    // This avoids crypto initialization issues when not needed
    let callbackModule;
    try {
      callbackModule = await import('./callback');
    } catch (importErr) {
      console.error('[oauth/session] Failed to load callback module:', importErr);
      if (req.method === 'DELETE') {
        res.status(200).json({ success: true, message: 'Session cleared (module unavailable)' });
        return;
      }
      res.status(200).json({ 
        connected: false, 
        error: 'OAuth module unavailable' 
      } as SessionResponse);
      return;
    }

    const { decryptTokenData, clearTokenCookie, parseCookies, SESSION_COOKIE_NAME } = callbackModule;

    // Handle DELETE - disconnect session
    if (req.method === 'DELETE') {
      clearTokenCookie(res);
      res.status(200).json({ success: true, message: 'Session cleared' });
      return;
    }

    // GET - check session status
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
  } catch (err) {
    console.error('[oauth/session] Error:', err);
    // Return JSON error instead of 500 HTML
    res.status(200).json({ 
      connected: false, 
      error: 'Session check failed' 
    } as SessionResponse);
  }
}
