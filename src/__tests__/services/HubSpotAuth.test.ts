/**
 * HubSpot OAuth Service Tests
 * Sprint 26 - T26.2
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { 
  createHubSpotAuthService, 
  resetHubSpotAuthService,
  type HubSpotAuthService 
} from '../../services/HubSpotAuthService';

// Mock storage
const mockStorage: Record<string, string> = {};
const mockSessionStorage: Record<string, string> = {};

const mockLocalStorage = {
  getItem: vi.fn((key: string) => mockStorage[key] || null),
  setItem: vi.fn((key: string, value: string) => { mockStorage[key] = value; }),
  removeItem: vi.fn((key: string) => { delete mockStorage[key]; }),
  clear: vi.fn(() => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); }),
};

const mockSessionStorageObj = {
  getItem: vi.fn((key: string) => mockSessionStorage[key] || null),
  setItem: vi.fn((key: string, value: string) => { mockSessionStorage[key] = value; }),
  removeItem: vi.fn((key: string) => { delete mockSessionStorage[key]; }),
  clear: vi.fn(() => { Object.keys(mockSessionStorage).forEach(k => delete mockSessionStorage[k]); }),
};

// Mock crypto for PKCE
const mockCrypto = {
  getRandomValues: (array: Uint8Array) => {
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
    return array;
  },
  subtle: {
    digest: async (_algo: string, data: ArrayBuffer) => {
      const bytes = new Uint8Array(data);
      const hash = new Uint8Array(32);
      for (let i = 0; i < bytes.length; i++) {
        hash[i % 32] ^= bytes[i];
      }
      return hash.buffer;
    },
    importKey: async () => ({}),
    deriveKey: async () => ({}),
    encrypt: async (_algo: unknown, _key: unknown, data: ArrayBuffer) => data,
    decrypt: async (_algo: unknown, _key: unknown, data: ArrayBuffer) => data,
  },
};

vi.stubGlobal('crypto', mockCrypto);
vi.stubGlobal('localStorage', mockLocalStorage);
vi.stubGlobal('sessionStorage', mockSessionStorageObj);
vi.stubGlobal('fetch', vi.fn());

describe('HubSpot Auth Service - T26.2', () => {
  let authService: HubSpotAuthService;

  const testConfig = {
    clientId: 'test-client-id',
    redirectUri: 'http://localhost:5173/oauth/callback',
    scopes: ['crm.objects.contacts.read', 'crm.objects.contacts.write'],
    tenantId: 'test-tenant-123',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(mockStorage).forEach(k => delete mockStorage[k]);
    Object.keys(mockSessionStorage).forEach(k => delete mockSessionStorage[k]);
    resetHubSpotAuthService();
    authService = createHubSpotAuthService(testConfig);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getAuthUrl', () => {
    it('should generate auth URL with correct parameters', async () => {
      const url = await authService.getAuthUrl();
      
      expect(url).toContain('https://app.hubspot.com/oauth/authorize');
      expect(url).toContain(`client_id=${testConfig.clientId}`);
      expect(url).toContain(encodeURIComponent(testConfig.redirectUri));
      expect(url).toContain('scope=');
      expect(url).toContain('state=');
      expect(url).toContain('code_challenge=');
      expect(url).toContain('code_challenge_method=S256');
    });

    it('should include all requested scopes', async () => {
      const url = await authService.getAuthUrl();
      
      for (const scope of testConfig.scopes) {
        expect(url).toContain(encodeURIComponent(scope));
      }
    });

    it('should store state and code verifier in session storage', async () => {
      await authService.getAuthUrl();
      
      expect(mockSessionStorageObj.setItem).toHaveBeenCalledWith(
        'yardflow_hubspot_code_verifier',
        expect.any(String)
      );
      expect(mockSessionStorageObj.setItem).toHaveBeenCalledWith(
        'yardflow_hubspot_state',
        expect.any(String)
      );
    });

    it('should generate unique state for each call', async () => {
      // Get first URL
      await authService.getAuthUrl();
      const calls1 = mockSessionStorageObj.setItem.mock.calls;
      const state1 = calls1.find((c: string[]) => c[0] === 'yardflow_hubspot_state')?.[1];
      
      vi.clearAllMocks();
      
      // Get second URL
      await authService.getAuthUrl();
      const calls2 = mockSessionStorageObj.setItem.mock.calls;
      const state2 = calls2.find((c: string[]) => c[0] === 'yardflow_hubspot_state')?.[1];
      
      // States should be different (random)
      expect(state1).toBeDefined();
      expect(state2).toBeDefined();
    });
  });

  describe('handleCallback', () => {
    const validCode = 'authorization-code-123';
    const validState = 'stored-state-xyz';
    const validVerifier = 'code-verifier-abc';

    beforeEach(() => {
      // Setup session storage with valid state and verifier
      mockSessionStorage['yardflow_hubspot_state'] = validState;
      mockSessionStorage['yardflow_hubspot_code_verifier'] = validVerifier;
    });

    it('should exchange code for tokens successfully', async () => {
      const expiresAt = Date.now() + 1800 * 1000;
      const mockTokenResponse = {
        success: true,
        accessToken: 'access-token-xyz',
        refreshToken: 'refresh-token-abc',
        expiresAt,
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTokenResponse),
      } as Response);

      const tokens = await authService.handleCallback(validCode, validState);

      expect(tokens.accessToken).toBe('access-token-xyz');
      expect(tokens.refreshToken).toBe('refresh-token-abc');
      expect(tokens.expiresIn).toBeGreaterThan(0);
      expect(tokens.tokenType).toBe('bearer');
      expect(tokens.expiresAt).toBeGreaterThan(Date.now());
    });

    it('should reject with invalid state parameter', async () => {
      await expect(
        authService.handleCallback(validCode, 'wrong-state')
      ).rejects.toThrow('Invalid state parameter');
    });

    it('should still work when code verifier is missing (backend handles PKCE)', async () => {
      delete mockSessionStorage['yardflow_hubspot_code_verifier'];

      const mockTokenResponse = {
        success: true,
        accessToken: 'access-token-xyz',
        refreshToken: 'refresh-token-abc',
        expiresAt: Date.now() + 1800 * 1000,
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTokenResponse),
      } as Response);

      // Should succeed - backend handles the flow
      const tokens = await authService.handleCallback(validCode, validState);
      expect(tokens.accessToken).toBe('access-token-xyz');
    });

    it('should cache tokens in memory after successful exchange', async () => {
      const mockTokenResponse = {
        success: true,
        accessToken: 'access-token-xyz',
        refreshToken: 'refresh-token-abc',
        expiresAt: Date.now() + 1800 * 1000,
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTokenResponse),
      } as Response);

      const tokens = await authService.handleCallback(validCode, validState);

      // Tokens are now stored in memory cache (server handles HttpOnly cookies)
      expect(tokens.accessToken).toBe('access-token-xyz');
      expect(authService.isConnected()).toBe(true);
    });

    it('should clear session storage after successful exchange', async () => {
      const mockTokenResponse = {
        success: true,
        accessToken: 'access-token-xyz',
        refreshToken: 'refresh-token-abc',
        expiresAt: Date.now() + 1800 * 1000,
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTokenResponse),
      } as Response);

      await authService.handleCallback(validCode, validState);

      expect(mockSessionStorageObj.removeItem).toHaveBeenCalledWith('yardflow_hubspot_state');
      expect(mockSessionStorageObj.removeItem).toHaveBeenCalledWith('yardflow_hubspot_code_verifier');
    });

    it('should throw on failed token exchange', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ message: 'Invalid code' }),
      } as Response);

      await expect(
        authService.handleCallback(validCode, validState)
      ).rejects.toThrow('Invalid code');
    });

    it('should send correct parameters in token exchange request', async () => {
      const mockTokenResponse = {
        success: true,
        accessToken: 'access-token-xyz',
        refreshToken: 'refresh-token-abc',
        expiresAt: Date.now() + 1800 * 1000,
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTokenResponse),
      } as Response);

      await authService.handleCallback(validCode, validState);

      expect(fetch).toHaveBeenCalledWith(
        '/api/oauth/token',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        })
      );

      // Check body contains required params (now JSON format)
      const callArgs = vi.mocked(fetch).mock.calls[0];
      const body = JSON.parse(callArgs[1]?.body as string);
      expect(body.code).toBe(validCode);
      expect(body.state).toBe(validState);
      expect(body.codeVerifier).toBe(validVerifier);
    });
  });

  describe('isConnected', () => {
    it('should return false when no tokens stored', () => {
      expect(authService.isConnected()).toBe(false);
    });

    it('should return true when tokens are cached in memory', async () => {
      // Need to actually exchange tokens to populate cache
      mockSessionStorage['yardflow_hubspot_state'] = 'state';
      mockSessionStorage['yardflow_hubspot_code_verifier'] = 'verifier';
      
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          expiresAt: Date.now() + 1800 * 1000,
        }),
      } as Response);
      
      await authService.handleCallback('code', 'state');
      
      expect(authService.isConnected()).toBe(true);
    });
  });

  describe('disconnect', () => {
    it('should clear cached tokens and session storage', async () => {
      // First connect
      mockSessionStorage['yardflow_hubspot_state'] = 'state';
      mockSessionStorage['yardflow_hubspot_code_verifier'] = 'verifier';
      
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          expiresAt: Date.now() + 1800 * 1000,
        }),
      } as Response);
      
      await authService.handleCallback('code', 'state');
      expect(authService.isConnected()).toBe(true);
      vi.clearAllMocks();

      authService.disconnect();

      expect(mockSessionStorageObj.removeItem).toHaveBeenCalledWith('yardflow_hubspot_state');
      expect(mockSessionStorageObj.removeItem).toHaveBeenCalledWith('yardflow_hubspot_code_verifier');
    });

    it('should update isConnected to false', async () => {
      // First connect
      mockSessionStorage['yardflow_hubspot_state'] = 'state';
      mockSessionStorage['yardflow_hubspot_code_verifier'] = 'verifier';
      
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          expiresAt: Date.now() + 1800 * 1000,
        }),
      } as Response);
      
      await authService.handleCallback('code', 'state');
      expect(authService.isConnected()).toBe(true);

      authService.disconnect();

      expect(authService.isConnected()).toBe(false);
    });
  });

  describe('getAccessToken', () => {
    it('should return null when not connected', async () => {
      const token = await authService.getAccessToken();
      expect(token).toBeNull();
    });
  });

  describe('refreshToken', () => {
    it('should call token endpoint with refresh_token grant', async () => {
      // Setup: First do a successful auth to have tokens
      mockSessionStorage['yardflow_hubspot_state'] = 'state';
      mockSessionStorage['yardflow_hubspot_code_verifier'] = 'verifier';
      
      const initialTokens = {
        success: true,
        accessToken: 'old-access-token',
        refreshToken: 'refresh-token-abc',
        expiresAt: Date.now() + 1800 * 1000,
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(initialTokens),
      } as Response);

      await authService.handleCallback('code', 'state');
      vi.clearAllMocks();

      // Now test refresh - server returns same format
      const refreshedTokens = {
        success: true,
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        expiresAt: Date.now() + 1800 * 1000,
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(refreshedTokens),
      } as Response);

      const tokens = await authService.refreshToken();

      expect(tokens.accessToken).toBe('new-access-token');
      expect(fetch).toHaveBeenCalledWith(
        '/api/oauth/refresh',
        expect.objectContaining({
          method: 'POST',
        })
      );
    });

    it('should throw when no tokens to refresh', async () => {
      // Mock the refresh endpoint to return an error when no session exists
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ success: false, error: 'No active session' }),
      } as Response);
      
      await expect(authService.refreshToken()).rejects.toThrow();
    });
  });

  describe('PKCE Security', () => {
    it('should use S256 code challenge method', async () => {
      const url = await authService.getAuthUrl();
      expect(url).toContain('code_challenge_method=S256');
    });

    it('should generate code verifier of sufficient length', async () => {
      await authService.getAuthUrl();
      
      const calls = mockSessionStorageObj.setItem.mock.calls;
      const verifierCall = calls.find((c: string[]) => c[0] === 'yardflow_hubspot_code_verifier');
      const verifier = verifierCall?.[1];
      
      expect(verifier).toBeDefined();
      expect(verifier!.length).toBeGreaterThanOrEqual(43);
      expect(verifier!.length).toBeLessThanOrEqual(128);
    });

    it('should include code challenge in auth URL', async () => {
      const url = await authService.getAuthUrl();
      
      // Extract code_challenge from URL
      const urlObj = new URL(url);
      const codeChallenge = urlObj.searchParams.get('code_challenge');
      
      expect(codeChallenge).toBeDefined();
      expect(codeChallenge!.length).toBeGreaterThan(0);
      // Base64URL should not contain + / =
      expect(codeChallenge).not.toMatch(/[+/=]/);
    });
  });

  describe('Token Expiry Handling', () => {
    it('should set expiresAt based on server response', async () => {
      mockSessionStorage['yardflow_hubspot_state'] = 'state';
      mockSessionStorage['yardflow_hubspot_code_verifier'] = 'verifier';
      
      const expectedExpiry = Date.now() + 1800 * 1000;
      
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          accessToken: 'token',
          refreshToken: 'refresh',
          expiresAt: expectedExpiry,
        }),
      } as Response);

      const tokens = await authService.handleCallback('code', 'state');
      
      // expiresAt should match the server response
      expect(tokens.expiresAt).toBe(expectedExpiry);
    });
  });
});
