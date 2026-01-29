/**
 * HubSpot API Client
 * Sprint 26 - T26.3
 * 
 * Type-safe HubSpot API wrapper with rate limiting and caching.
 */

import type {
  HubSpotContact,
  HubSpotDeal,
  HubSpotEngagement,
  HubSpotContactsResponse,
  HubSpotDealsResponse,
  HubSpotSearchResponse,
  CreateContactInput,
  CreateDealInput,
  TaskInput,
  EmailLogInput,
  ListParams,
  SearchFilters,
  PaginatedResponse,
  BatchResult,
} from '../types/hubspot';
import {
  HubSpotContactsResponseSchema,
  HubSpotDealsResponseSchema,
  HubSpotContactSchema,
  HubSpotDealSchema,
  HubSpotApiError,
  RateLimitError,
} from '../types/hubspot';
import type { HubSpotAuthService } from './HubSpotAuthService';

// =============================================================================
// Configuration
// =============================================================================

const HUBSPOT_API_BASE = 'https://api.hubapi.com';
const RATE_LIMIT = 100; // requests per 10 seconds
const RATE_LIMIT_WINDOW_MS = 10000;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_BATCH_SIZE = 100;
const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 2000, 4000]; // exponential backoff

// =============================================================================
// Rate Limiter
// =============================================================================

interface RateLimiterState {
  requests: number[];
  queue: Array<{
    resolve: () => void;
    priority: number;
  }>;
}

function createRateLimiter() {
  const state: RateLimiterState = {
    requests: [],
    queue: [],
  };

  function cleanOldRequests() {
    const now = Date.now();
    state.requests = state.requests.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
  }

  function processQueue() {
    cleanOldRequests();
    
    // Sort queue by priority (higher = more important)
    state.queue.sort((a, b) => b.priority - a.priority);
    
    while (state.queue.length > 0 && state.requests.length < RATE_LIMIT) {
      const next = state.queue.shift();
      if (next) {
        state.requests.push(Date.now());
        next.resolve();
      }
    }
  }

  async function acquire(priority = 0): Promise<void> {
    cleanOldRequests();
    
    if (state.requests.length < RATE_LIMIT) {
      state.requests.push(Date.now());
      return;
    }
    
    // Wait in queue
    return new Promise((resolve) => {
      state.queue.push({ resolve, priority });
      
      // Check queue periodically
      const interval = setInterval(() => {
        processQueue();
        if (!state.queue.find(q => q.resolve === resolve)) {
          clearInterval(interval);
        }
      }, 100);
    });
  }

  function getQueueLength(): number {
    return state.queue.length;
  }

  function getRequestCount(): number {
    cleanOldRequests();
    return state.requests.length;
  }

  return { acquire, getQueueLength, getRequestCount };
}

// =============================================================================
// Cache
// =============================================================================

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

function createCache<T>() {
  const cache = new Map<string, CacheEntry<T>>();

  function get(key: string): T | null {
    const entry = cache.get(key);
    if (!entry) return null;
    
    if (Date.now() > entry.expiresAt) {
      cache.delete(key);
      return null;
    }
    
    return entry.data;
  }

  function set(key: string, data: T, ttl = CACHE_TTL_MS): void {
    cache.set(key, {
      data,
      expiresAt: Date.now() + ttl,
    });
  }

  function invalidate(keyPattern?: string): void {
    if (!keyPattern) {
      cache.clear();
      return;
    }
    
    for (const key of cache.keys()) {
      if (key.includes(keyPattern)) {
        cache.delete(key);
      }
    }
  }

  return { get, set, invalidate };
}

// =============================================================================
// HubSpot Client
// =============================================================================

export interface HubSpotClientConfig {
  authService: HubSpotAuthService;
}

export interface HubSpotClient {
  // Contacts
  getContacts(params?: ListParams): Promise<PaginatedResponse<HubSpotContact>>;
  getContact(id: string): Promise<HubSpotContact | null>;
  createContact(data: CreateContactInput): Promise<HubSpotContact>;
  updateContact(id: string, data: Partial<CreateContactInput>): Promise<void>;
  searchContacts(query: string, filters?: SearchFilters[]): Promise<HubSpotContact[]>;
  batchCreateContacts(contacts: CreateContactInput[]): Promise<BatchResult>;
  
