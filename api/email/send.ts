import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import DOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';
import { getAdminAuth, getAdminDb } from '../../lib/firebaseAdmin';
import { validateRequestOrigin } from '../../lib/validateOrigin';
import { createLogger } from '../../lib/logger';

const log = createLogger('email-send');

// Server-side DOMPurify setup (requires JSDOM window)
const window = new JSDOM('').window;
const purify = DOMPurify(window as unknown as Window);

// Configure DOMPurify with safe allowlist for emails
const PURIFY_CONFIG = {
  ALLOWED_TAGS: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'a', 'ul', 'ol', 'li', 'div', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'table', 'tr', 'td', 'th', 'thead', 'tbody', 'img', 'blockquote', 'pre', 'code', 'hr'],
  ALLOWED_ATTR: ['href', 'src', 'alt', 'style', 'class', 'id', 'target', 'width', 'height', 'align', 'valign', 'border', 'cellpadding', 'cellspacing'],
  ALLOW_DATA_ATTR: false,
  // Prevent javascript: URLs
  ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
};
import { EmailQueueService } from '../../src/services/EmailQueueService';
import { EmailComplianceService } from '../../src/services/EmailComplianceService';
import { EmailWarmupService } from '../../src/services/EmailWarmupService';
import { EmailTrackingService } from '../../src/services/EmailTrackingService';
import { SendGridClient } from '../../src/services/SendGridClient';
import { spamScoreService } from '../../src/services/SpamScoreService';
import type { EmailMessage } from '../../src/types/email';
import { withSentry } from '../../lib/sentry-server';
import { getRequestId } from '../../lib/request-id';
import { applyRateLimitToRequest } from '../../lib/rateLimiter';

// Spam score threshold — emails scoring above this are blocked server-side
const SPAM_SCORE_THRESHOLD = Number(process.env.SPAM_SCORE_THRESHOLD) || 70;

// Zod schema for email message validation
const EmailMessageSchema = z.object({
  id: z.string().optional(),
  to: z.string().email('Invalid email address'),
  toName: z.string().optional(),
  subject: z.string().min(1, 'Subject is required').max(998, 'Subject too long'),
  html: z.string().optional(),
  text: z.string().min(1, 'Message body is required'),
  from: z.string().email().optional(), // Optional, falls back to env var
  scheduledAt: z.number().optional(),
  metadata: z.object({
    prospectId: z.string().optional(),
    prospectName: z.string().optional(),
    source: z.string().optional(),
    tenantId: z.string().optional(),
  }).optional(),
});

// Lazy-loaded services to prevent crashes on module import if env vars are missing
let _db: ReturnType<typeof getAdminDb> | null = null;
let _auth: ReturnType<typeof getAdminAuth> | null = null;
let _queue: EmailQueueService | null = null;
let _compliance: EmailComplianceService | null = null;

function getServices() {
  if (!_db) _db = getAdminDb();
  if (!_auth) _auth = getAdminAuth();
  
  if (!_queue) {
    const sendGrid = new SendGridClient();
    _compliance = new EmailComplianceService(_db, sendGrid);
    const warmup = new EmailWarmupService(_db);
    const tracking = new EmailTrackingService(_db);
    _queue = new EmailQueueService(_db, sendGrid, _compliance, warmup, tracking, 'api-send');
  }
  
  return { db: _db, auth: _auth, queue: _queue, compliance: _compliance! };
}

const RATE_LIMIT = 100;
const WINDOW_MS = 60 * 1000;

// CSRF Protection: Use shared origin validation
function validateOrigin(req: VercelRequest): boolean {
  return validateRequestOrigin(req, {
    allowDevWithoutOrigin: true,
    checkRefererInDev: true,
    allowGetWithoutOrigin: false,
  });
}

async function enforceRateLimit(db: ReturnType<typeof getAdminDb>, userId: string): Promise<void> {
  const ref = db.collection('email_rate_limits').doc(userId);
  await db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    const data = snap.data() as { count?: number; windowStart?: number } | undefined;
    const now = Date.now();
    const windowStart = data?.windowStart && data.windowStart > now - WINDOW_MS ? data.windowStart : now;
    const count = windowStart === data?.windowStart ? data?.count ?? 0 : 0;
    if (count >= RATE_LIMIT) {
      throw new Error('RATE_LIMITED');
    }
    tx.set(ref, { count: count + 1, windowStart, updatedAt: now }, { merge: true });
  });
}

function parseMessage(req: VercelRequest): EmailMessage {
  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  // Validate with Zod schema
  const result = EmailMessageSchema.safeParse(body);
  if (!result.success) {
    // Use flatten() for simpler error handling that avoids $ZodIssue type issues
    const formatted = result.error.flatten();
    const fieldErrors = Object.entries(formatted.fieldErrors)
      .map(([field, msgs]) => `${field}: ${(msgs as string[]).join(', ')}`)
      .join('; ');
    throw new Error(`Validation failed: ${fieldErrors || 'Invalid input'}`);
  }
  
  const message = result.data as EmailMessage;
  
  // SECURITY: Sanitize HTML content to prevent XSS
  if (message.html) {
    message.html = purify.sanitize(message.html, PURIFY_CONFIG);
  }
  
  return message;
}

