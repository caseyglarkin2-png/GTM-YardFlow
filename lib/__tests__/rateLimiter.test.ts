import { describe, it, expect, beforeEach, vi } from 'vitest';
import { applyRateLimitToRequest, clearRateLimitStore, getRateLimitConfig } from '../rateLimiter';

function createMockRes() {
  const headers: Record<string, string> = {};
  const res = {
    status: vi.fn().mockReturnThis(),
    setHeader: (name: string, value: string) => {
      headers[name] = value;
      return undefined;
    },
    json: vi.fn().mockReturnThis(),
    _headers: headers,
  };
  return res;
}

describe('rateLimiter', () => {
  beforeEach(() => {
    clearRateLimitStore();
  });

  it('matches route-specific configs', () => {
    expect(getRateLimitConfig('/api/email/send').limit).toBe(20);
    expect(getRateLimitConfig('/api/track/open').limit).toBe(200);
    expect(getRateLimitConfig('/api/webhooks/sendgrid').limit).toBe(800);
    expect(getRateLimitConfig('/api/cron/process-queue').limit).toBe(20);
    expect(getRateLimitConfig('/api/unknown/path').limit).toBe(100);
  });

  it('applies headers from matched config', async () => {
    const req = { url: '/api/track/open', headers: {}, socket: { remoteAddress: '9.9.9.9' } };
    const res = createMockRes();

    const allowed = await applyRateLimitToRequest(req, res);
    expect(allowed).toBe(true);
    expect(res._headers['X-RateLimit-Limit']).toBe('200');
  });

  it('blocks after exceeding limit', async () => {
    const req = { url: '/api/email/send', headers: {}, socket: { remoteAddress: '1.2.3.4' } };
    const res = createMockRes();

    const first = await applyRateLimitToRequest(req, res, { limit: 1, windowMs: 1000 });
    expect(first).toBe(true);
    expect(res._headers['X-RateLimit-Remaining']).toBe('0');

    const second = await applyRateLimitToRequest(req, res, { limit: 1, windowMs: 1000 });
    expect(second).toBe(false);
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res._headers['X-RateLimit-Limit']).toBe('1');
  });
});
