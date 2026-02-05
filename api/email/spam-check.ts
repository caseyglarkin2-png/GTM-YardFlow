/**
 * /api/email/spam-check
 * 
 * Sprint 39C.2: API endpoint to analyze email content for spam triggers
 * 
 * POST /api/email/spam-check
 * Body: { subject: string, body: string, isHtml?: boolean }
 * Returns: SpamScoreResult
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminAuth } from '../../lib/firebaseAdmin';
import { SpamScoreService, type SpamScoreResult } from '../../src/services/SpamScoreService';

/** Request body schema */
interface SpamCheckRequest {
  subject: string;
  body: string;
  isHtml?: boolean;
}

/** Validate request body */
function validateRequest(body: unknown): { valid: true; data: SpamCheckRequest } | { valid: false; error: string } {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body is required' };
  }

  const data = body as Record<string, unknown>;

  if (typeof data.subject !== 'string') {
    return { valid: false, error: 'subject is required and must be a string' };
  }

  if (typeof data.body !== 'string') {
    return { valid: false, error: 'body is required and must be a string' };
  }

  // Optional isHtml
  if (data.isHtml !== undefined && typeof data.isHtml !== 'boolean') {
    return { valid: false, error: 'isHtml must be a boolean if provided' };
  }

  return {
    valid: true,
    data: {
      subject: data.subject,
      body: data.body,
      isHtml: data.isHtml ?? false,
    },
  };
}

/** Main handler */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  // Only allow POST
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const requestId = crypto.randomUUID().slice(0, 8);

  try {
    // Authenticate user
    const authHeader = req.headers.authorization;
    const s2sKey = req.headers['x-service-key'];
    
    let userId: string | null = null;

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        const adminAuth = getAdminAuth();
        const decoded = await adminAuth.verifyIdToken(token);
        userId = decoded.uid;
      } catch {
        // Token verification failed
        res.status(401).json({ error: 'Invalid token', requestId });
        return;
      }
    } else if (s2sKey === process.env.RAILWAY_API_SECRET || s2sKey === process.env.CRON_SECRET) {
      userId = 'service:gtm-frontend';
    } else {
      res.status(401).json({ error: 'Authentication required', requestId });
      return;
    }

    // Validate request body
    const validation = validateRequest(req.body);
    if (!validation.valid) {
      res.status(400).json({ error: validation.error, requestId });
      return;
    }

    const { subject, body, isHtml } = validation.data;

    // Analyze email content
    const spamService = SpamScoreService.getInstance();
    const result: SpamScoreResult = spamService.analyze({
      subject,
      body,
      isHtml,
    });

    // Return analysis result
    res.status(200).json({
      ...result,
      requestId,
      analyzedAt: new Date().toISOString(),
      userId,
    });

  } catch (error) {
    console.error('[spam-check] Error:', error);
    res.status(500).json({
      error: 'Internal server error',
      requestId,
    });
  }
}
