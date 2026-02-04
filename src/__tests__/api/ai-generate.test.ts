/**
 * AI Generate Proxy Tests
 * 
 * Sprint 27: F2 - Unit tests for /api/ai/generate proxy
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Mock logger
vi.mock('../../lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

function createMockReq(overrides: Partial<VercelRequest> = {}): VercelRequest {
  return {
    method: 'POST',
    headers: {
      authorization: 'Bearer firebase-token-123',
    },
    body: {
      tone: 'professional',
      prospectName: 'Casey',
      companyName: 'FreightRoll',
      title: 'VP Operations',
    },
    ...overrides,
  } as VercelRequest;
}

function createMockRes(): VercelResponse & { _json: unknown; _status: number } {
  const res: { _json: unknown; _status: number; status: (code: number) => typeof res; json: (data: unknown) => typeof res } = {
    _json: null as unknown,
    _status: 200,
    status(code: number) {
      res._status = code;
      return res;
    },
    json(data: unknown) {
      res._json = data;
      return res;
    },
  };
  return res as unknown as VercelResponse & { _json: unknown; _status: number };
}

describe('/api/ai/generate', () => {
  let handler: typeof import('../../../api/ai/generate').default;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    
    // Set env vars BEFORE importing handler
    process.env.RAILWAY_API_SECRET = 'test-secret';
    process.env.RAILWAY_API_URL = 'https://railway.test';
    
    // Dynamic import after env vars set
    const module = await import('../../../api/ai/generate');
    handler = module.default;
  });

  afterEach(() => {
    delete process.env.RAILWAY_API_SECRET;
    delete process.env.RAILWAY_API_URL;
  });

  it('rejects non-POST requests', async () => {
    const req = createMockReq({ method: 'GET' });
    const res = createMockRes();

    await handler(req, res);

    expect(res._status).toBe(405);
    expect(res._json).toEqual({ success: false, error: 'Method not allowed' });
  });

  it('requires authentication header', async () => {
    const req = createMockReq({ headers: {} });
    const res = createMockRes();

    await handler(req, res);

    expect(res._status).toBe(401);
    expect(res._json).toEqual({ success: false, error: 'Authentication required' });
  });

  it('validates required fields', async () => {
    const req = createMockReq({ body: { tone: 'professional' } });
    const res = createMockRes();

    await handler(req, res);

    expect(res._status).toBe(400);
    expect((res._json as { error: string }).error).toContain('Missing required fields');
  });

  it('validates tone values', async () => {
    const req = createMockReq({ 
      body: { 
        tone: 'invalid-tone',
        prospectName: 'Test',
        companyName: 'Test Co',
      } 
    });
    const res = createMockRes();

    await handler(req, res);

    expect(res._status).toBe(400);
    expect((res._json as { error: string }).error).toContain('Invalid tone');
  });

  it('forwards request to Railway with service key', async () => {
    // Railway returns: { response: "JSON string", provider, fallbackUsed }
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ 
        response: '{"subject":"Generated subject","content":"Generated email body"}',
        provider: 'gemini',
      }),
    });

    const req = createMockReq();
    const res = createMockRes();

    await handler(req, res);

    // Handler forwards to /api/ai/chat (the working Railway endpoint)
    expect(mockFetch).toHaveBeenCalledWith(
      'https://railway.test/api/ai/chat',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'x-service-key': 'test-secret',
        }),
      })
    );
    
    expect(res._status).toBe(200);
    expect(res._json).toEqual({
      success: true,
      content: 'Generated email body',
      subject: 'Generated subject',
      provider: 'gemini',
      usage: undefined,
      rateLimit: undefined,
    });
  });

  it('handles Railway rate limit (429)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      headers: new Headers({ 'Retry-After': '60' }),
      json: () => Promise.resolve({ error: 'Too many requests' }),
    });

    const req = createMockReq();
    const res = createMockRes();

    await handler(req, res);

    expect(res._status).toBe(429);
    expect((res._json as { error: string }).error).toBe('rate_limited');
    expect((res._json as { rateLimit: { retryAfterSeconds: number } }).rateLimit.retryAfterSeconds).toBe(60);
  });

  it('handles Railway auth failure (401)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ error: 'Unauthorized' }),
    });

    const req = createMockReq();
    const res = createMockRes();

    await handler(req, res);

    expect(res._status).toBe(503);
    expect((res._json as { error: string }).error).toContain('authentication failed');
  });
});