async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const allowed = await applyRateLimitToRequest(req, res);
  if (!allowed) return;

  const requestId = getRequestId(req);
  const requestLog = log.withRequestId(requestId);

  // CSRF Protection
  if (!validateOrigin(req)) {
    res.status(403).json({ error: 'Invalid origin' });
    return;
  }

  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : undefined;
  if (!token) {
    res.status(401).json({ error: 'Missing authorization token' });
    return;
  }

  // Initialize services lazily (prevents crashes on missing env vars at import time)
  let services: ReturnType<typeof getServices>;
  try {
    services = getServices();
  } catch (err) {
    const errorDetails = {
      message: (err as Error).message,
      name: (err as Error).name,
      hasFirebaseKey: !!process.env.FIREBASE_SERVICE_ACCOUNT_KEY,
      hasFirebaseProject: !!process.env.FIREBASE_PROJECT_ID,
      hasSendGridKey: !!process.env.SENDGRID_API_KEY,
    };
    requestLog.error('Failed to initialize email services', err as Error, errorDetails);
    res.status(503).json({ 
      error: 'Email service unavailable', 
      detail: (err as Error).message,
      diagnostic: errorDetails,
    });
    return;
  }

  const { db, auth, queue, compliance } = services;

  let userId: string;
  try {
    const decoded = await auth.verifyIdToken(token);
    userId = decoded.uid;
  } catch {
    res.status(401).json({ error: 'Invalid token' });
    return;
  }

  const userLog = requestLog.withUser(userId);

  try {
    await enforceRateLimit(db, userId);
  } catch (err) {
    const message = (err as Error).message;
    if (message === 'RATE_LIMITED') {
      userLog.warn('Rate limit exceeded');
      res.status(429).json({ error: 'Rate limit exceeded' });
      return;
    }
    userLog.error('Rate limit check failed', err as Error);
    res.status(500).json({ error: 'Rate limit check failed' });
    return;
  }

  let message: EmailMessage;
  try {
    message = parseMessage(req);
  } catch (err) {
    userLog.warn('Invalid payload', { detail: (err as Error).message });
    res.status(400).json({ error: 'Invalid payload', detail: (err as Error).message });
    return;
  }

  const validation = await compliance.validateEmail(message.to);
  if (!validation.valid) {
    const status = validation.reason === 'suppressed' ? 422 : 400;
    userLog.warn('Email blocked by compliance', { to: message.to, reason: validation.reason });
    res.status(status).json({ error: 'Email blocked', reason: validation.reason, requestId });
    return;
  }

  // Note: CAN-SPAM compliance elements (List-Unsubscribe headers, postal address) are
  // automatically injected by EmailQueueService.processQueue() via injectComplianceElements().
  // We don't block here since the queue handles injection before sending.

  // T39C.5: Block high-spam content server-side
  const spamResult = spamScoreService.analyze({
    subject: message.subject,
    body: message.text || message.html || '',
    isHtml: Boolean(message.html),
  });
  if (spamResult.score > SPAM_SCORE_THRESHOLD) {
    userLog.warn('Email blocked by spam score', {
      score: spamResult.score,
      level: spamResult.level,
      issues: spamResult.issues.map(i => i.description),
    });
    res.status(422).json({
      error: 'Email blocked — content flagged as high spam risk',
      score: spamResult.score,
      level: spamResult.level,
      issues: spamResult.issues.map(i => ({ message: i.description, severity: i.severity })),
      suggestions: spamResult.suggestions,
      requestId,
    });
    return;
  }

  // Allow bypassing warmup limits in development or with explicit env var
  const bypassWarmup = process.env.BYPASS_EMAIL_WARMUP === 'true' || process.env.VERCEL_ENV === 'development';
  
  if (!bypassWarmup) {
    // Get warmup service from queue internals or create fresh
    const warmup = new EmailWarmupService(db);
    const warmupCheck = await warmup.canSend(message.metadata?.tenantId, 1);
    if (!warmupCheck.allowed) {
      userLog.warn('Warmup limit hit', { reason: warmupCheck.reason, remaining: warmupCheck.remaining });
      res.status(429).json({ 
        error: 'Daily email limit reached', 
        reason: warmupCheck.reason, 
        remaining: warmupCheck.remaining,
        message: warmupCheck.reason === 'warmup_limit' 
          ? 'New accounts start with 20 emails/day. Set BYPASS_EMAIL_WARMUP=true in Vercel to override.'
          : 'Email sending is paused due to deliverability concerns.'
      });
      return;
    }
  }

  try {
    const item = await queue.enqueue(message, {
      userId,
      idempotencyKey: (req.headers['x-idempotency-key'] as string | undefined) || undefined,
      scheduledAt: message.scheduledAt,
    });
    userLog.info('Email enqueued successfully', { emailId: item.id, to: message.to });
    res.status(202).json({ id: item.id, status: item.status, requestId });
  } catch (err) {
    const errorDetail = err instanceof Error ? err.message : String(err);
    const errorStack = err instanceof Error ? err.stack : undefined;
    userLog.error('Failed to enqueue email', err as Error, { to: message.to, errorDetail, errorStack });
    res.status(500).json({ 
      error: 'Failed to enqueue', 
      detail: errorDetail, 
      requestId,
      // Include stack in non-production for debugging
      ...(process.env.VERCEL_ENV !== 'production' && errorStack ? { stack: errorStack.split('\n').slice(0, 5) } : {}),
    });
  }
}

export default withSentry(handler);
