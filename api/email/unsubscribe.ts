import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminDb } from '../../lib/firebaseAdmin';
import { validateRequestOrigin, isListUnsubscribeOneClick } from '../../lib/validateOrigin';
import { EmailComplianceService } from '../../src/services/EmailComplianceService';
import { EmailQueueService } from '../../src/services/EmailQueueService';
import { EmailWarmupService } from '../../src/services/EmailWarmupService';
import { EmailTrackingService } from '../../src/services/EmailTrackingService';
import { SendGridClient } from '../../src/services/SendGridClient';

// Lazy-loaded services to prevent crashes on missing env vars
let _services: {
  db: ReturnType<typeof getAdminDb>;
  compliance: EmailComplianceService;
  queue: EmailQueueService;
} | null = null;

function getServices() {
  if (!_services) {
    const db = getAdminDb();
    const sendGrid = new SendGridClient();
    const compliance = new EmailComplianceService(db, sendGrid);
    const warmup = new EmailWarmupService(db);
    const tracking = new EmailTrackingService(db);
    const queue = new EmailQueueService(db, sendGrid, compliance, warmup, tracking, 'api-unsubscribe');
    _services = { db, compliance, queue };
  }
  return _services;
}

// CSRF validation for unsubscribe
// Uses shared validateRequestOrigin with List-Unsubscribe One-Click support
function validateOriginOrListUnsubscribe(req: VercelRequest): boolean {
  return validateRequestOrigin(req, {
    allowGetWithoutOrigin: true, // GET requests for landing page allowed (token validates user)
    customValidator: isListUnsubscribeOneClick, // List-Unsubscribe One-Click POST without origin
  });
}

async function resolveEmailAddress(db: ReturnType<typeof getAdminDb>, emailId: string): Promise<string | null> {
  const snap = await db.collection('email_queue').doc(emailId).get();
  const data = snap.data() as { message?: { to?: string } } | undefined;
  return data?.message?.to || null;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  // CSRF Protection
  if (!validateOriginOrListUnsubscribe(req)) {
    res.status(403).json({ error: 'Invalid origin' });
    return;
  }

  // Initialize services lazily
  let services: ReturnType<typeof getServices>;
  try {
    services = getServices();
  } catch (err) {
    res.status(503).json({ error: 'Service unavailable', detail: (err as Error).message });
    return;
  }
  
  const { db, compliance, queue } = services;

  const token = (req.query.token as string | undefined) || (req.body?.token as string | undefined);
  if (!token) {
    res.status(400).json({ error: 'Missing token' });
    return;
  }

  const validation = compliance.validateUnsubscribeToken(token);
  if (!validation.valid || !validation.emailId) {
    res.status(400).json({ error: 'Invalid or expired token', reason: validation.reason });
    return;
  }

  if (req.method === 'GET') {
    res.setHeader('Content-Type', 'text/html');
    res.status(200).send(`<html><body><h3>Unsubscribe</h3><p>Click confirm to unsubscribe from future emails.</p></body></html>`);
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!isListUnsubscribeOneClick(req)) {
    res.status(400).json({ error: 'Missing List-Unsubscribe confirmation' });
    return;
  }

  const email = await resolveEmailAddress(db, validation.emailId);
  if (!email) {
    res.status(404).json({ error: 'Email not found' });
    return;
  }

  await compliance.addToSuppressionList({
    email,
    reason: 'unsubscribe',
    createdAt: Date.now(),
    source: 'one-click',
  });

  await queue.cancelPendingByEmailId(validation.emailId);

  res.status(200).json({ success: true });
}
