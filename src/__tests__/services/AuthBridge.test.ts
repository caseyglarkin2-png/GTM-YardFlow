/**
 * Tests for AuthBridge Service
 * Sprint 206: Railway API Endpoints
 * 
 * T206.6a: Auth Bridge Unit Tests
 * T206.6b: Session Caching Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getCachedSession,
  setCachedSession,
  clearCachedSession,
  isSessionValid,
  isSessionNearExpiry,
  exchangeFirebaseToken,
  getOrCreateRailwaySession,
  ensureValidSession,
  isRailwayAvailable,
  type CachedSession,
} from '@/services/AuthBridge';

// Mock sessionStorage
const mockSessionStorage: Record<string, string> = {};
const mockSessionStorageObj = {
  getItem: vi.fn((key: string) => mockSessionStorage[key] || null),
  setItem: vi.fn((key: string, value: string) => {
    mockSessionStorage[key] = value;
  }),
  removeItem: vi.fn((key: string) => {
    delete mockSessionStorage[key];
  }),
  clear: vi.fn(() => {
    Object.keys(mockSessionStorage).forEach(key => delete mockSessionStorage[key]);
  }),
  length: 0,
  key: vi.fn(),
};

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock firebase auth
vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({
    currentUser: {
      getIdToken: vi.fn().mockResolvedValue('firebase_token_123'),
      uid: 'user_123',
      email: 'test@example.com',
    },
  })),
  signInWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
  onAuthStateChanged: vi.fn(),
}));

describe('AuthBridge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionStorageObj.clear();
    
    // Setup sessionStorage mock
    Object.defineProperty(global, 'sessionStorage', {
      value: mockSessionStorageObj,
      writable: true,
    });
    
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Session Caching', () => {
    const validSession: CachedSession = {
      sessionToken: 'railway_session_123',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour from now
      user: { id: 'user_1', email: 'test@example.com', name: 'Test User' },
    };

    const expiredSession: CachedSession = {
      sessionToken: 'railway_session_expired',
      expiresAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // 1 hour ago
    };

    const nearExpirySession: CachedSession = {
      sessionToken: 'railway_session_expiring',
      expiresAt: new Date(Date.now() + 2 * 60 * 1000).toISOString(), // 2 minutes from now
    };

    describe('getCachedSession', () => {
      it('returns null when no session is cached', () => {
        const result = getCachedSession();
        expect(result).toBeNull();
      });

      it('returns cached session when present', () => {
        mockSessionStorage['railway_session'] = JSON.stringify(validSession);
        const result = getCachedSession();
        expect(result).toEqual(validSession);
      });

      it('returns null for invalid JSON', () => {
        mockSessionStorage['railway_session'] = 'invalid json';
        const result = getCachedSession();
        expect(result).toBeNull();
      });
    });

    describe('setCachedSession', () => {
      it('stores session in sessionStorage', () => {
        setCachedSession(validSession);
        expect(mockSessionStorageObj.setItem).toHaveBeenCalledWith(
          'railway_session',
          JSON.stringify(validSession)
        );
      });
    });

    describe('clearCachedSession', () => {
      it('removes session from sessionStorage', () => {
        mockSessionStorage['railway_session'] = JSON.stringify(validSession);
        clearCachedSession();
        expect(mockSessionStorageObj.removeItem).toHaveBeenCalledWith('railway_session');
      });
    });

    describe('isSessionValid', () => {
      it('returns true for valid session', () => {
        expect(isSessionValid(validSession)).toBe(true);
      });

      it('returns false for expired session', () => {
        expect(isSessionValid(expiredSession)).toBe(false);
      });

      it('returns false for invalid date', () => {
        const invalidSession: CachedSession = {
          sessionToken: 'test',
          expiresAt: 'invalid-date',
        };
        expect(isSessionValid(invalidSession)).toBe(false);
      });
    });

    describe('isSessionNearExpiry', () => {
      it('returns false for session with plenty of time', () => {
        expect(isSessionNearExpiry(validSession)).toBe(false);
      });

      it('returns true for session near expiry', () => {
        expect(isSessionNearExpiry(nearExpirySession)).toBe(true);
      });

      it('returns true for expired session', () => {
        expect(isSessionNearExpiry(expiredSession)).toBe(true);
      });
    });
  });

  describe('Railway Health Check', () => {
    it('returns true when Railway is healthy', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });
      const result = await isRailwayAvailable();
      expect(result).toBe(true);
    });

    it('returns false when Railway returns error', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
      const result = await isRailwayAvailable();
      expect(result).toBe(false);
    });

    it('returns false on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      const result = await isRailwayAvailable();
      expect(result).toBe(false);
    });

    it('calls health endpoint', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });
      await isRailwayAvailable();
      expect(mockFetch).toHaveBeenCalledWith('/api/railway/health', expect.objectContaining({
        method: 'GET',
      }));
    });
  });

  describe('Token Exchange', () => {
    describe('exchangeFirebaseToken', () => {
      it('returns session on successful exchange', async () => {
        const mockResponse = {
          sessionToken: 'railway_session_new',
          expiresAt: '2026-01-31T12:00:00.000Z',
          user: { id: 'user_1', email: 'test@example.com' },
        };
        
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        });

        const result = await exchangeFirebaseToken('firebase_token_123');
        
        expect(result).toEqual({
          sessionToken: 'railway_session_new',
          expiresAt: '2026-01-31T12:00:00.000Z',
          user: { id: 'user_1', email: 'test@example.com' },
        });
      });

      it('returns null on failed exchange', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 401,
        });

        const result = await exchangeFirebaseToken('invalid_token');
        expect(result).toBeNull();
      });

      it('returns null on network error', async () => {
        mockFetch.mockRejectedValueOnce(new Error('Network error'));
        const result = await exchangeFirebaseToken('firebase_token_123');
        expect(result).toBeNull();
      });

      it('calls correct endpoint with token', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ sessionToken: 'test' }),
        });

        await exchangeFirebaseToken('firebase_token_123');

        expect(mockFetch).toHaveBeenCalledWith('/api/railway/auth/bridge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ firebaseToken: 'firebase_token_123' }),
        });
      });
    });
  });

  describe('Session Management', () => {
    const validSession: CachedSession = {
      sessionToken: 'railway_session_123',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    };

    describe('getOrCreateRailwaySession', () => {
      it('returns cached session if valid and not near expiry', async () => {
        mockSessionStorage['railway_session'] = JSON.stringify(validSession);
        
        const result = await getOrCreateRailwaySession();
        
        expect(result).toBe('railway_session_123');
        expect(mockFetch).not.toHaveBeenCalled();
      });

      it('fetches new session when cache is expired', async () => {
        const expiredSession: CachedSession = {
          sessionToken: 'expired',
          expiresAt: new Date(Date.now() - 1000).toISOString(),
        };
        mockSessionStorage['railway_session'] = JSON.stringify(expiredSession);
        
        // Mock health check and token exchange
        mockFetch
          .mockResolvedValueOnce({ ok: true }) // health check
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              sessionToken: 'new_session',
              expiresAt: new Date(Date.now() + 60000).toISOString(),
            }),
          });

        const result = await getOrCreateRailwaySession();
        
        expect(result).toBe('new_session');
      });

      it('returns null when Railway is unavailable', async () => {
        mockFetch.mockResolvedValueOnce({ ok: false }); // health check fails
        
        const result = await getOrCreateRailwaySession();
        
        expect(result).toBeNull();
      });
    });

    describe('ensureValidSession', () => {
      it('returns cached session if valid and not near expiry', async () => {
        mockSessionStorage['railway_session'] = JSON.stringify(validSession);
        
        const result = await ensureValidSession();
        
        expect(result).toBe('railway_session_123');
      });

      it('refreshes session proactively when near expiry', async () => {
        const nearExpirySession: CachedSession = {
          sessionToken: 'expiring_soon',
          expiresAt: new Date(Date.now() + 2 * 60 * 1000).toISOString(), // 2 minutes
        };
        mockSessionStorage['railway_session'] = JSON.stringify(nearExpirySession);
        
        // Mock health check and token exchange
        mockFetch
          .mockResolvedValueOnce({ ok: true })
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              sessionToken: 'refreshed_session',
              expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
            }),
          });

        const result = await ensureValidSession();
        
        // Should get new session due to proactive refresh
        expect(result).toBe('refreshed_session');
      });

      it('fetches new session when no cache exists', async () => {
        mockFetch
          .mockResolvedValueOnce({ ok: true })
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              sessionToken: 'new_session',
              expiresAt: new Date(Date.now() + 60000).toISOString(),
            }),
          });

        const result = await ensureValidSession();
        
        expect(result).toBe('new_session');
      });
    });
  });
});
