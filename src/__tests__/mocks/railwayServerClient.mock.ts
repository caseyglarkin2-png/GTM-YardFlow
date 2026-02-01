/**
 * Railway Server Client Mock
 * 
 * Mock utility for testing webhook integration with Railway sync.
 * Captures all Railway API calls for assertion in tests.
 * 
 * Sprint 900: Webhook Integration Tests
 */

import { vi, type Mock } from 'vitest';

export interface MockCall {
  endpoint: string;
  body?: unknown;
  userContext?: { userId?: string; email?: string };
  timestamp: number;
}

interface MockRailwayServerClient {
  fetch: Mock<(...args: unknown[]) => Promise<unknown>>;
  get: Mock<(...args: unknown[]) => Promise<unknown>>;
  post: Mock<(...args: unknown[]) => Promise<unknown>>;
  put: Mock<(...args: unknown[]) => Promise<unknown>>;
  patch: Mock<(...args: unknown[]) => Promise<unknown>>;
  delete: Mock<(...args: unknown[]) => Promise<unknown>>;
  healthCheck: Mock<() => Promise<{ status: string; timestamp: string }>>;
  _calls: MockCall[];
  _getCallsFor: (method: string) => MockCall[];
  _reset: () => void;
}

const createMock = (): MockRailwayServerClient => {
  const calls: MockCall[] = [];
  
  const trackCall = (method: string) => (...args: unknown[]) => {
    const [endpoint, bodyOrParams, userContext] = args;
    calls.push({
      endpoint: endpoint as string,
      body: method === 'get' ? undefined : bodyOrParams,
      userContext: method === 'get' ? bodyOrParams as { userId?: string; email?: string } : userContext as { userId?: string; email?: string },
      timestamp: Date.now(),
    });
    return Promise.resolve({ ok: true, data: {} });
  };

  return {
    fetch: vi.fn(trackCall('fetch')),
    get: vi.fn(trackCall('get')),
    post: vi.fn(trackCall('post')),
    put: vi.fn(trackCall('put')),
    patch: vi.fn(trackCall('patch')),
    delete: vi.fn(trackCall('delete')),
    healthCheck: vi.fn(() => Promise.resolve({ status: 'healthy', timestamp: new Date().toISOString() })),
    _calls: calls,
    _getCallsFor: (method: string) => {
      const mock = ({
        fetch: calls,
        get: calls.filter(c => !c.body),
        post: calls.filter(c => c.body),
        patch: calls.filter(c => c.body),
      } as Record<string, MockCall[]>)[method] || calls;
      return mock;
    },
    _reset: () => {
      calls.length = 0;
    },
  };
};

export const mockRailwayServerClient = createMock();

/**
 * Reset all mock call history and restore default behavior
 */
export function resetRailwayMocks(): void {
  // Clear call history
  mockRailwayServerClient.fetch.mockClear();
  mockRailwayServerClient.get.mockClear();
  mockRailwayServerClient.post.mockClear();
  mockRailwayServerClient.put.mockClear();
  mockRailwayServerClient.patch.mockClear();
  mockRailwayServerClient.delete.mockClear();
  mockRailwayServerClient.healthCheck.mockClear();
  mockRailwayServerClient._calls.length = 0;
  
  // Reset to default success behavior (clears any mockRejectedValue)
  mockRailwayServerClient.fetch.mockResolvedValue({ ok: true, data: {} });
  mockRailwayServerClient.get.mockResolvedValue({ ok: true, data: {} });
  mockRailwayServerClient.post.mockResolvedValue({ ok: true, data: {} });
  mockRailwayServerClient.put.mockResolvedValue({ ok: true, data: {} });
  mockRailwayServerClient.patch.mockResolvedValue({ ok: true, data: {} });
  mockRailwayServerClient.delete.mockResolvedValue({ ok: true });
}

/**
 * Configure mock to simulate Railway failure
 */
export function simulateRailwayFailure(method: 'patch' | 'post' | 'get' = 'patch'): void {
  const error = new Error('Railway API Error [500]: Internal Server Error');
  (error as Error & { status: number }).status = 500;
  mockRailwayServerClient[method].mockRejectedValueOnce(error);
}

/**
 * Configure mock to simulate Railway timeout
 */
export function simulateRailwayTimeout(method: 'patch' | 'post' | 'get' = 'patch'): void {
  const error = new Error('Railway API Error: Request timeout');
  (error as Error & { status: number }).status = 504;
  mockRailwayServerClient[method].mockRejectedValueOnce(error);
}

/**
 * Get all patch calls to Railway
 */
export function getPatchCalls(): MockCall[] {
  return mockRailwayServerClient._calls.filter((_, i) => 
    mockRailwayServerClient.patch.mock.calls[i] !== undefined
  );
}

/**
 * Assert that Railway was called with specific enrollment update
 */
export function assertRailwaySyncedEnrollment(
  enrollmentId: string,
  expectedPayload: { status?: string; completionReason?: string; resumeAt?: string }
): void {
  const patchCalls = mockRailwayServerClient.patch.mock.calls;
  const matchingCall = patchCalls.find(
    (call) => (call[0] as string).includes(enrollmentId)
  );
  
  if (!matchingCall) {
    throw new Error(`Expected Railway sync for enrollment ${enrollmentId}, but no matching call found. Calls: ${JSON.stringify(patchCalls)}`);
  }
  
  const body = matchingCall[1] as Record<string, unknown>;
  
  if (expectedPayload.status && body.status !== expectedPayload.status) {
    throw new Error(`Expected status ${expectedPayload.status}, got ${body.status}`);
  }
  
  if (expectedPayload.completionReason && body.completionReason !== expectedPayload.completionReason) {
    throw new Error(`Expected completionReason ${expectedPayload.completionReason}, got ${body.completionReason}`);
  }
}

/**
 * Assert that no Railway calls were made
 */
export function assertNoRailwayCalls(): void {
  const totalCalls = 
    mockRailwayServerClient.patch.mock.calls.length +
    mockRailwayServerClient.post.mock.calls.length +
    mockRailwayServerClient.put.mock.calls.length;
  
  if (totalCalls > 0) {
    throw new Error(`Expected no Railway calls, but found ${totalCalls} calls`);
  }
}
