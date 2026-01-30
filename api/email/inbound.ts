import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminDb } from '../../lib/firebaseAdmin';
import { createLogger } from '../../lib/logger';

const log = createLogger('email-inbound');
const db = getAdminDb();

/**
 * Inbound Email Webhook - Sprint 82.1/83
 * 
 * Receives parsed emails from SendGrid Inbound Parse.
 * When a prospect replies to a sequence email:
 * 1. Matches the reply to the original email via headers
 * 2. Updates enrollment status to 'replied'
 * 3. Pauses the sequence
 * 4. Records reply event for analytics
 * 
 * SendGrid Inbound Parse Configuration:
 * - Set up MX records for reply subdomain (e.g., reply.yardflow.io)
 * - Configure Inbound Parse to POST to this endpoint
 * 
 * Request body from SendGrid includes:
 * - from: sender email
 * - to: recipient email (our reply address)
 * - subject: email subject
 * - text: plain text body
 * - html: HTML body
 * - headers: raw headers string
 * - envelope: JSON string with from/to
 */

interface InboundEmailPayload {
  from: string;
  to: string;
  subject: string;
  text?: string;
  html?: string;
  headers?: string;
  envelope?: string;
  attachments?: string;
  'attachment-info'?: string;
}

/**
 * Parse email headers to extract In-Reply-To and References
 */
function parseHeaders(headersString: string): Record<string, string> {
  const headers: Record<string, string> = {};
  const lines = headersString.split('\n');
  let currentKey = '';
  let currentValue = '';
  
  for (const line of lines) {
    if (line.match(/^\s/)) {
      // Continuation of previous header
      currentValue += ' ' + line.trim();
    } else {
      // Save previous header
      if (currentKey) {
        headers[currentKey.toLowerCase()] = currentValue;
      }
      // Start new header
      const colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        currentKey = line.substring(0, colonIndex).trim();
        currentValue = line.substring(colonIndex + 1).trim();
      }
    }
  }
  // Save last header
  if (currentKey) {
    headers[currentKey.toLowerCase()] = currentValue;
  }
  
  return headers;
}

/**
 * Extract email address from a "Name <email@domain.com>" format
 */
function extractEmail(fromString: string): string {
  const match = fromString.match(/<([^>]+)>/);
  if (match) return match[1].toLowerCase();
  return fromString.toLowerCase().trim();
}

/**
 * Find the enrollment associated with this reply
 */
async function findEnrollmentByReply(
  senderEmail: string,
  inReplyTo?: string,
  references?: string
): Promise<{ enrollmentId: string; emailId?: string } | null> {
  // Strategy 1: Match by In-Reply-To header
  if (inReplyTo) {
    // In-Reply-To contains the Message-ID of the original email
    // We store Message-ID in email_queue when sending
    const queueSnap = await db
      .collection('email_queue')
      .where('message.messageId', '==', inReplyTo.replace(/[<>]/g, ''))
      .limit(1)
      .get();
    
    if (!queueSnap.empty) {
      const queueDoc = queueSnap.docs[0];
      const enrollmentId = queueDoc.data().enrollmentId;
      if (enrollmentId) {
        return { enrollmentId, emailId: queueDoc.id };
      }
    }
  }
  
  // Strategy 2: Match by sender email to active enrollment
  const enrollmentSnap = await db
    .collection('sequenceEnrollments')
    .where('prospectEmail', '==', senderEmail)
    .where('status', '==', 'active')
    .limit(1)
    .get();
  
  if (!enrollmentSnap.empty) {
    return { enrollmentId: enrollmentSnap.docs[0].id };
  }
  
  // Strategy 3: Check paused enrollments too
  const pausedSnap = await db
    .collection('sequenceEnrollments')
    .where('prospectEmail', '==', senderEmail)
    .where('status', '==', 'paused')
    .limit(1)
    .get();
  
  if (!pausedSnap.empty) {
    return { enrollmentId: pausedSnap.docs[0].id };
  }
  
  return null;
}

/**
 * Mark enrollment as replied and record the event
 */
async function handleReply(
  enrollmentId: string,
  senderEmail: string,
  subject: string,
  textSnippet: string,
  emailId?: string
): Promise<void> {
  const now = new Date().toISOString();
  
  // Update enrollment status
  await db.collection('sequenceEnrollments').doc(enrollmentId).update({
    status: 'replied',
    completedAt: now,
    nextSendAt: null,
    pauseReason: 'prospect_replied',
  });
  
  // Record reply event for analytics
  await db.collection('email_events').add({
    type: 'reply',
    enrollmentId,
    emailId: emailId || null,
    prospectEmail: senderEmail,
    subject,
    textSnippet: textSnippet.substring(0, 500), // Store first 500 chars
    receivedAt: now,
  });
  
  // Update prospect status if we can find them
  const enrollmentDoc = await db.collection('sequenceEnrollments').doc(enrollmentId).get();
  if (enrollmentDoc.exists) {
    const prospectId = enrollmentDoc.data()?.prospectId;
    if (prospectId) {
      // Try to update prospect status in artifacts
      try {
        const prospectRef = db.collection('artifacts').doc('prospects').collection('data').doc(prospectId);
        const prospectDoc = await prospectRef.get();
        if (prospectDoc.exists) {
          await prospectRef.update({
            status: 'replied',
            lastReplyAt: now,
          });
        }
      } catch (err) {
        log.warn('Could not update prospect status', { prospectId, error: err });
      }
    }
  }
  
  log.info('Reply processed', { enrollmentId, senderEmail, subject });
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  // SendGrid Inbound Parse sends POST requests
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const startTime = Date.now();
  log.info('Received inbound email');

  try {
    // Parse the request body
    // SendGrid sends multipart form data, but Vercel may parse it as JSON
    const body = req.body as InboundEmailPayload;
    
    if (!body.from) {
      log.warn('Missing from field in inbound email');
      res.status(400).json({ error: 'Missing from field' });
      return;
    }

    const senderEmail = extractEmail(body.from);
    const subject = body.subject || '(no subject)';
    const textContent = body.text || '';
    
    // Parse headers for reply matching
    const headers = body.headers ? parseHeaders(body.headers) : {};
    const inReplyTo = headers['in-reply-to'];
    const references = headers['references'];

    log.info('Processing inbound email', { 
      from: senderEmail, 
      subject,
      hasInReplyTo: !!inReplyTo 
    });

    // Find associated enrollment
    const match = await findEnrollmentByReply(senderEmail, inReplyTo, references);
    
    if (!match) {
      log.info('No matching enrollment found for reply', { senderEmail });
      // Still return 200 to acknowledge receipt
      res.status(200).json({ 
        received: true, 
        matched: false,
        message: 'No matching enrollment' 
      });
      return;
    }

    // Process the reply
    await handleReply(
      match.enrollmentId,
      senderEmail,
      subject,
      textContent,
      match.emailId
    );

    const duration = Date.now() - startTime;
    log.info('Inbound email processed', { 
      enrollmentId: match.enrollmentId, 
      durationMs: duration 
    });

    res.status(200).json({
      received: true,
      matched: true,
      enrollmentId: match.enrollmentId,
      durationMs: duration,
    });
  } catch (err) {
    const error = err as Error;
    log.error('Failed to process inbound email', error);
    
    // Still return 200 to prevent SendGrid from retrying
    res.status(200).json({
      received: true,
      error: error.message,
    });
  }
}
