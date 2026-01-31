/**
 * T91.2: Railway API Client
 * 
 * Full-featured client for Railway backend with:
 * - Type-safe API calls
 * - Automatic retry with exponential backoff
 * - Request/response interceptors
 * - Feature flag integration
 * - Offline queue support
 * - Error handling
 * 
 * Usage:
 *   import { railwayClient } from '@/services/RailwayApiClient';
 *   
 *   const prospects = await railwayClient.prospects.list({ status: 'new' });
 *   const health = await railwayClient.health.check();
 */

import type {
  RailwayHealthResponse,
  RailwayProspect,
  RailwaySequence,
  RailwayEnrollment,
  RailwayEmail,
  RailwayApiResult,
  PaginatedResponse,
  CreateProspectRequest,
  UpdateProspectRequest,
  ProspectSearchParams,
  BatchUpsertProspectRequest,
  BatchUpsertProspectResponse,
  CreateSequenceRequest,
  UpdateSequenceRequest,
  CreateEnrollmentRequest,
  BulkEnrollRequest,
  BulkEnrollResponse,
  SendEmailRequest,
  SendEmailResponse,
  EmailQueueStatusResponse,
  DeadLetterItem,
  EmailAnalytics,
  SequenceAnalytics,
  UUID,
  RailwaySession,
  LoginRequest,
  MigrateFromFirebaseRequest,
  RailwayUser,
} from '@/types/railway';
import { featureFlags } from '@/config/featureFlags';

// =============================================================================
// Configuration
// =============================================================================

const DEFAULT_BASE_URL = '/api/railway';
const DEFAULT_TIMEOUT = 30000; // 30 seconds
const MAX_RETRIES = 3;
const RETRY_DELAY_BASE = 1000; // 1 second, doubles each retry

interface RailwayClientConfig {
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
  onRequest?: (url: string, init: RequestInit) => RequestInit;
  onResponse?: <T>(response: RailwayApiResult<T>) => RailwayApiResult<T>;
  onError?: (error: Error) => void;
}

// =============================================================================
// Offline Queue
// =============================================================================

interface QueuedRequest {
  id: string;
  url: string;
  method: string;
  body: unknown;
  timestamp: number;
}

const OFFLINE_QUEUE_KEY = 'railway_offline_queue';

