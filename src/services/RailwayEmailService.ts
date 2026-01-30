/**
 * Railway Email Service
 * 
 * Routes email operations to the Railway backend which has:
 * - Proper Postgres database with email tracking
 * - Redis-backed job queues for async processing
 * - Robust SendGrid integration with tracking
 * - Automated sequence processing
 * 
 * This service provides a clean interface for the frontend to send emails
 * through Railway's infrastructure.
 */

const RAILWAY_API_URL = import.meta.env.VITE_RAILWAY_API_URL || 
  'https://yardflow-hitlist-production-2f41.up.railway.app';

export interface RailwayEmailRequest {
  to: string;
  toName?: string;
  subject: string;
  htmlBody: string;
  textBody?: string;
  prospectId?: string;
  campaignId?: string;
}

export interface RailwayEmailResponse {
  success: boolean;
  messageId?: string;
  error?: string;
  queuedForProcessing?: boolean;
}

export interface RailwayHealthResponse {
  status: 'healthy' | 'unhealthy';
  checks: {
    database: { status: string; latencyMs: number };
    redis: { status: string; latencyMs: number };
    queues: { status: string; queues: Record<string, unknown> };
  };
  timestamp: string;
}

/**
 * Check Railway backend health
 */
export async function checkRailwayHealth(): Promise<RailwayHealthResponse | null> {
  try {
    const response = await fetch(`${RAILWAY_API_URL}/api/health`);
    if (!response.ok) {
      console.error('Railway health check failed:', response.status);
      return null;
    }
    return await response.json();
  } catch (error) {
    console.error('Railway health check error:', error);
    return null;
  }
}

/**
 * Check if Railway backend is available
 */
export async function isRailwayAvailable(): Promise<boolean> {
  const health = await checkRailwayHealth();
  return health?.status === 'healthy';
}

/**
 * Send email through Railway backend
 * Uses the Vercel proxy endpoint to forward to Railway
 */
export async function sendEmailViaRailway(
  request: RailwayEmailRequest
): Promise<RailwayEmailResponse> {
  try {
    // Use the proxy endpoint (works on Vercel)
    const response = await fetch('/api/railway/outreach/send-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // Include cookies for auth
      body: JSON.stringify(request),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || `Railway request failed: ${response.status}`,
      };
    }

    return {
      success: true,
      messageId: data.messageId,
      queuedForProcessing: data.queued,
    };
  } catch (error) {
    console.error('Railway email send error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Generate AI content through Railway backend
 */
export async function generateAIContent(
  recipientName: string,
  companyName: string,
  channel: 'email' | 'linkedin' | 'phone',
  context?: string
): Promise<{ success: boolean; content?: { subject?: string; body: string }; error?: string }> {
  try {
    const response = await fetch('/api/railway/ai/content/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        recipientName,
        companyName,
        channel,
        context,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || 'Content generation failed',
      };
    }

    return {
      success: true,
      content: data.content,
    };
  } catch (error) {
    console.error('AI content generation error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Enrich email address through Railway's enrichment service
 */
export async function enrichEmailViaRailway(
  personId: string
): Promise<{ success: boolean; email?: string; confidence?: number; error?: string }> {
  try {
    const response = await fetch('/api/railway/enrichment/smart-guess', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ personId }),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || 'Enrichment failed',
      };
    }

    return {
      success: true,
      email: data.email,
      confidence: data.confidence,
    };
  } catch (error) {
    console.error('Email enrichment error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get Railway platform info
 */
export function getRailwayInfo() {
  return {
    url: RAILWAY_API_URL,
    isConfigured: Boolean(RAILWAY_API_URL),
    features: [
      'Postgres Database',
      'Redis Job Queues',
      'SendGrid Email',
      'Email Tracking',
      'Sequence Automation',
      'AI Content Generation',
    ],
  };
}
