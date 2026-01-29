/**
 * HubSpot OAuth Token Exchange Handler
 * Sprint 34 - A.2
 *
 * Exchanges authorization code for tokens on the server to avoid exposing
 * the HubSpot client secret. Returns token metadata to the client while
 * storing encrypted tokens in an HttpOnly cookie.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAccountInfo, setTokenCookie, parseCookies, STATE_COOKIE_NAME, clearStateCookie, validateState } from './callback';
import type { TokenData } from './callback';

const HUBSPOT_TOKEN_URL = 'https://api.hubapi.com/oauth/v1/token';

interface TokenExchangeRequest {
  code?: string;
  state?: string;
  redirectUri?: string;
  codeVerifier?: string;
}

interface TokenExchangeResponse {
  success: boolean;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  portalId?: string;
  hubDomain?: string;
  error?: string;
  message?: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method not allowed' });
    return;
  }

  const body = typeof req.body === 'string' ? safeParse(req.body) : req.body;
  const { code, state, redirectUri, codeVerifier } = (body || {}) as TokenExchangeRequest;

  const clientId = process.env.VITE_HUBSPOT_CLIENT_ID;
  const clientSecret = process.env.HUBSPOT_CLIENT_SECRET;
  const fallbackRedirect = process.env.VITE_HUBSPOT_REDIRECT_URI;

  if (!clientId || !clientSecret || !(redirectUri || fallbackRedirect)) {
    res.status(500).json({ success: false, error: 'OAuth not configured' } satisfies TokenExchangeResponse);
    return;
  }

  if (!code || typeof code !== 'string') {
    res.status(400).json({ success: false, error: 'Missing authorization code' } satisfies TokenExchangeResponse);
    return;
  }

  const cookies = parseCookies(req.headers.cookie);
  const storedState = cookies[STATE_COOKIE_NAME];
  if (!state || !validateState(state, storedState)) {
    clearStateCookie(res);
    res.status(400).json({ success: false, error: 'Invalid state parameter' } satisfies TokenExchangeResponse);
    return;
  }

  try {
    const tokenResponse = await fetch(HUBSPOT_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: (redirectUri || fallbackRedirect) as string,
        code,
        ...(codeVerifier ? { code_verifier: codeVerifier } : {}),
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json().catch(() => ({}));
      res.status(tokenResponse.status).json({
        success: false,
        error: (errorData as { message?: string }).message || 'Token exchange failed',
      } satisfies TokenExchangeResponse);
      return;
    }

    const tokens = await tokenResponse.json() as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
      token_type: string;
    };

    const accountInfo = await getAccountInfo(tokens.access_token);
    const portalId = accountInfo?.portalId?.toString() || 'unknown';
    const hubDomain = accountInfo?.uiDomain || 'app.hubspot.com';

    const tokenData: TokenData = {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: Date.now() + tokens.expires_in * 1000,
      portalId,
      hubDomain,
    };

    setTokenCookie(res, tokenData);
    clearStateCookie(res);

    res.status(200).json({
      success: true,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: tokenData.expiresAt,
      portalId,
      hubDomain,
    } satisfies TokenExchangeResponse);
  } catch (error) {
    console.error('[api/oauth/token] Token exchange failed', error);
    res.status(500).json({ success: false, error: 'An unexpected error occurred' } satisfies TokenExchangeResponse);
  }
}

function safeParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}
