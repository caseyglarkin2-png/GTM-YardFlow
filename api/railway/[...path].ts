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

const RAILWAY_API_URL = process.env.RAILWAY_API_URL;
const RAILWAY_API_SECRET = process.env.RAILWAY_API_SECRET;

// P0 Security Fix: Fail if RAILWAY_API_URL is not configured
if (!RAILWAY_API_URL && process.env.NODE_ENV === 'production') {
  console.error('CRITICAL: RAILWAY_API_URL environment variable is required');
}

// Request timeout in milliseconds (30 seconds)
const REQUEST_TIMEOUT_MS = 30000;

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
  // P0 Security Fix: Decode and sanitize path before validation
  try {
    const decodedPath = decodeURIComponent(path);
    // Reject paths with path traversal attempts
    if (decodedPath.includes('..') || decodedPath.includes('//')) {
      return false;
    }
    return ALLOWED_PATHS.some(allowed => decodedPath.startsWith(allowed));
  } catch {
    return false;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // P0 Security Fix: Fail early if not configured
  if (!RAILWAY_API_URL) {
    console.error('RAILWAY_API_URL not configured');
    return res.status(503).json({
      error: 'Service Unavailable',
      message: 'Railway backend not configured',
    });
  }

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

  // P0 Security Fix: Add request timeout with AbortController
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

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

    // Forward the request with timeout signal
    const fetchOptions: RequestInit = {
      method: req.method,
      headers,
      signal: controller.signal,
    };

    // Include body for POST/PUT/PATCH requests
    if (['POST', 'PUT', 'PATCH'].includes(req.method || '')) {
      fetchOptions.body = JSON.stringify(req.body);
    }

    const response = await fetch(targetUrl, fetchOptions);

    // Clear timeout on successful response
    clearTimeout(timeoutId);

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
    // Clear timeout on error
    clearTimeout(timeoutId);
    
    console.error('Railway proxy error:', error);
    
    // P1 Security Fix: Don't expose error details in production
    const isProduction = process.env.NODE_ENV === 'production';
    
    // Check if it was a timeout
    if (error instanceof Error && error.name === 'AbortError') {
      return res.status(504).json({
        error: 'Gateway Timeout',
        message: 'Railway backend did not respond in time',
      });
    }
    
    return res.status(502).json({
      error: 'Bad Gateway',
      message: 'Failed to reach Railway backend',
      ...(isProduction ? {} : { details: error instanceof Error ? error.message : 'Unknown error' }),
    });
  }
}
