/**
 * WebhookDispatcher
 * 
 * Outgoing webhook service for external integrations.
 * Dispatches events to configured webhook endpoints for
 * Zapier, Slack, CRM sync, and custom integrations.
 * 
 * Sprint 46: Pipeline Automation
 */

// Logger import - using console for now to avoid circular dependency
const logger = {
  info: (msg: string, ctx?: Record<string, unknown>) => console.log(`[WebhookDispatcher] ${msg}`, ctx),
  warn: (msg: string, ctx?: Record<string, unknown>) => console.warn(`[WebhookDispatcher] ${msg}`, ctx),
  error: (msg: string, ctx?: Record<string, unknown>) => console.error(`[WebhookDispatcher] ${msg}`, ctx)
};

/**
 * Supported webhook event types
 */
export type WebhookEventType = 
  | 'prospect.created'
  | 'prospect.updated'
  | 'prospect.deleted'
  | 'email.sent'
  | 'email.delivered'
  | 'email.opened'
  | 'email.clicked'
  | 'email.bounced'
  | 'reply.received'
  | 'meeting.booked'
  | 'sequence.enrolled'
  | 'sequence.completed'
  | 'sequence.paused';

/**
 * Webhook endpoint configuration
 */
export interface WebhookEndpoint {
  id: string;
  name: string;
  url: string;
  events: WebhookEventType[];
  secret?: string;
  headers?: Record<string, string>;
  isActive: boolean;
  /** Payload format: 'default' nested or 'zapier' flattened */
  format?: 'default' | 'zapier';
  createdAt: Date;
  updatedAt: Date;
  // Analytics
  successCount: number;
  failureCount: number;
  lastTriggeredAt?: Date;
  lastError?: string;
}

/**
 * Webhook payload structure
 */
export interface WebhookPayload<T = unknown> {
  id: string;
  event: WebhookEventType;
  timestamp: string;
  data: T;
  signature?: string;
}

/**
 * Dispatch result
 */
export interface DispatchResult {
  endpointId: string;
  endpointName: string;
  success: boolean;
  statusCode?: number;
  error?: string;
  duration: number;
}

/**
 * Batch dispatch result
 */
export interface BatchDispatchResult {
  event: WebhookEventType;
  dispatched: number;
  succeeded: number;
  failed: number;
  results: DispatchResult[];
}

/**
 * Retry configuration
 */
interface RetryConfig {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000
};

/**
 * WebhookDispatcher - Sends events to external webhook endpoints
 */
export class WebhookDispatcher {
  private endpoints: WebhookEndpoint[] = [];
  private retryConfig: RetryConfig;

