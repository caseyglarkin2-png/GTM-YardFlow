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
 * 
 * IMPORTANT: All requests go through the Vercel proxy at /api/railway/*
 * This ensures proper request handling and security.
 * 
 * NOTE (Sprint 101): Railway email requires NextAuth session, not Firebase tokens.
 * Until auth bridge is complete, we use feature flags to route to Vercel instead.
 */

import { shouldUseRailwayEmail } from '../config/featureFlags';

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
 * P0 Fix: Uses proxy endpoint instead of direct Railway URL
 */
export async function checkRailwayHealth(): Promise<RailwayHealthResponse | null> {
  try {
    // Use the proxy endpoint for consistency and security
    const response = await fetch('/api/railway/health');
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
 * Check if Railway backend is available for email operations
 * 
 * Sprint 101 Fix: Check feature flags FIRST before checking health.
 * Railway is healthy but requires NextAuth session (not Firebase tokens).
 * Until auth bridge is complete, route emails through Vercel instead.
 */
export async function isRailwayAvailable(): Promise<boolean> {
  // Check feature flag system - requires RAILWAY_ENABLED AND RAILWAY_EMAIL_ENABLED
  if (!shouldUseRailwayEmail()) {
    // Import to get the actual flag values for diagnostic logging
    const { featureFlags } = await import('../config/featureFlags');
    console.log('[Email] Railway email disabled:', {
      RAILWAY_ENABLED: featureFlags.RAILWAY_ENABLED,
      RAILWAY_EMAIL_ENABLED: featureFlags.RAILWAY_EMAIL_ENABLED,
      reason: !featureFlags.RAILWAY_ENABLED 
        ? 'VITE_RAILWAY_ENABLED=false' 
        : 'VITE_RAILWAY_EMAIL_ENABLED=false',
      action: 'Using Vercel SendGrid path',
    });
    return false;
  }
  
  // Feature flags say Railway is enabled - check health
  console.log('[Email] Railway enabled via feature flags, checking health...');
  const health = await checkRailwayHealth();
  
  if (health?.status === 'healthy') {
    console.log('[Email] Railway health check passed, using Railway path');
    return true;
  }
  
  console.warn('[Email] Railway health check failed, falling back to Vercel');
  return false;
}

/**
 * Send email through Railway backend using the correct two-step flow:
 * 1. Create outreach record with email content (POST /api/outreach)
 * 2. Trigger send with outreachId (POST /api/outreach/send-email)
 * 
 * Uses the Vercel proxy endpoint to forward to Railway.
 */
export async function sendEmailViaRailway(
  request: RailwayEmailRequest
): Promise<RailwayEmailResponse> {
  try {
    console.log('[Railway Email] Creating outreach record...', {
      to: request.to,
      subject: request.subject,
      prospectId: request.prospectId,
    });

    // Step 1: Create outreach record with email content
    const createResponse = await fetch('/api/railway/outreach', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        personId: request.prospectId, // Railway uses personId
        subject: request.subject,
        body: request.htmlBody,       // HTML goes in body field
        textBody: request.textBody,   // Plain text fallback
        channel: 'email',
        metadata: {
          recipientEmail: request.to,
          recipientName: request.toName,
          source: 'gtm-yardflow',
        },
      }),
    });

    const createData = await createResponse.json();

    if (!createResponse.ok) {
      console.error('[Railway Email] Failed to create outreach record:', createData);
      return {
        success: false,
        error: createData.error || `Failed to create outreach: ${createResponse.status}`,
      };
    }

    const outreachId = createData.id;
    console.log('[Railway Email] Outreach record created:', outreachId);

    // Step 2: Trigger send with outreachId
    const sendResponse = await fetch('/api/railway/outreach/send-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        outreachId: outreachId,
        force: false,
      }),
    });

    const sendData = await sendResponse.json();

    if (!sendResponse.ok) {
      console.error('[Railway Email] Failed to send email:', sendData);
      return {
        success: false,
        error: sendData.error || `Failed to send: ${sendResponse.status}`,
      };
    }

    console.log('[Railway Email] Email queued successfully:', sendData);
    return {
      success: true,
      messageId: sendData.id || outreachId,
      queuedForProcessing: sendData.status === 'queued',
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
 * Note: The actual URL is handled by the proxy at /api/railway/*
 */
export function getRailwayInfo() {
  return {
    proxyEndpoint: '/api/railway',
    isConfigured: true, // Always true when using proxy
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