function getOfflineQueue(): QueuedRequest[] {
  try {
    const stored = localStorage.getItem(OFFLINE_QUEUE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function addToOfflineQueue(request: Omit<QueuedRequest, 'id' | 'timestamp'>): void {
  const queue = getOfflineQueue();
  queue.push({
    ...request,
    id: crypto.randomUUID(),
    timestamp: Date.now(),
  });
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
}

function clearOfflineQueue(): void {
  localStorage.removeItem(OFFLINE_QUEUE_KEY);
}

// =============================================================================
// Railway API Client Class
// =============================================================================

class RailwayApiClient {
  private baseUrl: string;
  private timeout: number;
  private maxRetries: number;
  private config: RailwayClientConfig;
  private isOnline: boolean = navigator.onLine;
  private healthCache: { data: RailwayHealthResponse | null; timestamp: number } = {
    data: null,
    timestamp: 0,
  };
  private readonly HEALTH_CACHE_TTL = 30000; // 30 seconds

  constructor(config: RailwayClientConfig = {}) {
    this.baseUrl = config.baseUrl || DEFAULT_BASE_URL;
    this.timeout = config.timeout || DEFAULT_TIMEOUT;
    this.maxRetries = config.maxRetries || MAX_RETRIES;
    this.config = config;

    // Listen for online/offline events
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.isOnline = true;
        this.processOfflineQueue();
      });
      window.addEventListener('offline', () => {
        this.isOnline = false;
      });
    }
  }

  // ===========================================================================
  // Core HTTP Methods
  // ===========================================================================

  private async request<T>(
    method: string,
    path: string,
    options: {
      body?: unknown;
      params?: Record<string, string | number | boolean | undefined>;
      retry?: boolean;
      queueIfOffline?: boolean;
    } = {}
  ): Promise<RailwayApiResult<T>> {
    const { body, params, retry = true, queueIfOffline = false } = options;

    // Build URL with query params
    let url = `${this.baseUrl}${path}`;
    if (params) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, String(value));
        }
      });
      const queryString = searchParams.toString();
      if (queryString) {
        url += `?${queryString}`;
      }
    }

    // Handle offline
    if (!this.isOnline) {
      if (queueIfOffline && method !== 'GET') {
        addToOfflineQueue({ url, method, body });
        return {
          ok: true,
          data: { queued: true } as unknown as T,
          statusCode: 202,
        };
      }
      return {
        ok: false,
        error: 'Network offline',
        statusCode: 0,
      };
    }

    // Build request init
    let init: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    };

    if (body) {
      init.body = JSON.stringify(body);
    }

    // Apply request interceptor
    if (this.config.onRequest) {
      init = this.config.onRequest(url, init);
    }

    // Execute with retry
    let lastError: Error | null = null;
    const attempts = retry ? this.maxRetries : 1;

    for (let attempt = 0; attempt < attempts; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);
        init.signal = controller.signal;

        if (featureFlags.DEBUG_RAILWAY_REQUESTS) {
          console.log(`[Railway] ${method} ${url}`, body ? { body } : '');
        }

        const response = await fetch(url, init);
        clearTimeout(timeoutId);

        const contentType = response.headers.get('content-type');
        let data: T | undefined;

        if (contentType?.includes('application/json')) {
          data = await response.json();
        }

        let result: RailwayApiResult<T> = {
          ok: response.ok,
          data,
          statusCode: response.status,
        };

        if (!response.ok) {
          result.error = (data as any)?.message || (data as any)?.error || response.statusText;
        }

        // Apply response interceptor
        if (this.config.onResponse) {
          result = this.config.onResponse(result);
        }

        if (featureFlags.DEBUG_RAILWAY_REQUESTS) {
          console.log(`[Railway] Response:`, result);
        }

        return result;
      } catch (error) {
        lastError = error as Error;

        // Don't retry on abort or client errors
        if (
          (error as Error).name === 'AbortError' ||
          (error as any).statusCode >= 400 && (error as any).statusCode < 500
        ) {
          break;
        }

        // Exponential backoff
        if (attempt < attempts - 1) {
          await new Promise(resolve =>
            setTimeout(resolve, RETRY_DELAY_BASE * Math.pow(2, attempt))
          );
        }
      }
    }

    // Report error
    if (this.config.onError && lastError) {
      this.config.onError(lastError);
    }

    return {
      ok: false,
      error: lastError?.message || 'Request failed',
      statusCode: 0,
    };
  }

  private get<T>(path: string, params?: Record<string, string | number | boolean | undefined>) {
    return this.request<T>('GET', path, { params });
  }

  private post<T>(path: string, body?: unknown, options?: { queueIfOffline?: boolean }) {
    return this.request<T>('POST', path, { body, ...options });
  }

  private patch<T>(path: string, body?: unknown) {
    return this.request<T>('PATCH', path, { body });
  }

  private delete<T>(path: string) {
    return this.request<T>('DELETE', path);
  }

  // ===========================================================================
  // Offline Queue Processing
  // ===========================================================================

  async processOfflineQueue(): Promise<number> {
    const queue = getOfflineQueue();
    if (queue.length === 0) return 0;

    let processed = 0;
    const failed: QueuedRequest[] = [];

    for (const request of queue) {
      const result = await this.request(request.method, request.url.replace(this.baseUrl, ''), {
        body: request.body,
        retry: true,
        queueIfOffline: false,
      });

      if (result.ok) {
        processed++;
      } else {
        failed.push(request);
      }
    }

    // Save failed requests back to queue
    if (failed.length > 0) {
      localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(failed));
    } else {
      clearOfflineQueue();
    }

    return processed;
  }

  // ===========================================================================
  // Health API
  // ===========================================================================

  health = {
    check: async (forceRefresh = false): Promise<RailwayApiResult<RailwayHealthResponse>> => {
      // Return cached if fresh
      if (
        !forceRefresh &&
        this.healthCache.data &&
        Date.now() - this.healthCache.timestamp < this.HEALTH_CACHE_TTL
      ) {
        return { ok: true, data: this.healthCache.data, statusCode: 200 };
      }

      const result = await this.get<RailwayHealthResponse>('/health');

      if (result.ok && result.data) {
        this.healthCache = { data: result.data, timestamp: Date.now() };
      }

      return result;
    },

    isAvailable: async (): Promise<boolean> => {
      const result = await this.health.check();
      return result.ok && result.data?.status === 'healthy';
    },
  };

  // ===========================================================================
  // Prospects API
  // ===========================================================================

  prospects = {
    list: async (
      params: ProspectSearchParams = {}
    ): Promise<RailwayApiResult<PaginatedResponse<RailwayProspect>>> => {
      return this.get('/prospects', params as Record<string, string | number | boolean | undefined>);
    },

    get: async (id: UUID): Promise<RailwayApiResult<RailwayProspect>> => {
      return this.get(`/prospects/${id}`);
    },

    create: async (data: CreateProspectRequest): Promise<RailwayApiResult<RailwayProspect>> => {
      return this.post('/prospects', data, { queueIfOffline: true });
    },

    update: async (id: UUID, data: UpdateProspectRequest): Promise<RailwayApiResult<RailwayProspect>> => {
      return this.patch(`/prospects/${id}`, data);
    },

    delete: async (id: UUID): Promise<RailwayApiResult<void>> => {
      return this.delete(`/prospects/${id}`);
    },

    search: async (query: string, params: ProspectSearchParams = {}): Promise<RailwayApiResult<PaginatedResponse<RailwayProspect>>> => {
      // Convert params to simple key-value pairs for URL encoding
      const searchParams: Record<string, string | number | boolean | undefined> = {
        query,
        status: params.status ? (Array.isArray(params.status) ? params.status.join(',') : params.status) : undefined,
        tier: params.tier ? (Array.isArray(params.tier) ? params.tier.join(',') : params.tier) : undefined,
        companyId: params.companyId,
        tags: params.tags?.join(','),
        minScore: params.minScore,
        maxScore: params.maxScore,
        page: params.page,
        pageSize: params.pageSize,
        sortBy: params.sortBy,
        sortOrder: params.sortOrder,
      };
      return this.get('/prospects/search', searchParams);
    },

    batchUpsert: async (data: BatchUpsertProspectRequest): Promise<RailwayApiResult<BatchUpsertProspectResponse>> => {
      return this.post('/prospects/batch', data);
    },
  };

  // ===========================================================================
  // Sequences API
  // ===========================================================================

  sequences = {
    list: async (): Promise<RailwayApiResult<RailwaySequence[]>> => {
      return this.get('/sequences');
    },

    get: async (id: UUID): Promise<RailwayApiResult<RailwaySequence>> => {
      return this.get(`/sequences/${id}`);
    },

    create: async (data: CreateSequenceRequest): Promise<RailwayApiResult<RailwaySequence>> => {
      return this.post('/sequences', data);
    },

    update: async (id: UUID, data: UpdateSequenceRequest): Promise<RailwayApiResult<RailwaySequence>> => {
      return this.patch(`/sequences/${id}`, data);
    },

    delete: async (id: UUID): Promise<RailwayApiResult<void>> => {
      return this.delete(`/sequences/${id}`);
    },

    analytics: async (id: UUID): Promise<RailwayApiResult<SequenceAnalytics>> => {
      return this.get(`/sequences/${id}/analytics`);
    },
  };

  // ===========================================================================
  // Enrollments API
  // ===========================================================================

  enrollments = {
    list: async (params?: {
      sequenceId?: UUID;
      prospectId?: UUID;
      status?: string;
    }): Promise<RailwayApiResult<RailwayEnrollment[]>> => {
      return this.get('/enrollments', params);
    },

    get: async (id: UUID): Promise<RailwayApiResult<RailwayEnrollment>> => {
      return this.get(`/enrollments/${id}`);
    },

    create: async (data: CreateEnrollmentRequest): Promise<RailwayApiResult<RailwayEnrollment>> => {
      return this.post('/enrollments', data, { queueIfOffline: true });
    },

    bulkEnroll: async (data: BulkEnrollRequest): Promise<RailwayApiResult<BulkEnrollResponse>> => {
      return this.post('/enrollments/bulk', data);
    },

    pause: async (id: UUID, reason?: string): Promise<RailwayApiResult<RailwayEnrollment>> => {
      return this.post(`/enrollments/${id}/pause`, { reason });
    },

    resume: async (id: UUID): Promise<RailwayApiResult<RailwayEnrollment>> => {
      return this.post(`/enrollments/${id}/resume`);
    },

    cancel: async (id: UUID): Promise<RailwayApiResult<void>> => {
      return this.delete(`/enrollments/${id}`);
    },
  };

  // ===========================================================================
  // Email API
  // ===========================================================================

  email = {
    send: async (data: SendEmailRequest): Promise<RailwayApiResult<SendEmailResponse>> => {
      return this.post('/outreach/send-email', data, { queueIfOffline: true });
    },

    getEvents: async (params: {
      prospectId?: UUID;
      enrollmentId?: UUID;
      startDate?: string;
      endDate?: string;
    }): Promise<RailwayApiResult<RailwayEmail[]>> => {
      return this.get('/email/events', params);
    },

    analytics: async (params: {
      period?: 'day' | 'week' | 'month';
      startDate?: string;
      endDate?: string;
    }): Promise<RailwayApiResult<EmailAnalytics>> => {
      return this.get('/email/analytics', params);
    },

    queue: {
      status: async (): Promise<RailwayApiResult<EmailQueueStatusResponse>> => {
        return this.get('/email/queue/status');
      },

      deadLetter: async (): Promise<RailwayApiResult<DeadLetterItem[]>> => {
        return this.get('/email/queue/dead-letter');
      },

      retry: async (jobId: string): Promise<RailwayApiResult<void>> => {
        return this.post(`/email/queue/retry/${jobId}`);
      },

      retryAll: async (): Promise<RailwayApiResult<{ retried: number }>> => {
        return this.post('/email/queue/retry-all');
      },

      /** Sprint 2: T2.3 - Discard a single dead letter item */
      discard: async (jobId: string): Promise<RailwayApiResult<void>> => {
        return this.delete(`/email/queue/dead-letter/${jobId}`);
      },

      /** Sprint 2: T2.3 - Discard all dead letter items */
      discardAll: async (): Promise<RailwayApiResult<{ discarded: number }>> => {
        return this.delete('/email/queue/dead-letter');
      },
    },
  };

  // ===========================================================================
  // AI API
  // ===========================================================================

  ai = {
    generateContent: async (data: {
      type: 'email' | 'linkedin' | 'subject';
      context: {
        prospectName?: string;
        companyName?: string;
        title?: string;
        previousMessages?: string[];
        tone?: 'professional' | 'casual' | 'friendly';
        goal?: string;
      };
    }): Promise<RailwayApiResult<{ content: string; subject?: string }>> => {
      return this.post('/ai/content/generate', data);
    },
  };

  // ===========================================================================
  // Enrichment API
  // ===========================================================================

  enrichment = {
    email: async (data: {
      firstName: string;
      lastName: string;
      companyDomain: string;
    }): Promise<RailwayApiResult<{ email: string; confidence: number }>> => {
      return this.post('/enrichment/email', data);
    },

    smartGuess: async (data: {
      firstName: string;
      lastName: string;
      companyDomain: string;
    }): Promise<RailwayApiResult<{ emails: Array<{ email: string; pattern: string }> }>> => {
      return this.post('/enrichment/smart-guess', data);
    },
  };

  // ===========================================================================
  // Auth API (for Sprint 97)
  // ===========================================================================

  auth = {
    getSession: async (): Promise<RailwayApiResult<RailwaySession | null>> => {
      return this.get('/auth/session');
    },

    login: async (data: LoginRequest): Promise<RailwayApiResult<RailwaySession>> => {
      return this.post('/auth/login', data);
    },

    logout: async (): Promise<RailwayApiResult<void>> => {
      return this.post('/auth/logout');
    },

    refresh: async (): Promise<RailwayApiResult<RailwaySession>> => {
      return this.post('/auth/refresh');
    },

    migrateFromFirebase: async (data: MigrateFromFirebaseRequest): Promise<RailwayApiResult<RailwayUser>> => {
      return this.post('/users/from-firebase', data);
    },
  };
}

// =============================================================================
// Singleton Instance
// =============================================================================

export const railwayClient = new RailwayApiClient({
  onError: (error) => {
    console.error('[Railway API Error]', error);
  },
});

// =============================================================================
// Exports
// =============================================================================

export { RailwayApiClient };
export type { RailwayClientConfig };
