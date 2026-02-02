import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHmac, timingSafeEqual } from 'crypto';
import { getAdminDb } from '../../lib/firebaseAdmin';
import type { SendGridWebhookEvent } from '../../src/types/email';

const db = getAdminDb();

const EMAIL_EVENTS_COLLECTION = 'email_events';
const SUPPRESSION_COLLECTION = 'email_suppressions';

/**
 * SendGrid Event Webhook
 * 
 * Receives SendGrid webhook events for email tracking:
 * - delivered: Email successfully delivered
 * - open: Recipient opened email
 * - click: Recipient clicked a link
 * - bounce: Email bounced (hard or soft)
 * - spamreport: Recipient marked as spam
 * - unsubscribe: Recipient unsubscribed
 * - dropped: Email was dropped (previous bounce/unsubscribe)
 * - deferred: Email temporarily deferred
 * 
 * @see https://docs.sendgrid.com/for-developers/tracking-events/event
 */
import { SendGridPayloadSchema } from '../../lib/schemas/webhooks';

// ... existing code ...
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // Verify SendGrid signature
  const signatureValid = verifySignature(req);
  if (!signatureValid) {
    console.warn('[SendGrid Webhook] Invalid signature');
    res.status(401).json({ error: 'Invalid signature' });
    return;
  }

  const parseResult = SendGridPayloadSchema.safeParse(req.body);
  if (!parseResult.success) {
    console.warn('[SendGrid Webhook] Invalid payload:', parseResult.error);
    res.status(400).json({ error: 'Invalid payload format', details: parseResult.error });
    return;
  }

  const events = parseResult.data;

  const results = {
    processed: 0,
    errors: 0,
    suppressed: 0,
  };

  for (const event of events) {
    // Cast to any to handle type mismatch between Zod output and internal interface if needed
    // or better yet, prefer Zod's inferred type over the interface
    const typedEvent = event as any; 
    
    try {
      await processEvent(typedEvent);
      results.processed++;

      // Handle suppression events
      if (['bounce', 'spamreport', 'unsubscribe'].includes(event.event)) {
        await addToSuppression(typedEvent);
        results.suppressed++;
      }
    } catch (error) {
      console.error('[SendGrid Webhook] Error processing event:', error);
      results.errors++;
    }
  }

  res.status(200).json(results);
}

async function processEvent(event: SendGridWebhookEvent): Promise<void> {
  const eventId = event.sg_event_id || `${event.event}:${event.email}:${event.timestamp}`;
  
  // Get email ID from custom args if available
  const emailId = event.custom_args?.emailId || event.sg_message_id;
  
  const eventDoc = {
    eventId,
    emailId,
    type: event.event,
    email: event.email,
    timestamp: event.timestamp * 1000, // Convert to milliseconds
    receivedAt: Date.now(),
    
    // Event-specific fields
    ...(event.url && { url: event.url }),
    ...(event.reason && { reason: event.reason }),
    ...(event.type && { bounceType: event.type }),
    ...(event.useragent && { userAgent: event.useragent }),
    ...(event.ip && { ip: event.ip }),
    ...(event.status && { status: event.status }),
    
    // Metadata
    category: Array.isArray(event.category) ? event.category : event.category ? [event.category] : [],
    customArgs: event.custom_args,
    sgMessageId: event.sg_message_id,
    
    // TTL for cleanup (90 days)
    expiresAt: Date.now() + 90 * 24 * 60 * 60 * 1000,
  };

  // Use event ID as document ID for idempotency
  await db.collection(EMAIL_EVENTS_COLLECTION).doc(eventId).set(eventDoc, { merge: true });

  // Update aggregate stats on the email document if we have an emailId
  if (emailId) {
    await updateEmailStats(emailId, event);
  }
}

async function updateEmailStats(emailId: string, event: SendGridWebhookEvent): Promise<void> {
  const statsRef = db.collection('email_stats').doc(emailId);
  
  const updateData: Record<string, unknown> = {
    lastEventAt: Date.now(),
    updatedAt: Date.now(),
  };

  switch (event.event) {
    case 'delivered':
      updateData.deliveredAt = event.timestamp * 1000;
      updateData.status = 'delivered';
      break;
    case 'open':
      updateData.firstOpenedAt = updateData.firstOpenedAt || event.timestamp * 1000;
      updateData.lastOpenedAt = event.timestamp * 1000;
      updateData.openCount = (await statsRef.get()).data()?.openCount + 1 || 1;
      break;
    case 'click':
      updateData.firstClickedAt = updateData.firstClickedAt || event.timestamp * 1000;
      updateData.lastClickedAt = event.timestamp * 1000;
      updateData.clickCount = (await statsRef.get()).data()?.clickCount + 1 || 1;
      break;
    case 'bounce':
      updateData.bouncedAt = event.timestamp * 1000;
      updateData.bounceType = event.type;
      updateData.bounceReason = event.reason;
      updateData.status = 'bounced';
      break;
    case 'spamreport':
      updateData.spamReportedAt = event.timestamp * 1000;
      updateData.status = 'spam';
      break;
    case 'unsubscribe':
      updateData.unsubscribedAt = event.timestamp * 1000;
      break;
  }

  await statsRef.set(updateData, { merge: true });
}

async function addToSuppression(event: SendGridWebhookEvent): Promise<void> {
  // Map SendGrid event types to suppression reasons
  const reasonMap: Record<string, 'bounce' | 'spam' | 'unsubscribe'> = {
    bounce: 'bounce',
    spamreport: 'spam',  // SendGrid sends 'spamreport', we store as 'spam'
    unsubscribe: 'unsubscribe',
  };
  
  const suppressionDoc = {
    email: event.email.toLowerCase(),
    reason: reasonMap[event.event] || 'bounce',
    createdAt: Date.now(),
    source: 'sendgrid_webhook',
    
    ...(event.event === 'bounce' && {
      bounceType: event.type === 'bounce' ? 'hard' : 'soft',
      bounceReason: event.reason,
    }),
    
    // Soft bounces expire after 7 days
    ...(event.type === 'blocked' && {
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
    }),
  };

  await db.collection(SUPPRESSION_COLLECTION).doc(event.email.toLowerCase()).set(suppressionDoc);
}

/**
 * Verify SendGrid webhook signature
 * @see https://docs.sendgrid.com/for-developers/tracking-events/getting-started-event-webhook-security-features
 */
function verifySignature(req: VercelRequest): boolean {
  const webhookKey = process.env.SENDGRID_WEBHOOK_VERIFICATION_KEY;
  const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';
  
  // In production, require signature verification key
  if (!webhookKey) {
    if (isProduction) {
      console.error('[SendGrid Webhook] SENDGRID_WEBHOOK_VERIFICATION_KEY not configured in production!');
      return false; // Block in production
    }
    console.warn('[SendGrid Webhook] No verification key configured, skipping signature check (development mode)');
    return true;
  }

  const signature = req.headers['x-twilio-email-event-webhook-signature'] as string;
  const timestamp = req.headers['x-twilio-email-event-webhook-timestamp'] as string;

  if (!signature || !timestamp) {
    return false;
  }

  // Reconstruct the payload
  const payload = timestamp + JSON.stringify(req.body);
  const expectedSignature = createHmac('sha256', webhookKey)
    .update(payload)
    .digest('base64');

  try {
    return timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
}
