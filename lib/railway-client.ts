/**
 * Railway Backend API Client
 * 
 * Server-side client for direct Railway backend communication.
 * Used in Vercel API routes to call Railway with service-to-service authentication.
 * 
 * For client-side (browser) usage, requests should go through:
 * - /api/railway/[...path].ts proxy (handles auth automatically)
 * - src/services/RailwayApiClient.ts (wraps the proxy)
 * 
 * This client is for SERVER-SIDE Vercel API routes only.
 * 
 * Environment Variables Required:
 * - RAILWAY_API_URL: Railway backend URL
 * - SERVICE_TO_SERVICE_SECRET: Shared secret for S2S auth (same as Railway's CRON_SECRET)
 */

const BASE_URL = process.env.RAILWAY_API_URL;
const SERVICE_KEY = process.env.SERVICE_TO_SERVICE_SECRET || process.env.RAILWAY_API_SECRET || process.env.CRON_SECRET;

interface FetchOptions extends RequestInit {
  params?: Record<string, string>;
}

interface UserContext {
  userId?: string;
  email?: string;
}

export interface RailwayClientError extends Error {
  status: number;
  endpoint: string;
}

/**
 * Railway API client for server-side (Vercel API routes) usage
 * 
 * @example
 * ```typescript
 * // In a Vercel API route
 * import { railwayServerClient } from '@/lib/railway-client';
 * 
 * export default async function handler(req, res) {
 *   const stats = await railwayServerClient.fetch('/api/dashboards/stats');
 *   res.json(stats);
 * }
 * ```
 */
export const railwayServerClient = {
  /**
   * Make a request to the Railway backend with S2S authentication
   * 
   * @param endpoint - API endpoint path (e.g., '/api/health', '/api/dashboards/stats')
   * @param options - Fetch options including optional query params
   * @param userContext - Optional user context to pass to Railway (for user-scoped operations)
   * @returns Parsed JSON response
   * @throws RailwayClientError on failure
   */
  async fetch<T>(
    endpoint: string, 
    options: FetchOptions = {},
    userContext?: UserContext
  ): Promise<T> {
    if (!BASE_URL) {
      throw new Error("Missing RAILWAY_API_URL environment variable");
    }
    
    if (!SERVICE_KEY) {
      throw new Error("Missing SERVICE_TO_SERVICE_SECRET environment variable (or RAILWAY_API_SECRET/CRON_SECRET)");
    }

    const headers = new Headers(options.headers);
    
    // S2S Auth Headers
    headers.set("x-service-key", SERVICE_KEY);
    headers.set("Authorization", `Bearer ${SERVICE_KEY}`);
    
    // User context headers (for user-scoped operations)
    if (userContext?.userId) {
      headers.set("x-user-id", userContext.userId);
    }
    if (userContext?.email) {
      headers.set("x-user-email", userContext.email);
    }
    
    // Default to service identity if no user context provided
    if (!userContext?.userId) {
      headers.set("x-user-id", "service:gtm-frontend");
    }
    
    // Content type defaults
    if (!headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    
    // Request tracing
    headers.set("x-request-id", crypto.randomUUID().slice(0, 8));
    headers.set("x-source", "gtm-yardflow-vercel");

    // Build URL with query params
    let url = `${BASE_URL}${endpoint}`;
    if (options.params) {
      const qs = new URLSearchParams(options.params).toString();
      url += `?${qs}`;
    }

    const { params: _params, ...fetchOptions } = options;

    const res = await fetch(url, {
      ...fetchOptions,
      headers,
    });

    if (!res.ok) {
      const errorText = await res.text();
      const error = new Error(`Railway API Error [${res.status}]: ${errorText}`) as RailwayClientError;
      error.status = res.status;
      error.endpoint = endpoint;
      throw error;
    }

    // Handle empty responses (204 No Content, etc.)
    const text = await res.text();
    return (text ? JSON.parse(text) : null) as T;
  },

  /**
   * Convenience method for GET requests
   */
  async get<T>(endpoint: string, params?: Record<string, string>, userContext?: UserContext): Promise<T> {
    return this.fetch<T>(endpoint, { method: 'GET', params }, userContext);
  },

  /**
   * Convenience method for POST requests
   */
  async post<T>(endpoint: string, body: unknown, userContext?: UserContext): Promise<T> {
    return this.fetch<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    }, userContext);
  },

  /**
   * Convenience method for PUT requests
   */
  async put<T>(endpoint: string, body: unknown, userContext?: UserContext): Promise<T> {
    return this.fetch<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body),
    }, userContext);
  },

  /**
   * Convenience method for PATCH requests
   */
  async patch<T>(endpoint: string, body: unknown, userContext?: UserContext): Promise<T> {
    return this.fetch<T>(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }, userContext);
  },

  /**
   * Convenience method for DELETE requests
   */
  async delete<T>(endpoint: string, userContext?: UserContext): Promise<T> {
    return this.fetch<T>(endpoint, { method: 'DELETE' }, userContext);
  },

  /**
   * Health check - useful for verifying Railway connectivity
   */
  async healthCheck(): Promise<{
    status: string;
    checks?: Record<string, unknown>;
    timestamp: string;
  }> {
    return this.get('/api/health');
  },
};

// Type alias for backwards compatibility with integration guide naming
export const railwayClient = railwayServerClient;

export default railwayServerClient;
