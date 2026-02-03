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

// Railway URL for webhook forwarding
const RAILWAY_URL = process.env.RAILWAY_API_URL || 'https://api.railway.internal';

/**
 * T96.1/T96.5: Forward webhook events to Railway with retry logic
 */
async function forwardToRailway(
  events: SendGridWebhookEvent[], 
  signature: string, 
  maxRetries = 3
): Promise<{ success: boolean; error?: string }> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(`${RAILWAY_URL}/api/webhooks/sendgrid`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Original-Signature': signature,
        },
        body: JSON.stringify(events),
        signal: AbortSignal.timeout(5000),
      });
      
      if (response.ok) return { success: true };
      
      // Don't retry on 4xx (client error)
      if (response.status >= 400 && response.status < 500) {
        return { success: false, error: `Client error: ${response.status}` };
      }
    } catch (error) {
      console.log(`Webhook forward attempt ${attempt} failed:`, error);
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 1000 * attempt)); // Exponential backoff
      }
    }
  }
  
  // All retries failed - log for manual review
  console.error('Webhook forwarding failed after retries');
  return { success: false, error: 'Max retries exceeded' };
}

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

/**
 * Sprint 82.1/82.2: Pause sequence enrollments based on event type
 * Finds the enrollment associated with this email and pauses it
 */
async function pauseEnrollmentByEmail(
  emailId: string, 
  prospectEmail: string, 
  reason: 'reply' | 'bounce' | 'unsubscribe' | 'spam',
  newStatus: 'paused' | 'replied' | 'bounced' | 'unsubscribed' = 'paused'
): Promise<void> {
  try {
    // Try to find enrollment by email ID (from queue item metadata)
    let enrollmentId: string | null = null;
    
    if (emailId) {
      // Look up the queue item to get enrollment ID
      const queueDoc = await db.collection('email_queue').doc(emailId).get();
      if (queueDoc.exists) {
        enrollmentId = queueDoc.data()?.enrollmentId;
      }
    }
    
    // If we have enrollmentId, pause that specific enrollment
    if (enrollmentId) {
      const enrollmentRef = db.collection('sequenceEnrollments').doc(enrollmentId);
      const enrollmentDoc = await enrollmentRef.get();
      
      if (enrollmentDoc.exists && enrollmentDoc.data()?.status === 'active') {
        await enrollmentRef.update({
          status: newStatus,
          pausedAt: new Date().toISOString(),
          pauseReason: reason,
          nextSendAt: null,
        });
        console.log(`Paused enrollment ${enrollmentId} due to ${reason}`);
      }
      return;
    }
    
    // Fallback: Find active enrollment by prospect email
    if (prospectEmail) {
      const enrollmentsSnap = await db
        .collection('sequenceEnrollments')
        .where('prospectEmail', '==', prospectEmail)
        .where('status', '==', 'active')
        .limit(1)
        .get();
      
      if (!enrollmentsSnap.empty) {
        const doc = enrollmentsSnap.docs[0];
        await doc.ref.update({
          status: newStatus,
          pausedAt: new Date().toISOString(),
          pauseReason: reason,
          nextSendAt: null,
        });
        console.log(`Paused enrollment ${doc.id} for ${prospectEmail} due to ${reason}`);
      }
    }
  } catch (err) {
    console.error(`Failed to pause enrollment for ${reason}:`, err);
  }
}

async function processEvent(event: SendGridWebhookEvent): Promise<void> {
  const emailId = event.custom_args?.emailId || event.sg_message_id || '';
  const prospectEmail = event.email || '';
  
  // T96.4: Skip Firestore email_events writes when Railway is handling events
  // Railway now stores these events centrally - this is fallback only
  const useFirestoreEvents = process.env.USE_FIRESTORE_EMAIL_EVENTS === 'true';
  
  switch (event.event) {
    case 'delivered':
      await markQueueStatus(emailId, 'sent');
      break;
    case 'open':
    case 'click':
      // T96.4: Only write to Firestore if Railway is not primary
      if (useFirestoreEvents) {
        await db.collection('email_events').doc(`${event.event}:${emailId}:${event.sg_event_id || event.timestamp}`).set({
          type: event.event,
          emailId,
          at: event.timestamp * 1000,
          url: event.url,
        }, { merge: true });
      }
      break;
    case 'bounce': {
      const classifiedBounce = compliance.classifyBounce(event);
      const bounceType = classifiedBounce === 'unknown' ? undefined : classifiedBounce;
      await compliance.addToSuppressionList({
        email: prospectEmail,
        reason: 'bounce',
        bounceType,
        createdAt: Date.now(),
        source: 'webhook',
        metadata: { status: event.status, sg_event_id: event.sg_event_id },
      });
      await markQueueStatus(emailId, 'failed', event.reason);
      
      // Sprint 82.2: Pause enrollment on bounce
      if (bounceType === 'hard') {
        await pauseEnrollmentByEmail(emailId, prospectEmail, 'bounce', 'bounced');
      } else {
        // Soft bounce - just pause, will resume later
        await pauseEnrollmentByEmail(emailId, prospectEmail, 'bounce', 'paused');
      }
      break;
    }
    case 'spamreport':
      await compliance.addToSuppressionList({
        email: prospectEmail,
        reason: 'spam',
        createdAt: Date.now(),
        source: 'webhook',
      });
      await markQueueStatus(emailId, 'canceled', 'spam');
      // Sprint 82.3: Cancel enrollment on spam report
      await pauseEnrollmentByEmail(emailId, prospectEmail, 'spam', 'unsubscribed');
      break;
    case 'unsubscribe':
      await compliance.addToSuppressionList({
        email: prospectEmail,
        reason: 'unsubscribe',
        createdAt: Date.now(),
        source: 'webhook',
      });
      await markQueueStatus(emailId, 'canceled', 'unsubscribe');
      // Sprint 82.3: Cancel enrollment on unsubscribe
      await pauseEnrollmentByEmail(emailId, prospectEmail, 'unsubscribe', 'unsubscribed');
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
    
    // T96.1: Forward to Railway for centralized processing
    const forwardResult = await forwardToRailway(events, signature);
    if (!forwardResult.success) {
      console.warn('Railway forwarding failed:', forwardResult.error);
      // Continue processing locally as fallback
    }
    
    // Process locally for backwards compatibility (will be removed after full migration)
    for (const event of events) {
      await processEvent(event);
    }
    res.status(200).json({ received: events.length, forwarded: forwardResult.success });
  } catch (err) {
    res.status(500).json({ error: 'Failed to process webhook', detail: (err as Error).message });
  }
}
