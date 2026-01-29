import type { VercelRequest, VercelResponse } from '@vercel/node';
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

const db = getAdminDb();
const auth = getAdminAuth();
const sendGrid = new SendGridClient();
const compliance = new EmailComplianceService(db, sendGrid);
const warmup = new EmailWarmupService(db);
const tracking = new EmailTrackingService(db);
const queue = new EmailQueueService(db, sendGrid, compliance, warmup, tracking, 'api-send');

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

async function enforceRateLimit(userId: string): Promise<void> {
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
  return body as EmailMessage;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

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

  let userId: string;
  try {
    const decoded = await auth.verifyIdToken(token);
    userId = decoded.uid;
  } catch {
    res.status(401).json({ error: 'Invalid token' });
    return;
  }

  const userLog = log.withUser(userId);

  try {
    await enforceRateLimit(userId);
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
  } catch {
    res.status(400).json({ error: 'Invalid payload' });
    return;
  }

  const validation = await compliance.validateEmail(message.to);
  if (!validation.valid) {
    res.status(400).json({ error: 'Email invalid', reason: validation.reason });
    return;
  }

  const warmupCheck = await warmup.canSend(message.metadata?.tenantId, 1);
  if (!warmupCheck.allowed) {
    res.status(429).json({ error: 'Warmup limit', reason: warmupCheck.reason, remaining: warmupCheck.remaining });
    return;
  }

  try {
    const item = await queue.enqueue(message, {
      userId,
      idempotencyKey: (req.headers['x-idempotency-key'] as string | undefined) || undefined,
      scheduledAt: message.scheduledAt,
    });
    userLog.info('Email enqueued successfully', { emailId: item.id, to: message.to });
    res.status(202).json({ id: item.id, status: item.status });
  } catch (err) {
    userLog.error('Failed to enqueue email', err as Error, { to: message.to });
    res.status(500).json({ error: 'Failed to enqueue', detail: (err as Error).message });
  }
}
