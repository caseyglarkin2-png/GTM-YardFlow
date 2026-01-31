import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminDb } from '../../lib/firebaseAdmin';

const db = getAdminDb();

const INBOUND_COLLECTION = 'email_replies';
const EMAIL_EVENTS_COLLECTION = 'email_events';

/**
 * SendGrid Inbound Parse Webhook
 * 
 * Receives inbound emails via SendGrid Inbound Parse:
 * - Detects replies to our outreach emails
 * - Links reply to original outreach
 * - Pauses sequence enrollment if applicable
 * 
 * Configure in SendGrid:
 * 1. Set up domain authentication for receiving
 * 2. Add MX record for your receiving subdomain
 * 3. Configure Inbound Parse to POST to this endpoint
 * 
 * @see https://docs.sendgrid.com/for-developers/parsing-email/setting-up-the-inbound-parse-webhook
 */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    // SendGrid Inbound Parse sends multipart/form-data
    const {
      from,
      to,
      subject,
      text,
      html,
      headers: headersRaw,
      envelope: envelopeRaw,
    } = req.body;

    // Parse envelope for actual sender/recipient
    let envelope: { from: string; to: string[] } | undefined;
    try {
      envelope = typeof envelopeRaw === 'string' ? JSON.parse(envelopeRaw) : envelopeRaw;
    } catch {
      // Ignore parse errors
    }

    // Extract the original email ID from subject or headers
    const originalEmailId = extractOriginalEmailId(subject, headersRaw);
    const senderEmail = extractEmail(from);
    
    if (!senderEmail) {
      res.status(400).json({ error: 'Could not extract sender email' });
      return;
    }

    // Store the reply
    const replyDoc = {
      id: `reply_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      from: senderEmail,
      fromFull: from,
      to: to,
      subject: subject || '(no subject)',
      textBody: text || '',
      htmlBody: html || '',
      receivedAt: Date.now(),
      
      // Link to original outreach
      originalEmailId,
      linkedToOutreach: !!originalEmailId,
      
      // Processing status
      processed: false,
      sequencePaused: false,
      
      envelope,
    };

    await db.collection(INBOUND_COLLECTION).doc(replyDoc.id).set(replyDoc);

    // If we found the original email, update its status and pause sequence
    if (originalEmailId) {
      await handleReplyToOutreach(originalEmailId, senderEmail, replyDoc.id);
    }

    // Also try to find by sender email address (fuzzy matching)
    if (!originalEmailId) {
      await tryFuzzyMatchAndPause(senderEmail, replyDoc.id);
    }

    res.status(200).json({ 
      success: true, 
      replyId: replyDoc.id,
      linkedToOriginal: !!originalEmailId,
    });
  } catch (error) {
    console.error('[Inbound Webhook] Error processing reply:', error);
    res.status(500).json({ error: 'Failed to process inbound email' });
  }
}

/**
 * Extract original email ID from reply subject or headers
 * 
 * We inject a tracking ID in outbound emails via:
 * - X-Outreach-ID header
 * - Hidden footer tag
 */
function extractOriginalEmailId(subject?: string, headersRaw?: string): string | undefined {
  // Try to find in headers first (most reliable)
  if (headersRaw) {
    const headers = typeof headersRaw === 'string' ? headersRaw : '';
    
    // Look for In-Reply-To or References header containing our message ID
    const messageIdMatch = headers.match(/In-Reply-To:\s*<([^>]+)>/i) ||
                          headers.match(/References:.*<([^>]+)>/i);
    if (messageIdMatch?.[1]) {
      // Our message IDs are formatted as: emailId@domain
      const emailId = messageIdMatch[1].split('@')[0];
      if (emailId && emailId.length > 10) {
        return emailId;
      }
    }

    // Look for our custom header
    const outreachIdMatch = headers.match(/X-Outreach-ID:\s*(\S+)/i);
    if (outreachIdMatch?.[1]) {
      return outreachIdMatch[1];
    }
  }

  // Try to find tracking ID in subject (Re: [TRACK-xxxx] Original Subject)
  if (subject) {
    const trackMatch = subject.match(/\[TRACK-([a-zA-Z0-9]+)\]/);
    if (trackMatch?.[1]) {
      return trackMatch[1];
    }
  }

  return undefined;
}

/**
 * Extract email address from "Name <email@domain.com>" format
 */
function extractEmail(fromField?: string): string | undefined {
  if (!fromField) return undefined;
  
  const emailMatch = fromField.match(/<([^>]+)>/) || fromField.match(/([^\s<>]+@[^\s<>]+)/);
  return emailMatch?.[1]?.toLowerCase();
}

/**
 * Handle reply to a known outreach email
 * - Record reply event
 * - Pause active sequence enrollment
 */
async function handleReplyToOutreach(emailId: string, senderEmail: string, replyId: string): Promise<void> {
  // Record the reply event
  await db.collection(EMAIL_EVENTS_COLLECTION).doc(`reply:${replyId}`).set({
    emailId,
    type: 'reply',
    email: senderEmail,
    replyId,
    timestamp: Date.now(),
    receivedAt: Date.now(),
    expiresAt: Date.now() + 90 * 24 * 60 * 60 * 1000,
  });

  // Find and pause active sequence enrollment
  await pauseSequenceForEmail(emailId, senderEmail, 'reply_received');

  // Update the reply doc
  await db.collection(INBOUND_COLLECTION).doc(replyId).update({
    processed: true,
    linkedToOutreach: true,
    originalEmailId: emailId,
  });
}

/**
 * Try to find recent outreach to this sender and pause
 */
async function tryFuzzyMatchAndPause(senderEmail: string, replyId: string): Promise<void> {
  // Look for any recent email queue items to this address
  const recentEmails = await db.collection('email_queue')
    .where('message.to', '==', senderEmail)
    .where('status', '==', 'sent')
    .orderBy('updatedAt', 'desc')
    .limit(1)
    .get();

  if (!recentEmails.empty) {
    const emailDoc = recentEmails.docs[0];
    const emailData = emailDoc.data();
    
    await handleReplyToOutreach(emailDoc.id, senderEmail, replyId);
    
    console.log(`[Inbound Webhook] Fuzzy matched reply from ${senderEmail} to email ${emailDoc.id}`);
    
    await db.collection(INBOUND_COLLECTION).doc(replyId).update({
      fuzzyMatched: true,
      originalEmailId: emailDoc.id,
      enrollmentId: emailData.enrollmentId,
    });
  }
}

/**
 * Pause sequence enrollment when reply received
 */
async function pauseSequenceForEmail(emailId: string, senderEmail: string, reason: string): Promise<void> {
  // Find enrollment by email ID
  const queueItem = await db.collection('email_queue').doc(emailId).get();
  const enrollmentId = queueItem.data()?.enrollmentId;

  if (enrollmentId) {
    await db.collection('sequenceEnrollments').doc(enrollmentId).update({
      status: 'paused',
      pausedAt: Date.now(),
      pauseReason: reason,
      lastUpdated: Date.now(),
    });
    
    console.log(`[Inbound Webhook] Paused enrollment ${enrollmentId} due to reply from ${senderEmail}`);
    return;
  }

  // Fallback: find by prospect email
  const enrollments = await db.collection('sequenceEnrollments')
    .where('prospectEmail', '==', senderEmail)
    .where('status', '==', 'active')
    .limit(1)
    .get();

  if (!enrollments.empty) {
    const enrollmentDoc = enrollments.docs[0];
    await enrollmentDoc.ref.update({
      status: 'paused',
      pausedAt: Date.now(),
      pauseReason: reason,
      lastUpdated: Date.now(),
    });
    
    console.log(`[Inbound Webhook] Paused enrollment ${enrollmentDoc.id} for ${senderEmail}`);
  }
}