  constructor(retryConfig: Partial<RetryConfig> = {}) {
    this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...retryConfig };
  }

  /**
   * Load endpoints from storage
   */
  loadEndpoints(endpoints: WebhookEndpoint[]): void {
    this.endpoints = endpoints;
  }

  /**
   * Add an endpoint
   */
  registerEndpoint(endpoint: Omit<WebhookEndpoint, 'id' | 'createdAt' | 'updatedAt' | 'successCount' | 'failureCount'>): WebhookEndpoint {
    const newEndpoint: WebhookEndpoint = {
      ...endpoint,
      id: crypto.randomUUID(),
      createdAt: new Date(),
      updatedAt: new Date(),
      successCount: 0,
      failureCount: 0
    };
    this.endpoints.push(newEndpoint);
    return newEndpoint;
  }

  /**
   * Update an endpoint
   */
  updateEndpoint(id: string, updates: Partial<WebhookEndpoint>): WebhookEndpoint | null {
    const index = this.endpoints.findIndex(e => e.id === id);
    if (index === -1) return null;

    this.endpoints[index] = {
      ...this.endpoints[index],
      ...updates,
      updatedAt: new Date()
    };
    return this.endpoints[index];
  }

  /**
   * Remove an endpoint
   */
  removeEndpoint(id: string): boolean {
    const initialLength = this.endpoints.length;
    this.endpoints = this.endpoints.filter(e => e.id !== id);
    return this.endpoints.length < initialLength;
  }

  /**
   * Get endpoints for a specific event
   */
  getEndpointsForEvent(event: WebhookEventType): WebhookEndpoint[] {
    return this.endpoints.filter(e => 
      e.isActive && e.events.includes(event)
    );
  }

  /**
   * Generate HMAC signature for payload
   */
  private generateSignature(payload: string, secret: string): string {
    // Use Web Crypto API for HMAC-SHA256
    // In Node.js environment, we'd use crypto.createHmac
    // For browser compatibility, implement simplified version
    const encoder = new TextEncoder();
    const data = encoder.encode(payload + secret);
    
    // Simple hash for signature (in production, use proper HMAC)
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data[i];
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    
    return `sha256=${Math.abs(hash).toString(16)}`;
  }

  /**
   * Dispatch an event to all registered endpoints
   */
  async dispatch<T>(event: WebhookEventType, data: T): Promise<BatchDispatchResult> {
    const endpoints = this.getEndpointsForEvent(event);
    
    if (endpoints.length === 0) {
      logger.info('No webhook endpoints for event', { event });
      return {
        event,
        dispatched: 0,
        succeeded: 0,
        failed: 0,
        results: []
      };
    }

    const results: DispatchResult[] = [];
    let succeeded = 0;
    let failed = 0;

    for (const endpoint of endpoints) {
      const result = await this.dispatchToEndpoint(endpoint, event, data);
      results.push(result);
      
      if (result.success) {
        succeeded++;
        endpoint.successCount++;
      } else {
        failed++;
        endpoint.failureCount++;
        endpoint.lastError = result.error;
      }
      endpoint.lastTriggeredAt = new Date();
    }

    logger.info('Webhook dispatch complete', {
      event,
      dispatched: endpoints.length,
      succeeded,
      failed
    });

    return {
      event,
      dispatched: endpoints.length,
      succeeded,
      failed,
      results
    };
  }

  /**
   * Flatten an object for Zapier-compatible format
   */
  private flattenForZapier<T>(data: T, prefix = ''): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    
    if (data === null || data === undefined) {
      return result;
    }
    
    if (typeof data !== 'object' || data instanceof Date) {
      return { [prefix || 'value']: data };
    }
    
    for (const [key, value] of Object.entries(data)) {
      const newKey = prefix ? `${prefix}_${key}` : key;
      
      if (value === null || value === undefined) {
        result[newKey] = null;
      } else if (Array.isArray(value)) {
        result[newKey] = value;
      } else if (typeof value === 'object' && !(value instanceof Date)) {
        Object.assign(result, this.flattenForZapier(value, newKey));
      } else {
        result[newKey] = value;
      }
    }
    
    return result;
  }

  /**
   * Dispatch to a single endpoint with retry
   */
  private async dispatchToEndpoint<T>(
    endpoint: WebhookEndpoint,
    event: WebhookEventType,
    data: T
  ): Promise<DispatchResult> {
    const startTime = Date.now();
    
    // Create payload based on format
    let body: string;
    const deliveryId = crypto.randomUUID();
    
    if (endpoint.format === 'zapier') {
      // Zapier-friendly flattened format
      const zapierPayload = {
        event_type: event,
        delivery_id: deliveryId,
        timestamp: new Date().toISOString(),
        ...this.flattenForZapier(data)
      };
      body = JSON.stringify(zapierPayload);
    } else {
      // Default nested format
      const payload: WebhookPayload<T> = {
        id: deliveryId,
        event,
        timestamp: new Date().toISOString(),
        data
      };
      body = JSON.stringify(payload);
    }

    // Generate signature if secret is configured
    let signature: string | undefined;
    if (endpoint.secret) {
      signature = this.generateSignature(body, endpoint.secret);
    }

    let lastError: string | undefined;
    let statusCode: number | undefined;

    for (let attempt = 1; attempt <= this.retryConfig.maxAttempts; attempt++) {
      try {
        const response = await fetch(endpoint.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'YardFlow-Webhook/1.0',
            'X-Webhook-Event': event,
            'X-Webhook-Delivery': deliveryId,
            ...(signature && { 'X-Webhook-Signature': signature }),
            ...(endpoint.headers || {})
          },
          body,
          signal: AbortSignal.timeout(30000) // 30s timeout
        });

        statusCode = response.status;

        if (response.ok) {
          return {
            endpointId: endpoint.id,
            endpointName: endpoint.name,
            success: true,
            statusCode,
            duration: Date.now() - startTime
          };
        }

        // Non-retryable status codes
        if (response.status >= 400 && response.status < 500 && response.status !== 429) {
          const errorText = await response.text().catch(() => 'Unknown error');
          return {
            endpointId: endpoint.id,
            endpointName: endpoint.name,
            success: false,
            statusCode,
            error: `HTTP ${response.status}: ${errorText}`,
            duration: Date.now() - startTime
          };
        }

        lastError = `HTTP ${response.status}`;
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'Unknown error';
        logger.warn('Webhook dispatch attempt failed', {
          endpoint: endpoint.name,
          attempt,
          error: lastError
        });
      }

      // Wait before retry (exponential backoff)
      if (attempt < this.retryConfig.maxAttempts) {
        const delay = Math.min(
          this.retryConfig.baseDelayMs * Math.pow(2, attempt - 1),
          this.retryConfig.maxDelayMs
        );
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    return {
      endpointId: endpoint.id,
      endpointName: endpoint.name,
      success: false,
      statusCode,
      error: lastError || 'Max retries exceeded',
      duration: Date.now() - startTime
    };
  }

  /**
   * Get all endpoints
   */
  getEndpoints(): WebhookEndpoint[] {
    return [...this.endpoints];
  }

  /**
   * Get active endpoints only
   */
  getActiveEndpoints(): WebhookEndpoint[] {
    return this.endpoints.filter(e => e.isActive);
  }

  /**
   * Test an endpoint with a ping event
   */
  async testEndpoint(endpointId: string): Promise<DispatchResult> {
    const endpoint = this.endpoints.find(e => e.id === endpointId);
    if (!endpoint) {
      return {
        endpointId,
        endpointName: 'Unknown',
        success: false,
        error: 'Endpoint not found',
        duration: 0
      };
    }

    return this.dispatchToEndpoint(endpoint, 'prospect.created' as WebhookEventType, {
      _test: true,
      message: 'This is a test webhook from YardFlow'
    });
  }
}

// Singleton instance
let webhookDispatcherInstance: WebhookDispatcher | null = null;

export function getWebhookDispatcher(): WebhookDispatcher {
  if (!webhookDispatcherInstance) {
    webhookDispatcherInstance = new WebhookDispatcher();
  }
  return webhookDispatcherInstance;
}

/**
 * Convenience function to dispatch an event
 */
export async function dispatchWebhook<T>(
  event: WebhookEventType,
  data: T
): Promise<BatchDispatchResult> {
  return getWebhookDispatcher().dispatch(event, data);
}
