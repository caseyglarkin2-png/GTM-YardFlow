import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { getAdminAuth, getAdminDb } from '../../lib/firebaseAdmin';
import { validateRequestOrigin } from '../../lib/validateOrigin';
import { createLogger } from '../../lib/logger';

const log = createLogger('email-send');
import { EmailQueueService } from '../../src/services/EmailQueueService';
import { EmailComplianceService } from '../../src/services/EmailComplianceService';
import { EmailWarmupService } from '../../src/services/EmailWarmupService';
import { EmailTrackingService } from '../../src/services/EmailTrackingService';
import { SendGridClient } from '../../src/services/SendGridClient';
import type { EmailMessage } from '../../src/types/email';
import { withSentry } from '../../lib/sentry-server';
import { getRequestId } from '../../lib/request-id';
import { applyRateLimitToRequest } from '../../lib/rateLimiter';

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
    const errors = result.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
    throw new Error(`Validation failed: ${errors}`);
  }
  return result.data as EmailMessage;
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
    requestLog.error('Failed to initialize email services', err as Error);
    res.status(503).json({ error: 'Email service unavailable', detail: (err as Error).message });
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
    userLog.error('Failed to enqueue email', err as Error, { to: message.to });
    res.status(500).json({ error: 'Failed to enqueue', detail: (err as Error).message, requestId });
  }
}

export default withSentry(handler);
