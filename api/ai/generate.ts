import type { VercelRequest, VercelResponse } from '@vercel/node';
import { logger } from '../../lib/logger';

/**
 * AI Content Generation Proxy
 * 
 * Sprint 27: F2 - Server-side proxy for AI content generation
 * 
 * This route:
 * 1. Keeps Railway API secret secure (not exposed in browser)
 * 2. Forwards request to Railway /api/ai/content/generate
 * 3. Returns generated subject + body content
 * 
 * Client sends: { tone, prospectName, companyName, title, goal }
 * Server adds: x-service-key header and forwards to Railway
 */

const RAILWAY_API_URL = process.env.RAILWAY_API_URL || 
  'https://yardflow-hitlist-production-2f41.up.railway.app';
const RAILWAY_API_SECRET = process.env.RAILWAY_API_SECRET || 
  process.env.CRON_SECRET || 
  process.env.SERVICE_TO_SERVICE_SECRET;

export interface GenerateRequest {
  tone: 'luis' | 'professional' | 'challenger';
  prospectName: string;
  companyName: string;
  title?: string;
  goal?: string;
}

export interface GenerateResponse {
  success: boolean;
  content?: string;
  subject?: string;
  error?: string;
  /** Which AI provider generated the content (T0.1) */
  provider?: 'gemini' | 'openai';
  /** Token usage for monitoring */
  usage?: {
    promptTokens: number;
    completionTokens: number;
  };
  /** Rate limit info (T0.2) */
  rateLimit?: {
    retryAfterSeconds?: number;
    fallbackUsed?: 'gemini' | 'openai';
  };
}

export default async function handler(
  req: VercelRequest, 
  res: VercelResponse
): Promise<void> {
  // Only POST allowed
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method not allowed' });
    return;
  }

  // Check auth (require Firebase token for user identification)
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: 'Authentication required' });
    return;
  }

  // Check Railway secret is configured
  if (!RAILWAY_API_SECRET) {
    logger.error('[AI Generate] RAILWAY_API_SECRET not configured');
    res.status(503).json({ 
      success: false, 
      error: 'AI service not configured',
      message: 'Server-to-server authentication not configured.'
    });
    return;
  }

  try {
    const body = req.body as GenerateRequest;

    // Validate required fields
    if (!body.tone || !body.prospectName || !body.companyName) {
      res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: tone, prospectName, companyName' 
      });
      return;
    }

    // Validate tone
    if (!['luis', 'professional', 'challenger'].includes(body.tone)) {
      res.status(400).json({ 
        success: false, 
        error: 'Invalid tone. Must be: luis, professional, or challenger' 
      });
      return;
    }

    logger.info('[AI Generate] Forwarding to Railway', { 
      tone: body.tone, 
      company: body.companyName 
    });

    // Forward to Railway backend
    const railwayResponse = await fetch(
      `${RAILWAY_API_URL}/api/ai/content/generate`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-service-key': RAILWAY_API_SECRET,
        },
        body: JSON.stringify({
          type: 'email',
          tone: body.tone,
          goal: body.goal || 'Schedule a meeting to discuss yard operations',
          context: {
            prospectName: body.prospectName,
            companyName: body.companyName,
            title: body.title || '',
          },
        }),
      }
    );

    const data = await railwayResponse.json();

    // Handle Railway errors
    if (!railwayResponse.ok) {
      const status = railwayResponse.status;
      
      // Classify error for client
      if (status === 401 || status === 403) {
        logger.error('[AI Generate] Railway auth failed', undefined, { status });
        res.status(503).json({ 
          success: false, 
          error: 'AI service authentication failed' 
        });
        return;
      }
      
      if (status === 429) {
        const retryAfter = railwayResponse.headers.get('Retry-After');
        logger.warn('[AI Generate] Railway rate limited', { retryAfter });
        res.status(429).json({ 
          success: false, 
          error: 'rate_limited',
          rateLimit: {
            retryAfterSeconds: retryAfter ? parseInt(retryAfter, 10) : 60,
          }
        });
        return;
      }
      
      if (status === 400) {
        res.status(400).json({ 
          success: false, 
          error: data.error || 'Invalid request to AI service' 
        });
        return;
      }

      // Generic server error
      logger.error('[AI Generate] Railway error', undefined, { status, data });
      res.status(502).json({ 
        success: false, 
        error: 'AI service temporarily unavailable' 
      });
      return;
    }

    // Success - return generated content
    logger.info('[AI Generate] Success', { 
      tone: body.tone,
      contentLength: data.content?.length,
      provider: data.provider,
    });

    res.status(200).json({
      success: true,
      content: data.content,
      subject: data.subject,
      provider: data.provider,
      usage: data.usage,
      rateLimit: data.fallbackUsed ? {
        fallbackUsed: data.fallbackUsed,
      } : undefined,
    });

  } catch (error) {
    // Network/timeout errors
    if (error instanceof Error && error.name === 'AbortError') {
      logger.error('[AI Generate] Railway timeout');
      res.status(504).json({ 
        success: false, 
        error: 'AI service timed out. Please try again.' 
      });
      return;
    }

    logger.error('[AI Generate] Error:', error instanceof Error ? error : undefined);
    res.status(500).json({ 
      success: false,
      error: 'Failed to generate content. Please try again.'
    });
  }
}
