import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Railway API Proxy
 * 
 * Forwards requests to the Railway backend for email/outreach functionality.
 * This allows the Vercel frontend to leverage Railway's robust email infrastructure.
 * 
 * Usage: /api/railway/[...path]
 * Example: /api/railway/outreach/send-email → https://railway/api/outreach/send-email
 */

const RAILWAY_API_URL = process.env.RAILWAY_API_URL || 'https://yardflow-hitlist-production-2f41.up.railway.app';
const RAILWAY_API_SECRET = process.env.RAILWAY_API_SECRET;

// Allowed paths that can be proxied to Railway
const ALLOWED_PATHS = [
  '/api/health',
  '/api/outreach/send-email',
  '/api/outreach/generate-ai',
  '/api/outreach/export',
  '/api/enrichment/email',
  '/api/enrichment/smart-guess',
  '/api/sequences',
  '/api/cron/sequences',
  '/api/ai/content/generate',
];

function isPathAllowed(path: string): boolean {
  return ALLOWED_PATHS.some(allowed => path.startsWith(allowed));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Extract the path from the URL (everything after /api/railway)
  const { url } = req;
  const pathMatch = url?.match(/\/api\/railway(.+)/);
  const targetPath = pathMatch ? pathMatch[1] : '';

  if (!targetPath || !isPathAllowed('/api' + targetPath.split('?')[0])) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'This path is not allowed through the proxy',
    });
  }

  const targetUrl = `${RAILWAY_API_URL}/api${targetPath}`;

  try {
    // Prepare headers
    const headers: HeadersInit = {
      'Content-Type': req.headers['content-type'] || 'application/json',
    };

    // Forward authentication if present
    if (req.headers.cookie) {
      headers['Cookie'] = req.headers.cookie;
    }
    if (req.headers.authorization) {
      headers['Authorization'] = req.headers.authorization;
    }

    // Add Railway API secret if configured
    if (RAILWAY_API_SECRET) {
      headers['X-Railway-Secret'] = RAILWAY_API_SECRET;
    }

    // Forward the request
    const fetchOptions: RequestInit = {
      method: req.method,
      headers,
    };

    // Include body for POST/PUT/PATCH requests
    if (['POST', 'PUT', 'PATCH'].includes(req.method || '')) {
      fetchOptions.body = JSON.stringify(req.body);
    }

    const response = await fetch(targetUrl, fetchOptions);

    // Forward response headers
    response.headers.forEach((value, key) => {
      if (!['content-encoding', 'transfer-encoding'].includes(key.toLowerCase())) {
        res.setHeader(key, value);
      }
    });

    // Forward status and body
    const data = await response.json().catch(() => ({}));
    return res.status(response.status).json(data);

  } catch (error) {
    console.error('Railway proxy error:', error);
    return res.status(502).json({
      error: 'Bad Gateway',
      message: 'Failed to reach Railway backend',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
