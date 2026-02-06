import type { VercelRequest, VercelResponse } from '@vercel/node';
import { randomUUID } from 'crypto';

/**
 * Railway API Proxy
 * 
 * Forwards requests to the Railway backend for email/outreach functionality.
 * This allows the Vercel frontend to leverage Railway's robust email infrastructure.
 * 
 * Features:
 * - Auth token forwarding (T91.3)
 * - Request logging (T92.1)
 * - Circuit breaker (T92.3)
 * - Response caching (T92.4)
 * 
 * NOTE: Rate limiting is handled by Railway backend - no duplicate rate limiting here.
 * 
 * Usage: /api/railway/[...path]
 * Example: /api/railway/outreach/send-email → https://railway/api/outreach/send-email
 */

// Trim and sanitize to handle trailing newlines/escape chars from copy/paste in Vercel dashboard
const RAILWAY_API_URL = process.env.RAILWAY_API_URL?.trim().replace(/\\n/g, '').replace(/\n/g, '');

// S2S Authentication: Priority order for Railway API secret
// 1. SERVICE_TO_SERVICE_SECRET (new standard)
// 2. RAILWAY_API_SECRET (legacy)
// 3. CRON_SECRET (fallback for cron endpoints)
const SERVICE_TO_SERVICE_SECRET = (
  process.env.SERVICE_TO_SERVICE_SECRET || 
  process.env.RAILWAY_API_SECRET || 
  process.env.CRON_SECRET
)?.trim().replace(/\\n/g, '').replace(/\n/g, '');

// P0 Security Fix: Fail if RAILWAY_API_URL is not configured
if (!RAILWAY_API_URL && process.env.NODE_ENV === 'production') {
  console.error('CRITICAL: RAILWAY_API_URL environment variable is required');
}

// Request timeout in milliseconds (30 seconds)
const REQUEST_TIMEOUT_MS = 30000;

function getRequestIp(req: VercelRequest): string {
  return req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim()
    || req.socket?.remoteAddress
    || 'unknown';
}

// =============================================================================
// T92.3: Circuit Breaker Configuration
// =============================================================================
const CIRCUIT_BREAKER_THRESHOLD = 5; // failures before opening
const CIRCUIT_BREAKER_TIMEOUT_MS = 30000; // time to wait before half-open
const circuitBreaker = {
  failures: 0,
  lastFailureTime: 0,
  state: 'closed' as 'closed' | 'open' | 'half-open',
};

function checkCircuitBreaker(): { allowed: boolean; state: string } {
  const now = Date.now();

  if (circuitBreaker.state === 'open') {
    if (now - circuitBreaker.lastFailureTime > CIRCUIT_BREAKER_TIMEOUT_MS) {
      circuitBreaker.state = 'half-open';
      return { allowed: true, state: 'half-open' };
    }
    return { allowed: false, state: 'open' };
  }

  return { allowed: true, state: circuitBreaker.state };
}

function recordSuccess(): void {
  circuitBreaker.failures = 0;
  circuitBreaker.state = 'closed';
}

function recordFailure(): void {
  circuitBreaker.failures++;
  circuitBreaker.lastFailureTime = Date.now();
  if (circuitBreaker.failures >= CIRCUIT_BREAKER_THRESHOLD) {
    circuitBreaker.state = 'open';
  }
}

// =============================================================================
// T92.4: Response Cache Configuration
// =============================================================================
const CACHE_TTL_MS = 5000; // 5 seconds for health checks
const responseCache = new Map<string, { data: unknown; timestamp: number; status: number }>();

const CACHEABLE_PATHS = ['/api/health']; // Only cache GET requests to these paths

function getCacheKey(method: string, path: string): string | null {
  if (method !== 'GET') return null;
  const normalizedPath = path.split('?')[0];
  if (!CACHEABLE_PATHS.some(p => normalizedPath.startsWith(p))) return null;
  return `${method}:${path}`;
}

function getCachedResponse(key: string): { data: unknown; status: number } | null {
  const entry = responseCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    responseCache.delete(key);
    return null;
  }
  return { data: entry.data, status: entry.status };
}

