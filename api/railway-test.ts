import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Test Railway connection without rateLimiter
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const RAILWAY_API_URL = process.env.RAILWAY_API_URL?.trim().replace(/\\n/g, '').replace(/\n/g, '');
  const RAILWAY_API_SECRET = (process.env.RAILWAY_API_SECRET || process.env.CRON_SECRET)?.trim().replace(/\\n/g, '').replace(/\n/g, '');
  
  if (!RAILWAY_API_URL) {
    return res.status(503).json({ error: 'RAILWAY_API_URL not configured' });
  }
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(`${RAILWAY_API_URL}/api/health`, {
      headers: {
        'Authorization': `Bearer ${RAILWAY_API_SECRET}`,
        'x-service-key': RAILWAY_API_SECRET || '',
      },
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    const data = await response.json();
    
    return res.status(response.status).json({
      railwayStatus: response.status,
      railwayOk: response.ok,
      data,
    });
  } catch (err) {
    return res.status(502).json({
      error: 'Failed to reach Railway',
      message: err instanceof Error ? err.message : 'Unknown error',
    });
  }
}
