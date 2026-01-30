/**
 * RailwayApiClient - HTTP client for Railway backend communication
 * Sprint 81: Task T81.1
 * 
 * Provides authenticated access to Railway API endpoints for:
 * - Email sending and queue management
 * - Health checks
 * - Sequence operations
 */

export interface RailwayConfig {
  baseUrl: string;
  apiKey?: string;
  timeout?: number;
}

export interface RailwayResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  statusCode?: number;
}

export interface HealthCheckResponse {
  status: string;
  timestamp: string;
  database?: {
    status: string;
    connected?: boolean;
  };
  redis?: {
    status: string;
    connected?: boolean;
  };
  emailQueue?: {
    status: string;
    pending?: number;
    processing?: number;
  };
}

export interface EmailSendRequest {
  to: string;
  subject: string;
  body: string;
  templateId?: string;
  prospectId?: string;
  metadata?: Record<string, unknown>;
}

export interface EmailSendResponse {
  messageId: string;
  status: 'queued' | 'sent' | 'failed';
  queuePosition?: number;
}

export interface QueueStatusResponse {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
}

const DEFAULT_CONFIG: Required<RailwayConfig> = {
  baseUrl: 'https://yardflow-hitlist-production-2f41.up.railway.app',
  apiKey: '',
  timeout: 30000,
};

class RailwayApiClient {
  private config: Required<RailwayConfig>;
  private isInitialized = false;

  constructor(config?: Partial<RailwayConfig>) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    };
  }

  /**
   * Initialize the client with API key from environment
   */
  initialize(): void {
    const apiKey = import.meta.env.VITE_RAILWAY_API_KEY;
    if (apiKey) {
      this.config.apiKey = apiKey;
    }
    this.isInitialized = true;
  }

  /**
   * Check if client is initialized
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Check if API key is configured
   */
  hasApiKey(): boolean {
    return Boolean(this.config.apiKey);
  }

  /**
   * Build request headers with authentication
   */
  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    if (this.config.apiKey) {
      headers['X-Railway-API-Key'] = this.config.apiKey;
    }

    return headers;
  }

  /**
   * Make authenticated request to Railway API
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<RailwayResponse<T>> {
    if (!this.isInitialized) {
      this.initialize();
    }

    const url = `${this.config.baseUrl}${endpoint}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...this.getHeaders(),
          ...options.headers,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        return {
          success: false,
          error: `HTTP ${response.status}: ${errorText}`,
          statusCode: response.status,
        };
      }

      const data = await response.json();
      return {
        success: true,
        data,
        statusCode: response.status,
      };
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          return {
            success: false,
            error: 'Request timeout',
            statusCode: 408,
          };
        }
        return {
          success: false,
          error: error.message,
        };
      }
      
      return {
        success: false,
        error: 'Unknown error occurred',
      };
    }
  }

  /**
   * Check Railway API health
   */
  async checkHealth(): Promise<RailwayResponse<HealthCheckResponse>> {
    return this.request<HealthCheckResponse>('/api/health', {
      method: 'GET',
    });
  }

  /**
   * Send email via Railway
   */
  async sendEmail(request: EmailSendRequest): Promise<RailwayResponse<EmailSendResponse>> {
    return this.request<EmailSendResponse>('/api/email/send', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  /**
   * Get email queue status
   */
  async getQueueStatus(): Promise<RailwayResponse<QueueStatusResponse>> {
    return this.request<QueueStatusResponse>('/api/email/status', {
      method: 'GET',
    });
  }

  /**
   * Get email send status by message ID
   */
  async getEmailStatus(messageId: string): Promise<RailwayResponse<{ status: string; sentAt?: string }>> {
    return this.request<{ status: string; sentAt?: string }>(`/api/email/status/${messageId}`, {
      method: 'GET',
    });
  }

  /**
   * Get the Railway dashboard URL for a specific prospect search
   */
  getProspectSearchUrl(searchTerm: string): string {
    return `${this.config.baseUrl}/people?search=${encodeURIComponent(searchTerm)}`;
  }

  /**
   * Get the base Railway dashboard URL
   */
  getDashboardUrl(): string {
    return this.config.baseUrl;
  }
}

// Singleton instance
let clientInstance: RailwayApiClient | null = null;

export function getRailwayApiClient(): RailwayApiClient {
  if (!clientInstance) {
    clientInstance = new RailwayApiClient();
    clientInstance.initialize();
  }
  return clientInstance;
}

export function resetRailwayApiClient(): void {
  clientInstance = null;
}

export { RailwayApiClient };
export default getRailwayApiClient;