  // Deals
  getDeals(params?: ListParams): Promise<PaginatedResponse<HubSpotDeal>>;
  createDeal(data: CreateDealInput): Promise<HubSpotDeal>;
  updateDeal(id: string, data: Partial<CreateDealInput>): Promise<void>;
  associateContactToDeal(contactId: string, dealId: string): Promise<void>;
  
  // Engagements
  createNote(objectId: string, body: string): Promise<HubSpotEngagement>;
  createTask(objectId: string, data: TaskInput): Promise<HubSpotEngagement>;
  logEmail(objectId: string, data: EmailLogInput): Promise<HubSpotEngagement>;
  
  // Connection Test
  testConnection(): Promise<{ valid: boolean; portalId: string; hubDomain: string }>;
  
  // Utilities
  invalidateCache(pattern?: string): void;
  getRateLimitStatus(): { queueLength: number; requestCount: number };
}

export function createHubSpotClient(config: HubSpotClientConfig): HubSpotClient {
  const { authService } = config;
  const rateLimiter = createRateLimiter();
  const cache = createCache<unknown>();

  /**
   * Make authenticated request to HubSpot API
   */
  async function request<T>(
    method: string,
    path: string,
    options: {
      body?: unknown;
      priority?: number;
      useCache?: boolean;
      cacheKey?: string;
    } = {}
  ): Promise<T> {
    const { body, priority = 0, useCache = false, cacheKey } = options;
    
    // Check cache first
    if (useCache && cacheKey) {
      const cached = cache.get(cacheKey) as T | null;
      if (cached) return cached;
    }

    // Get access token
    const accessToken = await authService.getAccessToken();
    if (!accessToken) {
      throw new HubSpotApiError('Not authenticated with HubSpot', 401);
    }

    // Acquire rate limit slot
    await rateLimiter.acquire(priority);

    // Make request with retries
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await fetch(`${HUBSPOT_API_BASE}${path}`, {
          method,
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: body ? JSON.stringify(body) : undefined,
        });

        if (response.status === 429) {
          const retryAfter = parseInt(response.headers.get('Retry-After') || '10', 10);
          throw new RateLimitError(retryAfter);
        }

        if (!response.ok) {
          const error = await response.json().catch(() => ({ message: 'Request failed' }));
          throw new HubSpotApiError(
            error.message || `Request failed with status ${response.status}`,
            response.status,
            error.correlationId,
            error.category
          );
        }

        const data = await response.json() as T;
        
        // Cache successful reads
        if (useCache && cacheKey) {
          cache.set(cacheKey, data);
        }
        
        return data;
      } catch (error) {
        lastError = error as Error;
        
        // Don't retry on auth errors
        if (error instanceof HubSpotApiError && error.statusCode === 401) {
          throw error;
        }
        
        // Retry on rate limit or server errors
        if (
          (error instanceof RateLimitError || 
           (error instanceof HubSpotApiError && error.statusCode >= 500)) &&
          attempt < MAX_RETRIES
        ) {
          const delay = error instanceof RateLimitError 
            ? error.retryAfter * 1000 
            : RETRY_DELAYS[attempt];
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        throw error;
      }
    }
    
    throw lastError;
  }

  // ==========================================================================
  // Contacts
  // ==========================================================================

  async function getContacts(params: ListParams = {}): Promise<PaginatedResponse<HubSpotContact>> {
    const { limit = 100, after, properties = [], archived = false } = params;
    
    const queryParams = new URLSearchParams({
      limit: String(limit),
      archived: String(archived),
    });
    
    if (after) queryParams.set('after', after);
    if (properties.length) queryParams.set('properties', properties.join(','));
    
    const cacheKey = `contacts:${queryParams.toString()}`;
    
    const response = await request<HubSpotContactsResponse>(
      'GET',
      `/crm/v3/objects/contacts?${queryParams}`,
      { useCache: true, cacheKey }
    );
    
    const validated = HubSpotContactsResponseSchema.parse(response);
    
    return {
      results: validated.results,
      hasMore: !!validated.paging?.next,
      nextCursor: validated.paging?.next?.after,
    };
  }

  async function getContact(id: string): Promise<HubSpotContact | null> {
    try {
      const response = await request<HubSpotContact>(
        'GET',
        `/crm/v3/objects/contacts/${id}`,
        { useCache: true, cacheKey: `contact:${id}` }
      );
      return HubSpotContactSchema.parse(response);
    } catch (error) {
      if (error instanceof HubSpotApiError && error.statusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  async function createContact(data: CreateContactInput): Promise<HubSpotContact> {
    const response = await request<HubSpotContact>(
      'POST',
      '/crm/v3/objects/contacts',
      { body: { properties: data }, priority: 10 }
    );
    
    cache.invalidate('contacts');
    return HubSpotContactSchema.parse(response);
  }

  async function updateContact(id: string, data: Partial<CreateContactInput>): Promise<void> {
    await request<void>(
      'PATCH',
      `/crm/v3/objects/contacts/${id}`,
      { body: { properties: data }, priority: 10 }
    );
    
    cache.invalidate(`contact:${id}`);
    cache.invalidate('contacts');
  }

  async function searchContacts(query: string, filters: SearchFilters[] = []): Promise<HubSpotContact[]> {
    const body = {
      query,
      filterGroups: filters.length > 0 ? [{
        filters: filters.map(f => ({
          propertyName: f.propertyName,
          operator: f.operator,
          value: f.value,
        })),
      }] : undefined,
      limit: 100,
    };
    
    const response = await request<HubSpotSearchResponse>(
      'POST',
      '/crm/v3/objects/contacts/search',
      { body, priority: 5 }
    );
    
    return response.results;
  }

  async function batchCreateContacts(contacts: CreateContactInput[]): Promise<BatchResult> {
    const results: BatchResult = {
      status: 'COMPLETE',
      results: [],
      numErrors: 0,
    };
    
    // Chunk into batches
    for (let i = 0; i < contacts.length; i += MAX_BATCH_SIZE) {
      const batch = contacts.slice(i, i + MAX_BATCH_SIZE);
      
      try {
        const response = await request<{ results: Array<{ id: string }> }>(
          'POST',
          '/crm/v3/objects/contacts/batch/create',
          {
            body: {
              inputs: batch.map(c => ({ properties: c })),
            },
            priority: 5,
          }
        );
        
        response.results.forEach(r => {
          results.results.push({ id: r.id, status: 'SUCCESS' });
        });
      } catch (error) {
        // Mark all in this batch as failed
        batch.forEach((_, idx) => {
          results.results.push({
            id: String(i + idx),
            status: 'FAILED',
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          results.numErrors++;
        });
      }
    }
    
    results.status = results.numErrors === 0 
      ? 'COMPLETE' 
      : results.numErrors === results.results.length 
        ? 'FAILED' 
        : 'PARTIAL';
    
    cache.invalidate('contacts');
    return results;
  }

  // ==========================================================================
  // Deals
  // ==========================================================================

  async function getDeals(params: ListParams = {}): Promise<PaginatedResponse<HubSpotDeal>> {
    const { limit = 100, after, properties = [] } = params;
    
    const queryParams = new URLSearchParams({
      limit: String(limit),
    });
    
    if (after) queryParams.set('after', after);
    if (properties.length) queryParams.set('properties', properties.join(','));
    
    const cacheKey = `deals:${queryParams.toString()}`;
    
    const response = await request<HubSpotDealsResponse>(
      'GET',
      `/crm/v3/objects/deals?${queryParams}`,
      { useCache: true, cacheKey }
    );
    
    const validated = HubSpotDealsResponseSchema.parse(response);
    
    return {
      results: validated.results,
      hasMore: !!validated.paging?.next,
      nextCursor: validated.paging?.next?.after,
    };
  }

  async function createDeal(data: CreateDealInput): Promise<HubSpotDeal> {
    const response = await request<HubSpotDeal>(
      'POST',
      '/crm/v3/objects/deals',
      { body: { properties: data }, priority: 10 }
    );
    
    cache.invalidate('deals');
    return HubSpotDealSchema.parse(response);
  }

  async function updateDeal(id: string, data: Partial<CreateDealInput>): Promise<void> {
    await request<void>(
      'PATCH',
      `/crm/v3/objects/deals/${id}`,
      { body: { properties: data }, priority: 10 }
    );
    
    cache.invalidate('deals');
  }

  async function associateContactToDeal(contactId: string, dealId: string): Promise<void> {
    await request<void>(
      'PUT',
      `/crm/v4/objects/contacts/${contactId}/associations/deals/${dealId}`,
      {
        body: [{
          associationCategory: 'HUBSPOT_DEFINED',
          associationTypeId: 4, // Contact to Deal
        }],
        priority: 10,
      }
    );
  }

  // ==========================================================================
  // Engagements
  // ==========================================================================

  async function createNote(objectId: string, body: string): Promise<HubSpotEngagement> {
    const response = await request<HubSpotEngagement>(
      'POST',
      '/crm/v3/objects/notes',
      {
        body: {
          properties: {
            hs_note_body: body,
            hs_timestamp: new Date().toISOString(),
          },
          associations: [{
            to: { id: objectId },
            types: [{
              associationCategory: 'HUBSPOT_DEFINED',
              associationTypeId: 202, // Note to Contact
            }],
          }],
        },
        priority: 5,
      }
    );
    
    return response;
  }

  async function createTask(objectId: string, data: TaskInput): Promise<HubSpotEngagement> {
    const response = await request<HubSpotEngagement>(
      'POST',
      '/crm/v3/objects/tasks',
      {
        body: {
          properties: {
            hs_task_subject: data.subject,
            hs_task_body: data.body || '',
            hs_task_status: 'NOT_STARTED',
            hs_task_priority: data.priority || 'MEDIUM',
            hs_timestamp: data.dueDate || new Date().toISOString(),
          },
          associations: [{
            to: { id: objectId },
            types: [{
              associationCategory: 'HUBSPOT_DEFINED',
              associationTypeId: 204, // Task to Contact
            }],
          }],
        },
        priority: 5,
      }
    );
    
    return response;
  }

  async function logEmail(objectId: string, data: EmailLogInput): Promise<HubSpotEngagement> {
    const response = await request<HubSpotEngagement>(
      'POST',
      '/crm/v3/objects/emails',
      {
        body: {
          properties: {
            hs_email_subject: data.subject,
            hs_email_text: data.body,
            hs_email_direction: data.direction || 'SENT',
            hs_timestamp: data.timestamp || new Date().toISOString(),
          },
          associations: [{
            to: { id: objectId },
            types: [{
              associationCategory: 'HUBSPOT_DEFINED',
              associationTypeId: 198, // Email to Contact
            }],
          }],
        },
        priority: 5,
      }
    );
    
    return response;
  }

  // ==========================================================================
  // Utilities
  // ==========================================================================

  // ==========================================================================
  // Connection Test
  // ==========================================================================

  /**
   * Test connection to HubSpot API and get account info
   * Calls /account-info/v3/details to verify credentials and get portal info
   */
  async function testConnection(): Promise<{ valid: boolean; portalId: string; hubDomain: string }> {
    try {
      interface AccountInfoResponse {
        portalId: number;
        accountType: string;
        timeZone: string;
        companyCurrency: string;
        additionalCurrencies: string[];
        utcOffset: string;
        utcOffsetMilliseconds: number;
        uiDomain: string;
        dataHostingLocation: string;
      }

      const response = await request<AccountInfoResponse>(
        'GET',
        '/account-info/v3/details',
        { priority: 10 } // High priority for connection test
      );

      return {
        valid: true,
        portalId: response.portalId.toString(),
        hubDomain: response.uiDomain || 'app.hubspot.com',
      };
    } catch (error) {
      console.error('[HubSpotClient] Connection test failed:', error);
      return {
        valid: false,
        portalId: '',
        hubDomain: '',
      };
    }
  }

  // ==========================================================================
  // Utilities
  // ==========================================================================

  function invalidateCache(pattern?: string): void {
    cache.invalidate(pattern);
  }

  function getRateLimitStatus(): { queueLength: number; requestCount: number } {
    return {
      queueLength: rateLimiter.getQueueLength(),
      requestCount: rateLimiter.getRequestCount(),
    };
  }

  return {
    getContacts,
    getContact,
    createContact,
    updateContact,
    searchContacts,
    batchCreateContacts,
    getDeals,
    createDeal,
    updateDeal,
    associateContactToDeal,
    createNote,
    createTask,
    logEmail,
    testConnection,
    invalidateCache,
    getRateLimitStatus,
  };
}
