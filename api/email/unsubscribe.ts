import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminDb } from '../../lib/firebaseAdmin';
import { EmailComplianceService } from '../../src/services/EmailComplianceService';
import { EmailQueueService } from '../../src/services/EmailQueueService';
import { EmailWarmupService } from '../../src/services/EmailWarmupService';
import { EmailTrackingService } from '../../src/services/EmailTrackingService';
import { SendGridClient } from '../../src/services/SendGridClient';

const db = getAdminDb();
const sendGrid = new SendGridClient();
const compliance = new EmailComplianceService(db, sendGrid);
const warmup = new EmailWarmupService(db);
const tracking = new EmailTrackingService(db);
const queue = new EmailQueueService(db, sendGrid, compliance, warmup, tracking, 'api-unsubscribe');

// CSRF validation for unsubscribe
// Note: POST from List-Unsubscribe header may not have Origin, so we validate token signature instead
const ALLOWED_ORIGINS = [
  'https://gtm-yard-flow.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
];

function validateOriginOrListUnsubscribe(req: VercelRequest): boolean {
  const origin = req.headers.origin;
  
  // If valid origin, allow
  if (origin && ALLOWED_ORIGINS.some(allowed => origin.startsWith(allowed))) {
    return true;
  }
  
  // List-Unsubscribe One-Click requests may not have Origin
  // The HMAC token signature provides authentication instead
  if (req.method === 'POST' && req.body && bodyIncludesOneClick(req)) {
    return true;
  }
  
  // GET requests for landing page allowed (token validates user)
  if (req.method === 'GET') {
    return true;
  }
  
  return false;
}

function bodyIncludesOneClick(req: VercelRequest): boolean {
  if (typeof req.body === 'string') {
    return req.body.includes('List-Unsubscribe=One-Click');
  }
  if (req.body && typeof req.body === 'object') {
    return Object.values(req.body).some(val => typeof val === 'string' && val.includes('List-Unsubscribe=One-Click'));
  }
  return false;
}

async function resolveEmailAddress(emailId: string): Promise<string | null> {
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

  if (!bodyIncludesOneClick(req)) {
    res.status(400).json({ error: 'Missing List-Unsubscribe confirmation' });
    return;
  }

  const email = await resolveEmailAddress(validation.emailId);
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