function setCachedResponse(key: string, data: unknown, status: number): void {
  responseCache.set(key, { data, timestamp: Date.now(), status });
}

// =============================================================================
// Allowed Paths
// =============================================================================
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
  '/api/ai/content',
  '/api/ai/dossier',
  '/api/ai/research',
  '/api/ai/status',
  '/api/ai/conversations',
  // NEW: Prospects (Sprint 93)
  '/api/prospects',
  // NEW: Enrollments (Sprint 94)
  '/api/enrollments',
  // NEW: Email Queue (Sprint 95-96)
  '/api/email/queue',
  '/api/email/events',
  '/api/email/analytics',
  '/api/email/send',
  '/api/email/warmup',
  '/api/webhooks/sendgrid',
  // NEW: Auth (Sprint 97)
  '/api/auth',
  '/api/users',
  // NEW: Templates (Sprint 38)
  '/api/templates',
  // NEW: Dashboards (Frontend Integration)
  '/api/dashboards',
  '/api/campaigns',
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
  const startTime = Date.now();
  const requestId = randomUUID().slice(0, 8);
  
  // =============================================================================
  // T92.1: Request Logging
  // =============================================================================
  const logRequest = (status: number, message?: string) => {
    const duration = Date.now() - startTime;
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      requestId,
      method: req.method,
      path: req.url,
      status,
      duration,
      message,
      ip: getRequestIp(req),
      circuitState: circuitBreaker.state,
    }));
  };

  // P0 Security Fix: Fail early if not configured
  if (!RAILWAY_API_URL) {
    logRequest(503, 'RAILWAY_API_URL not configured');
    return res.status(503).json({
      error: 'Service Unavailable',
      message: 'Railway backend not configured',
    });
  }

  // NOTE: Rate limiting removed - Railway backend handles its own rate limiting
  // This avoids double rate limiting and ES2015 compatibility issues with Map.entries()

  // =============================================================================
  // T92.3: Circuit Breaker Check
  // =============================================================================
  const circuit = checkCircuitBreaker();
  res.setHeader('X-Circuit-State', circuit.state);

  if (!circuit.allowed) {
    logRequest(503, 'Circuit breaker open');
    return res.status(503).json({
      error: 'Service Unavailable',
      message: 'Railway backend is temporarily unavailable. Please try again later.',
      circuitState: 'open',
    });
  }

  // Extract the path from the URL (everything after /api/railway)
  const { url } = req;
  const pathMatch = url?.match(/\/api\/railway(.+)/);
  const targetPath = pathMatch ? pathMatch[1] : '';

  const normalizedPath = '/api' + targetPath.split('?')[0];
  if (!targetPath || !isPathAllowed(normalizedPath)) {
    logRequest(403, `Path not allowed: ${normalizedPath}`);
    console.error(`[Railway Proxy] 403: Path "${normalizedPath}" not in ALLOWED_PATHS`);
    return res.status(403).json({
      error: 'Forbidden',
      message: 'This path is not allowed through the proxy',
      path: normalizedPath,
      hint: 'Add this path to ALLOWED_PATHS in api/railway/[...path].ts',
    });
  }

  // =============================================================================
  // T92.4: Check Response Cache
  // =============================================================================
  const cacheKey = getCacheKey(req.method || 'GET', targetPath);
  if (cacheKey) {
    const cached = getCachedResponse(cacheKey);
    if (cached) {
      logRequest(cached.status, 'Cache hit');
      res.setHeader('X-Cache', 'HIT');
      return res.status(cached.status).json(cached.data);
    }
    res.setHeader('X-Cache', 'MISS');
  }

  const targetUrl = `${RAILWAY_API_URL}/api${targetPath}`;

  // P0 Security Fix: Add request timeout with AbortController
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    // Prepare headers
    const headers: HeadersInit = {
      'Content-Type': req.headers['content-type'] || 'application/json',
      'X-Request-ID': requestId,
    };

    // =============================================================================
    // T91.3: Forward authentication tokens
    // =============================================================================
    // Forward cookies (session-based auth)
    if (req.headers.cookie) {
      headers['Cookie'] = req.headers.cookie;
    }
    
    // Forward Authorization header (Bearer token auth)
    if (req.headers.authorization) {
      headers['Authorization'] = req.headers.authorization;
    }
    
    // Forward Firebase ID token if present (for migration period)
    const firebaseToken = req.headers['x-firebase-token'];
    if (firebaseToken) {
      headers['X-Firebase-Token'] = Array.isArray(firebaseToken) ? firebaseToken[0] : firebaseToken;
    }
    
    // Forward user ID from verified Firebase session (for backend lookups)
    const firebaseUid = req.headers['x-firebase-uid'];
    if (firebaseUid) {
      headers['X-Firebase-UID'] = Array.isArray(firebaseUid) ? firebaseUid[0] : firebaseUid;
    }

    // =============================================================================
    // Sprint 102: Service-to-service authentication
    // Add Railway API secret for server-to-server calls (bypasses user auth)
    // Railway should check this header and allow requests from trusted Vercel proxy
    // Priority: SERVICE_TO_SERVICE_SECRET > RAILWAY_API_SECRET > CRON_SECRET
    // =============================================================================
    if (SERVICE_TO_SERVICE_SECRET) {
      headers['X-Railway-Secret'] = SERVICE_TO_SERVICE_SECRET;
      // Also send as Authorization Bearer for endpoints that accept it
      headers['Authorization'] = `Bearer ${SERVICE_TO_SERVICE_SECRET}`;
      // x-service-key header (new S2S auth pattern - required by Railway)
      headers['x-service-key'] = SERVICE_TO_SERVICE_SECRET;
    } else {
      console.warn(`[Railway Proxy] WARNING: No S2S secret configured. Set SERVICE_TO_SERVICE_SECRET, RAILWAY_API_SECRET, or CRON_SECRET env var.`);
    }
    
    // Add source identification for request tracing
    headers['x-source'] = 'gtm-yardflow-proxy';
    headers['x-user-id'] = headers['X-Firebase-UID'] || 'service:gtm-frontend';
    
    // Forward user email if available (for Railway user context)
    const userEmail = req.headers['x-user-email'];
    if (userEmail) {
      headers['x-user-email'] = Array.isArray(userEmail) ? userEmail[0] : userEmail;
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

    // Record success for circuit breaker
    recordSuccess();

    // Forward response headers
    response.headers.forEach((value, key) => {
      if (!['content-encoding', 'transfer-encoding'].includes(key.toLowerCase())) {
        res.setHeader(key, value);
      }
    });

    // Forward status and body
    // Handle non-JSON responses gracefully (e.g., HTML error pages)
    const text = await response.text();
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      // Railway returned non-JSON (HTML error page, etc.)
      logRequest(response.status, 'Non-JSON response from Railway');
      return res.status(response.status).json({
        error: 'Backend Error',
        message: response.ok ? 'Unexpected response format' : 'Railway backend error',
        details: text.substring(0, 200), // Truncate for safety
      });
    }

    // Cache successful GET responses to cacheable paths
    if (cacheKey && response.ok) {
      setCachedResponse(cacheKey, data, response.status);
    }

    logRequest(response.status);
    return res.status(response.status).json(data);

  } catch (error) {
    // Clear timeout on error
    clearTimeout(timeoutId);
    
    // Record failure for circuit breaker
    recordFailure();
    
    console.error('Railway proxy error:', error);
    
    // P1 Security Fix: Don't expose error details in production
    const isProduction = process.env.NODE_ENV === 'production';
    
    // Check if it was a timeout
    if (error instanceof Error && error.name === 'AbortError') {
      logRequest(504, 'Gateway timeout');
      return res.status(504).json({
        error: 'Gateway Timeout',
        message: 'Railway backend did not respond in time',
      });
    }
    
    logRequest(502, error instanceof Error ? error.message : 'Unknown error');
    return res.status(502).json({
      error: 'Bad Gateway',
      message: 'Failed to reach Railway backend',
      ...(isProduction ? {} : { details: error instanceof Error ? error.message : 'Unknown error' }),
    });
  }
}

