import type { VercelRequest, VercelResponse } from '@vercel/node';
import { EventWebhook } from '@sendgrid/eventwebhook';
import { getAdminDb } from '../../lib/firebaseAdmin';
import { EmailComplianceService } from '../../src/services/EmailComplianceService';
import { SendGridClient } from '../../src/services/SendGridClient';
import type { SendGridWebhookEvent } from '../../src/types/email';

const db = getAdminDb();
const sendGrid = new SendGridClient();
const compliance = new EmailComplianceService(db, sendGrid);
const webhook = new EventWebhook();
const MAX_AGE_SECONDS = 5 * 60;

/**
 * Get raw body payload for signature verification.
 * Vercel may parse JSON automatically, so we handle both cases.
 * For proper signature verification, the exact raw body is required.
 */
function getPayload(req: VercelRequest): string {
  // Check for raw body (when using x-vercel-raw-body header in vercel.json)
  if ((req as unknown as { rawBody?: string }).rawBody) {
    return (req as unknown as { rawBody: string }).rawBody;
  }
  // If body is already a string, use it directly
  if (typeof req.body === 'string') {
    return req.body;
  }
  // Fallback: re-stringify parsed body (may cause signature mismatch)
  // This should not happen with proper vercel.json configuration
  return JSON.stringify(req.body ?? '');
}

async function markQueueStatus(emailId: string, status: string, lastError?: string): Promise<void> {
  if (!emailId) return;
  const ref = db.collection('email_queue').doc(emailId);
  await ref.set({ status, lastError, updatedAt: Date.now() }, { merge: true });
}

async function pauseSequences(emailId: string): Promise<void> {
  if (!emailId) return;
  await db.collection('sequence_pauses').doc(emailId).set({ reason: 'bounce', pausedAt: Date.now() }, { merge: true });
}

async function processEvent(event: SendGridWebhookEvent): Promise<void> {
  const emailId = event.custom_args?.emailId || event.sg_message_id || '';
  switch (event.event) {
    case 'delivered':
      await markQueueStatus(emailId, 'sent');
      break;
    case 'open':
    case 'click':
      await db.collection('email_events').doc(`${event.event}:${emailId}:${event.sg_event_id || event.timestamp}`).set({
        type: event.event,
        emailId,
        at: event.timestamp * 1000,
        url: event.url,
      }, { merge: true });
      break;
    case 'bounce': {
      const bounceType = compliance.classifyBounce(event);
      await compliance.addToSuppressionList({
        email: event.email,
        reason: 'bounce',
        bounceType,
        createdAt: Date.now(),
        source: 'webhook',
        metadata: { status: event.status, sg_event_id: event.sg_event_id },
      });
      await markQueueStatus(emailId, 'failed', event.reason);
      if (bounceType === 'hard') {
        await pauseSequences(emailId);
      }
      break;
    }
    case 'spamreport':
    case 'unsubscribe':
      await compliance.addToSuppressionList({
        email: event.email,
        reason: event.event === 'spamreport' ? 'spam' : 'unsubscribe',
        createdAt: Date.now(),
        source: 'webhook',
      });
      await markQueueStatus(emailId, 'canceled', event.event);
      break;
    default:
      break;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const signature = req.headers['x-twilio-email-event-webhook-signature'] as string | undefined;
  const timestamp = req.headers['x-twilio-email-event-webhook-timestamp'] as string | undefined;
  const publicKey = process.env.SENDGRID_WEBHOOK_PUBLIC_KEY;

  if (!signature || !timestamp || !publicKey) {
    res.status(401).json({ error: 'Missing signature headers' });
    return;
  }

  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (Number.isNaN(age) || age > MAX_AGE_SECONDS) {
    res.status(401).json({ error: 'Stale webhook' });
    return;
  }

  const payload = getPayload(req);
  try {
    const key = webhook.convertPublicKeyToECDSA(publicKey);
    const verified = webhook.verifySignature(key, payload, signature, timestamp);
    if (!verified) {
      res.status(401).json({ error: 'Invalid signature' });
      return;
    }
  } catch (err) {
    res.status(401).json({ error: 'Signature verification failed', detail: (err as Error).message });
    return;
  }

  try {
    const events: SendGridWebhookEvent[] = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    if (!Array.isArray(events)) {
      res.status(400).json({ error: 'Invalid events payload' });
      return;
    }
    for (const event of events) {
      await processEvent(event);
    }
    res.status(200).json({ received: events.length });
  } catch (err) {
    res.status(500).json({ error: 'Failed to process webhook', detail: (err as Error).message });
  }
}
