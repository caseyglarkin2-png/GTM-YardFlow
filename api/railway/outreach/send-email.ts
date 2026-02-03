import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Direct route for send-email to work around catch-all POST issues
 * Delegates to the main Railway proxy handler
 */

// Trim to handle trailing newlines from copy/paste in Vercel dashboard
const RAILWAY_API_URL = process.env.RAILWAY_API_URL?.trim();
const RAILWAY_API_SECRET = (process.env.RAILWAY_API_SECRET || process.env.CRON_SECRET)?.trim();

const REQUEST_TIMEOUT_MS = 30000;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!RAILWAY_API_URL) {
    return res.status(503).json({
      error: 'Service Unavailable',
      message: 'Railway backend not configured',
    });
  }

  const targetUrl = `${RAILWAY_API_URL}/api/outreach/send-email`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    // Add S2S auth
    if (RAILWAY_API_SECRET) {
      headers['Authorization'] = `Bearer ${RAILWAY_API_SECRET}`;
      headers['x-service-key'] = RAILWAY_API_SECRET;
    }

    // Forward cookies if present
    if (req.headers.cookie) {
      headers['Cookie'] = req.headers.cookie;
    }

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(req.body),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const data = await response.json().catch(() => ({}));

    return res.status(response.status).json(data);
  } catch (error: unknown) {
    clearTimeout(timeoutId);
    
    if (error instanceof Error && error.name === 'AbortError') {
      return res.status(504).json({ error: 'Request timed out' });
    }

    console.error('Railway proxy error:', error);
    return res.status(502).json({
      error: 'Bad Gateway',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
