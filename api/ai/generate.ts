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

    logger.info('[AI Generate] Forwarding to Railway /api/ai/chat', { 
      tone: body.tone, 
      company: body.companyName 
    });

    // Build prompt for email generation
    const toneDescriptions: Record<string, string> = {
      luis: 'Conversational, warm, slightly casual. Mention yard chaos and specific pain points.',
      professional: 'Polished, formal, value-focused. Emphasize ROI and efficiency gains.',
      challenger: 'Bold, provocative, pattern-interrupt. Ask a pointed question.',
    };

    const message = `Generate a cold outreach email for a sales prospect.

PROSPECT INFO:
- Name: ${body.prospectName}
- Company: ${body.companyName}
- Title: ${body.title || 'Unknown'}

EMAIL GOAL: ${body.goal || 'Schedule a meeting to discuss yard operations'}

TONE: ${body.tone} - ${toneDescriptions[body.tone]}

REQUIREMENTS:
1. Subject line: 6 words or less, compelling, no spam words
2. Body: 3-4 short paragraphs, personalized, specific to their role
3. CTA: Clear ask for a 15-minute call
4. Sign off: "Best, Luis" 

Respond in this exact JSON format:
{
  "subject": "Your subject line here",
  "content": "Full email body here with line breaks"
}`;

    // Forward to Railway /api/ai/chat endpoint (the working endpoint)
    const railwayResponse = await fetch(
      `${RAILWAY_API_URL}/api/ai/chat`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-service-key': RAILWAY_API_SECRET,
          'Authorization': `Bearer ${RAILWAY_API_SECRET}`,
        },
        body: JSON.stringify({
          message,
          systemPrompt: 'You are an expert sales copywriter specializing in B2B cold outreach for yard management software. Generate compelling, personalized emails that get replies. Always respond with valid JSON.',
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

    // Success - parse Railway response
    // Railway returns: { response: "JSON string", provider, fallbackUsed }
    let generatedContent: { subject?: string; content?: string } = {};
    
    try {
      const responseText = data.response || '';
      // Clean up potential markdown code blocks
      const cleanedResponse = responseText
        .replace(/```json\s*/g, '')
        .replace(/```\s*/g, '')
        .trim();
      
      generatedContent = JSON.parse(cleanedResponse);
    } catch (parseError) {
      // If JSON parsing fails, try to extract from raw text
      logger.warn('[AI Generate] Failed to parse AI response as JSON, using raw text', {
        responsePreview: data.response?.substring(0, 200),
      });
      generatedContent = {
        subject: 'Quick Question',
        content: data.response || 'Failed to generate content',
      };
    }

    logger.info('[AI Generate] Success', { 
      tone: body.tone,
      contentLength: generatedContent.content?.length,
      provider: data.provider,
    });

    res.status(200).json({
      success: true,
      content: generatedContent.content,
      subject: generatedContent.subject,
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
