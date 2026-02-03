import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Debug endpoint to check Railway configuration
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const RAILWAY_API_URL = process.env.RAILWAY_API_URL?.trim().replace(/\\n/g, '').replace(/\n/g, '');
  const hasSecret = !!(process.env.RAILWAY_API_SECRET || process.env.CRON_SECRET);
  
  // Test fetch to Railway health
  let railwayStatus = 'unknown';
  let railwayError = null;
  
  if (RAILWAY_API_URL) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch(`${RAILWAY_API_URL}/api/health`, {
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      railwayStatus = response.ok ? 'reachable' : `error: ${response.status}`;
    } catch (err) {
      railwayStatus = 'error';
      railwayError = err instanceof Error ? err.message : 'Unknown error';
    }
  }
  
  return res.status(200).json({
    hasUrl: !!RAILWAY_API_URL,
    urlLength: RAILWAY_API_URL?.length || 0,
    urlEndsWithSlash: RAILWAY_API_URL?.endsWith('/') || false,
    hasSecret,
    railwayStatus,
    railwayError,
    nodeVersion: process.version,
  });
}
