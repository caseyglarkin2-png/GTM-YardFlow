/**
 * Rate Limiter for Vercel Serverless Functions
 * Sprint 300 - T300.1 (Enhanced from Sprint 200)
 * 
 * Uses Upstash Redis for distributed rate limiting in production.
 * Falls back to in-memory store for development.
 */

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  limit: number;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// In-memory store (works for single instance, use Redis for multi-instance)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup interval to prevent memory leaks
let cleanupInterval: NodeJS.Timeout | null = null;

function startCleanup() {
  if (cleanupInterval) return;
  
  cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitStore.entries()) {
      if (now > entry.resetAt) {
        rateLimitStore.delete(key);
      }
    }
  }, 60000); // Cleanup every minute
}

/**
 * Check rate limit using Upstash Redis (production)
 */
async function rateLimitUpstash(
  identifier: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  
  if (!url || !token) {
    // Fallback to in-memory if not configured
    return rateLimitInMemory(identifier, limit, windowMs);
  }

  const now = Date.now();
  const windowStart = now - windowMs;
  const key = `ratelimit:${identifier}`;

  try {
    // Use Redis sorted set for sliding window
    const pipeline = [
      ['ZREMRANGEBYSCORE', key, '0', String(windowStart)],
      ['ZADD', key, String(now), `${now}-${Math.random().toString(36).slice(2)}`],
      ['ZCARD', key],
      ['PEXPIRE', key, String(windowMs)],
    ];

    const response = await fetch(`${url}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(pipeline),
    });

    if (!response.ok) {
      console.error('[RateLimiter] Upstash error:', response.status);
      // On error, allow the request but log it
      return { allowed: true, remaining: limit, resetAt: now + windowMs, limit };
    }

    const results = await response.json() as Array<{ result: number }>;
    const count = results[2]?.result || 0;
    const allowed = count <= limit;
    const remaining = Math.max(0, limit - count);

    return { allowed, remaining, resetAt: now + windowMs, limit };
  } catch (error) {
    console.error('[RateLimiter] Upstash error:', error);
    // On error, allow the request (fail open)
    return { allowed: true, remaining: limit, resetAt: now + windowMs, limit };
  }
}

/**
 * Check rate limit using in-memory store (development/fallback)
 */
function rateLimitInMemory(
  identifier: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  startCleanup();
  
  const now = Date.now();
  const entry = rateLimitStore.get(identifier);
  
  // New or expired entry
  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(identifier, {
      count: 1,
      resetAt: now + windowMs,
    });
    return {
      allowed: true,
      remaining: limit - 1,
      resetAt: now + windowMs,
      limit,
    };
  }
  
  // Existing entry - check limit
  if (entry.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.resetAt,
      limit,
    };
  }
  
  // Increment count
  entry.count++;
  return {
    allowed: true,
    remaining: limit - entry.count,
    resetAt: entry.resetAt,
    limit,
  };
}

/**
 * Check and update rate limit for an identifier (sync version for backward compat)
 * @param identifier - Unique identifier (usually IP or user ID)
 * @param limit - Maximum requests allowed in window
 * @param windowMs - Time window in milliseconds
 * @returns RateLimitResult with allowed status and remaining count
 */
export function rateLimit(
  identifier: string,
  limit: number = 100,
  windowMs: number = 60000
): RateLimitResult {
  return rateLimitInMemory(identifier, limit, windowMs);
}

/**
 * Async rate limit check - uses Upstash in production
 * @param identifier - Unique identifier (usually IP or user ID)
 * @param limit - Maximum requests allowed in window
 * @param windowMs - Time window in milliseconds
 */
export async function checkRateLimit(
  identifier: string,
  limit: number = 100,
  windowMs: number = 60000
): Promise<RateLimitResult> {
  // Use Upstash if configured, otherwise in-memory
  if (process.env.UPSTASH_REDIS_REST_URL) {
    return rateLimitUpstash(identifier, limit, windowMs);
  }
  return rateLimitInMemory(identifier, limit, windowMs);
}

/**
 * Get client IP from request headers
 * Handles Vercel's forwarded headers
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }
  
  return 'unknown';
}

/**
 * Get rate limit headers for HTTP response
 */
export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const retryAfterSecs = Math.max(0, Math.ceil((result.resetAt - Date.now()) / 1000));
  return {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
    'Retry-After': String(retryAfterSecs),
  };
}

/**
 * Rate limit configurations for different endpoints
 */
export const RATE_LIMIT_CONFIGS = {
  default: { limit: 100, windowMs: 60000 },      // 100 req/min
  email: { limit: 20, windowMs: 60000 },         // 20 req/min
  auth: { limit: 10, windowMs: 60000 },          // 10 req/min
  webhook: { limit: 500, windowMs: 60000 },      // 500 req/min (high for webhooks)
  cron: { limit: 10, windowMs: 60000 },          // 10 req/min
  ai: { limit: 30, windowMs: 60000 },            // 30 req/min for AI endpoints
} as const;

type RateLimitConfig = { limit: number; windowMs: number };

// Pattern-based per-route configuration (fallback to default)
export const RATE_LIMIT_PATTERNS: Record<string, RateLimitConfig> = {
  '/api/railway/.*': { limit: 80, windowMs: 60000 },
  '/api/email/.*': { limit: 20, windowMs: 60000 },
  '/api/track/.*': { limit: 200, windowMs: 60000 },
  '/api/webhooks/.*': { limit: 800, windowMs: 60000 },
  '/api/cron/.*': { limit: 20, windowMs: 60000 },
  '*': RATE_LIMIT_CONFIGS.default,
};

function matchPath(pattern: string, path: string): boolean {
  const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
  return regex.test(path);
}

export function getRateLimitConfig(path: string): RateLimitConfig {
  const normalized = path || '';
  for (const [pattern, cfg] of Object.entries(RATE_LIMIT_PATTERNS)) {
    if (matchPath(pattern, normalized)) {
      return cfg;
    }
  }
  return RATE_LIMIT_CONFIGS.default;
}

export function getIdentifierFromVercelRequest(req: {
  headers: Record<string, string | string[] | undefined>;
  socket?: { remoteAddress?: string | undefined };
}): string {
  const authHeader = req.headers['authorization'];
  if (authHeader && typeof authHeader === 'string') {
    return `auth:${authHeader.slice(0, 24)}`;
  }

  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const ip = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0];
    return `ip:${ip.trim()}`;
  }

  if (req.socket?.remoteAddress) {
    return `ip:${req.socket.remoteAddress}`;
  }

  return 'ip:unknown';
}

export async function applyRateLimitToRequest(
  req: { url?: string | undefined; headers: Record<string, string | string[] | undefined>; socket?: { remoteAddress?: string | undefined } },
  res: { status: (code: number) => any; setHeader: (name: string, value: string) => any; json: (body: unknown) => any },
  overrideConfig?: RateLimitConfig
): Promise<boolean> {
  const path = req.url || '';
  const config = overrideConfig || getRateLimitConfig(path);
  const identifier = getIdentifierFromVercelRequest(req);
  const result = await checkRateLimit(identifier, config.limit, config.windowMs);

  // Set informative headers even when blocking
  const headers = getRateLimitHeaders({ ...result, limit: config.limit });
  Object.entries(headers).forEach(([key, value]) => res.setHeader(key, value));

  if (!result.allowed) {
    res.status(429).json({ error: 'rate_limited', limit: config.limit, remaining: result.remaining, resetAt: result.resetAt });
    return false;
  }

  return true;
}

/**
 * Clear rate limit for testing
 */
export function clearRateLimitStore(): void {
  rateLimitStore.clear();
}
